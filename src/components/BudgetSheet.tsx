import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import X from "lucide-react-native/dist/esm/icons/x";

import { clearBudget, setBudget } from "../services/api";
import { useTheme } from "../theme/ThemeProvider";
import { radius, SHEET_PADDING, spacing } from "../theme/ds";
import * as Haptics from "../utils/haptics";
import { formatBRL, parseAmount } from "../utils/money";
import CustomModal from "./CustomModal";

export interface BudgetTarget {
  categoryId: string;
  categoryName: string | null;
  /** O teto que já existe, ou null quando esta categoria ainda não tem um. */
  monthlyLimit: number | null;
}

interface Props {
  visible: boolean;
  /** A categoria sendo limitada; null enquanto a folha está fechada. */
  target: BudgetTarget | null;
  onClose: () => void;
  /** Chamado depois de gravar ou apagar, para a tela recarregar os tetos. */
  onSaved: () => void;
}

/**
 * Pôr, reajustar ou tirar o teto de uma categoria — EC-204.
 *
 * <p><b>O teto é MENSAL, mesmo que a tela leia por ciclo.</b> A intenção que a
 * pessoa tem é mensal — <i>"não quero passar de R$ 800 em mercado"</i> — e o
 * recorte é escolha de tela, que pode mudar amanhã. Guardar o teto preso ao
 * recorte faria a intenção mudar junto com a tela; quem faz a regra de três
 * com o tamanho da janela é o servidor.
 *
 * <p>É por isso que esta folha diz "por mês" e não "neste período": pedir um
 * número e usá-lo para outra coisa é a forma mais direta de o usuário deixar
 * de confiar no aviso.
 *
 * <p><b>Tirar o teto fica separado de zerar.</b> Zero não é teto (o servidor
 * responde 400), e um campo zerado que silenciosamente apagasse a regra seria
 * uma exclusão sem confirmação — por isso a remoção tem botão próprio.
 */
export default function BudgetSheet({ visible, target, onClose, onSaved }: Props) {
  const t = useTheme();

  const [amount, setAmount] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existente = target?.monthlyLimit ?? null;

  // Cada abertura recomeça do que está salvo: rascunho de uma categoria não
  // pode reaparecer sobre outra
  useEffect(() => {
    if (!visible || !target) return;
    setAmount(existente != null ? String(existente.toFixed(2)).replace(".", ",") : "");
    setError(null);
    setIsSaving(false);
  }, [visible, target, existente]);

  const nome = target?.categoryName ?? "Sem categoria";

  const submit = async () => {
    if (!target || isSaving) return;
    const valor = parseAmount(amount);
    if (valor == null) {
      setError("Informe o teto mensal desta categoria.");
      return;
    }
    if (valor <= 0) {
      setError("Um teto precisa ser maior que zero. Para tirá-lo, use o botão abaixo.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await setBudget(target.categoryId, valor);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
      onClose();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Erro fica NA folha, e não em toast: o Toast é montado fora do Modal e
      // pode não aparecer por cima dele
      setError("Não consegui guardar agora. Tente de novo.");
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (!target || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await clearBudget(target.categoryId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
      onClose();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError("Não consegui tirar o teto agora. Tente de novo.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <CustomModal visible={visible} onClose={onClose}>
      {target ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={SHEET_PADDING}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: spacing[3],
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text.primary, fontSize: 16, fontWeight: "800" }}>
                Teto de {nome}
              </Text>
              <Text style={{ color: t.text.tertiary, fontSize: 12, marginTop: 2 }}>
                {existente != null
                  ? `Hoje: ${formatBRL(existente)} por mês`
                  : "Esta categoria ainda não tem teto"}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              hitSlop={8}
            >
              <X size={20} color={t.text.tertiary} />
            </Pressable>
          </View>

          <Text style={{ color: t.text.secondary, fontSize: 12, lineHeight: 17 }}>
            O teto é por mês, mesmo quando você lê o gasto pelo seu ciclo de
            fatura — o app estica ou encolhe o limite para o tamanho do período
            que estiver na tela. Nada é bloqueado: o teto serve para avisar, não
            para impedir.
          </Text>

          <Text
            style={{
              color: t.text.tertiary,
              fontSize: 10,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginTop: spacing[4],
            }}
          >
            Quanto por mês
          </Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            accessibilityLabel={`Teto mensal de ${nome}`}
            placeholder="0,00"
            placeholderTextColor={t.text.tertiary}
            style={{
              color: t.text.primary,
              fontSize: 18,
              fontWeight: "700",
              borderWidth: 1,
              borderColor: t.border.subtle,
              borderRadius: radius.lg,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[3],
              marginTop: spacing[2],
            }}
          />

          {error ? (
            <Text style={{ color: t.semantic.danger, fontSize: 12, marginTop: spacing[3] }}>
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={submit}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel={existente != null ? "Reajustar o teto" : "Guardar o teto"}
            accessibilityState={{ disabled: isSaving }}
            style={{
              height: 48,
              borderRadius: radius.xl,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: t.accent.neon,
              opacity: isSaving ? 0.5 : 1,
              marginTop: spacing[4],
            }}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={t.text.inverse} />
            ) : (
              <Text style={{ color: t.text.inverse, fontWeight: "700", fontSize: 14 }}>
                {existente != null ? "Reajustar" : "Guardar"}
              </Text>
            )}
          </Pressable>

          {existente != null ? (
            <Pressable
              onPress={remove}
              disabled={isSaving}
              accessibilityRole="button"
              accessibilityLabel={`Tirar o teto de ${nome}`}
              style={{
                height: 44,
                alignItems: "center",
                justifyContent: "center",
                marginTop: spacing[2],
              }}
            >
              <Text style={{ color: t.semantic.danger, fontWeight: "700", fontSize: 13 }}>
                Tirar o teto
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      ) : null}
    </CustomModal>
  );
}
