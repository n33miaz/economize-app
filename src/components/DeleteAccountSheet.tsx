import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import X from "lucide-react-native/dist/esm/icons/x";

import { useTheme } from "../theme/ThemeProvider";
import { SHEET_PADDING, SHEET_TITLE, radius, spacing } from "../theme/ds";
import { deleteMyAccount, getMfaStatus } from "../services/api";
import { describeSaveFailure } from "../services/requestFailure";
import { useAuthStore } from "../store/authStore";
import { clearPersonalData } from "../store/sessionReset";
import { useToastStore } from "../store/toastStore";
import * as Haptics from "../utils/haptics";
import CustomModal from "./CustomModal";
import FloatingLabelInput from "./FloatingLabelInput";

interface DeleteAccountSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * "Excluir minha conta" (LGPD). A confirmação forte é a SENHA — e o código do
 * autenticador quando o segundo fator está ligado: um toque num diálogo de
 * "tem certeza?" não basta para algo que não tem volta, e a sessão aberta num
 * celular emprestado também não.
 *
 * <p>Na volta, o logout é o mais completo que o app tem: além do cache do
 * servidor, apaga o que só existia neste aparelho (conversa com o Nino,
 * favoritos) e esquece quem foi a última pessoa — a conta não existe mais
 * para voltar a eles.
 */
export default function DeleteAccountSheet({
  visible,
  onClose,
}: DeleteAccountSheetProps) {
  const t = useTheme();
  const showToast = useToastStore((s) => s.showToast);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  // null = ainda não sabemos; na dúvida o campo do código aparece (opcional)
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [working, setWorking] = useState(false);
  // Trava de duplo toque: o `working` só chega no próximo render, e dois
  // pedidos em voo dariam um 204 e um 401 com toast de erro por cima
  const workingRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    setPassword("");
    setCode("");
    setMfaEnabled(null);
    let vivo = true;
    getMfaStatus()
      .then((status) => {
        if (vivo) setMfaEnabled(status.enabled);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [visible]);

  const showCode = mfaEnabled !== false;
  const podeExcluir =
    password.length > 0 && (mfaEnabled !== true || code.trim().length > 0);

  const excluir = async () => {
    if (workingRef.current || !podeExcluir) return;
    workingRef.current = true;
    setWorking(true);
    try {
      await deleteMyAccount(password, code.trim() || undefined);
      Haptics.notificationAsync();
      onClose();
      // a conta sumiu: nada do que era dela fica no aparelho esperando a volta
      clearPersonalData();
      useAuthStore.setState({ lastUserKey: null } as never);
      useAuthStore.getState().logout();
      showToast("Sua conta foi excluída.", "success");
    } catch (error) {
      // 400 traz o motivo (senha, código) e 409 a regra da casa: o texto do
      // servidor é o que a pessoa precisa ler
      const mensagem = describeSaveFailure(
        error,
        "Não foi possível excluir a conta agora.",
      );
      if (mensagem) showToast(mensagem, "error");
    } finally {
      workingRef.current = false;
      setWorking(false);
    }
  };

  return (
    <CustomModal visible={visible} onClose={working ? () => {} : onClose}>
      <View style={SHEET_PADDING}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: spacing[2],
          }}
        >
          <Text style={{ flex: 1, color: t.text.primary, ...SHEET_TITLE }}>
            Excluir minha conta
          </Text>
          <TouchableOpacity
            onPress={onClose}
            disabled={working}
            accessibilityLabel="Fechar"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.full,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: t.background.elevated,
            }}
          >
            <X size={18} color={t.text.secondary} />
          </TouchableOpacity>
        </View>

        <Text
          style={{
            color: t.text.secondary,
            fontSize: 14,
            lineHeight: 20,
            marginBottom: spacing[4],
          }}
        >
          É permanente. Extrato, contas, metas, categorias, conexões bancárias e
          tudo o mais são apagados e não dá para recuperar. Se quiser uma cópia,
          use antes “Baixar meus dados”.
        </Text>

        <View style={{ marginBottom: spacing[3] }}>
          <FloatingLabelInput
            label="Sua senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>
        {showCode && (
          <View style={{ marginBottom: spacing[3] }}>
            <FloatingLabelInput
              label={
                mfaEnabled
                  ? "Código de verificação"
                  : "Código de verificação (se tiver ligado)"
              }
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
            />
          </View>
        )}

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Excluir minha conta para sempre"
          accessibilityState={{ disabled: working || !podeExcluir }}
          disabled={working || !podeExcluir}
          onPress={excluir}
          activeOpacity={0.85}
          style={{
            marginTop: spacing[2],
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: t.semantic.danger,
            paddingVertical: spacing[4],
            alignItems: "center",
            opacity: working || !podeExcluir ? 0.5 : 1,
          }}
        >
          {working ? (
            <ActivityIndicator color={t.semantic.danger} />
          ) : (
            <Text style={{ color: t.semantic.danger, fontWeight: "700" }}>
              Excluir para sempre
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </CustomModal>
  );
}
