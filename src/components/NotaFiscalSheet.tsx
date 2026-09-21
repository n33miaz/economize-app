import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import Check from "lucide-react-native/dist/esm/icons/check";
import QrCode from "lucide-react-native/dist/esm/icons/qr-code";
import X from "lucide-react-native/dist/esm/icons/x";

import { useTheme } from "../theme/ThemeProvider";
import { SHEET_PADDING, SHEET_TITLE, radius, spacing, touchArea } from "../theme/ds";
import * as Haptics from "../utils/haptics";
import { formatBRL } from "../utils/money";
import {
  type NotaFiscal,
  descreverNota,
  formatarCnpj,
  lerNotaFiscal,
} from "../utils/notaFiscal";
import CustomModal from "./CustomModal";

interface NotaFiscalSheetProps {
  visible: boolean;
  /** A nota já lida desta compra, quando houver. */
  atual: string | null;
  onConfirm: (nota: NotaFiscal) => void;
  onClose: () => void;
}

/**
 * Ler a nota fiscal do cupom — o pedido feito de dentro do mercado em
 * 21/09/2026: <i>"não estou conseguindo anexar a nf"</i>.
 *
 * <p><b>O que esta folha faz, e o que ela NÃO faz.</b> Ela lê a CHAVE DE
 * ACESSO do QR impresso no cupom. Da chave saem, sem consultar ninguém e sem
 * internet: o estado, o mês, o CNPJ da loja, o modelo, a série e o número da
 * nota — mais um dígito verificador que prova que a leitura está certa. Os
 * ITENS da nota não vêm: eles moram no portal da Fazenda de cada estado, cada
 * um com o seu endereço e boa parte com captcha. A folha diz isso em vez de
 * deixar a pessoa esperando uma lista que não vai chegar.
 *
 * <p><b>Por que há campo de digitar.</b> QR amassado, cupom térmico apagado e
 * câmera de aparelho antigo acontecem. A chave está impressa por extenso no
 * próprio cupom, e digitar 44 dígitos é feio mas funciona — e o dígito
 * verificador avisa na hora se um número saiu errado.
 */
export default function NotaFiscalSheet({
  visible,
  atual,
  onConfirm,
  onClose,
}: NotaFiscalSheetProps) {
  const t = useTheme();
  const [permissao, pedirPermissao] = useCameraPermissions();
  const [lendo, setLendo] = useState(false);
  const [digitado, setDigitado] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [nota, setNota] = useState<NotaFiscal | null>(null);
  // O leitor dispara várias vezes com o mesmo código enquanto a câmera aponta
  // para ele; sem esta trava a folha confirmaria em looping
  const jaLido = useRef(false);

  useEffect(() => {
    if (!visible) return;
    setLendo(false);
    setDigitado("");
    setErro(null);
    setNota(null);
    jaLido.current = false;
  }, [visible]);

  const aceitar = (conteudo: string, origem: "camera" | "teclado") => {
    const lida = lerNotaFiscal(conteudo);
    if (!lida) {
      setErro(
        origem === "camera"
          ? "Esse QR não é de uma nota fiscal."
          : "A chave não confere. Tem 44 dígitos e vem impressa no cupom.",
      );
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setErro(null);
    setNota(lida);
    setLendo(false);
  };

  const abrirCamera = async () => {
    setErro(null);
    if (!permissao?.granted) {
      const resposta = await pedirPermissao();
      if (!resposta.granted) {
        setErro("Sem permissão para usar a câmera. Dá para digitar a chave abaixo.");
        return;
      }
    }
    jaLido.current = false;
    setLendo(true);
  };

  const rotuloCampo = {
    color: t.text.tertiary,
    fontSize: 11,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  };

  return (
    <CustomModal visible={visible} onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={SHEET_PADDING}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing[3] }}>
          <Text style={{ flex: 1, color: t.text.primary, ...SHEET_TITLE }}>
            Nota fiscal da compra
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            style={touchArea(20)}
          >
            <X size={20} color={t.text.tertiary} />
          </Pressable>
        </View>

        {nota ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: t.chart.up,
              borderRadius: radius.lg,
              padding: spacing[4],
              backgroundColor: t.background.elevated,
            }}
          >
            <Text style={{ color: t.chart.up, fontSize: 13, fontWeight: "700" }}>
              Nota reconhecida
            </Text>
            <Text style={{ color: t.text.primary, fontSize: 15, fontWeight: "700", marginTop: 4 }}>
              {descreverNota(nota)}
            </Text>
            <Text style={{ color: t.text.secondary, fontSize: 12, marginTop: 2 }}>
              CNPJ {formatarCnpj(nota.cnpj)}
            </Text>
            {nota.total != null ? (
              <Text style={{ color: t.text.secondary, fontSize: 12, marginTop: 2 }}>
                Total na nota: {formatBRL(nota.total)}
              </Text>
            ) : null}
            <Text style={{ color: t.text.tertiary, fontSize: 11, lineHeight: 15, marginTop: spacing[2] }}>
              Os itens da nota não vêm no QR — eles ficam no portal da Fazenda do
              estado. O que entra aqui identifica a nota e a loja.
            </Text>
            <Pressable
              onPress={() => onConfirm(nota)}
              accessibilityRole="button"
              accessibilityLabel="Anexar esta nota à compra"
              style={{
                backgroundColor: t.accent.neon,
                borderRadius: radius.full,
                minHeight: 48,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: spacing[2],
                marginTop: spacing[4],
              }}
            >
              <Check size={18} color={t.background.base} />
              <Text style={{ color: t.background.base, fontSize: 15, fontWeight: "700" }}>
                Anexar à compra
              </Text>
            </Pressable>
          </View>
        ) : lendo && Platform.OS !== "web" ? (
          <View
            style={{
              height: 300,
              borderRadius: radius["2xl"],
              overflow: "hidden",
              backgroundColor: t.background.elevated,
            }}
          >
            <CameraView
              style={{ flex: 1 }}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={({ data }) => {
                if (jaLido.current) return;
                jaLido.current = true;
                aceitar(data, "camera");
              }}
            />
          </View>
        ) : (
          <>
            <Text style={{ color: t.text.secondary, fontSize: 13, marginBottom: spacing[3] }}>
              Aponte para o QR code impresso no cupom. Ele identifica a nota e a
              loja; os itens ficam no portal da Fazenda e não vêm no código.
            </Text>
            <Pressable
              onPress={abrirCamera}
              accessibilityRole="button"
              accessibilityLabel="Ler o QR da nota"
              style={{
                backgroundColor: t.accent.neon,
                borderRadius: radius.full,
                minHeight: 48,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: spacing[2],
              }}
            >
              <QrCode size={18} color={t.background.base} />
              <Text style={{ color: t.background.base, fontSize: 15, fontWeight: "700" }}>
                Ler o QR da nota
              </Text>
            </Pressable>
          </>
        )}

        {!nota ? (
          <View style={{ marginTop: spacing[5] }}>
            <Text style={rotuloCampo}>Ou digite a chave (44 dígitos)</Text>
            <TextInput
              value={digitado}
              onChangeText={(v) => {
                setDigitado(v);
                if (erro) setErro(null);
              }}
              accessibilityLabel="Chave da nota fiscal"
              placeholder="0000 0000 0000 …"
              placeholderTextColor={t.text.tertiary}
              keyboardType="number-pad"
              autoCorrect={false}
              multiline
              onSubmitEditing={() => aceitar(digitado, "teclado")}
              style={{
                color: t.text.primary,
                fontSize: 15,
                borderWidth: 1,
                borderColor: t.border.subtle,
                borderRadius: radius.lg,
                backgroundColor: t.background.elevated,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[3],
                minHeight: 64,
                textAlignVertical: "top",
                marginTop: spacing[2],
              }}
            />
            <Pressable
              onPress={() => aceitar(digitado, "teclado")}
              accessibilityRole="button"
              accessibilityLabel="Usar a chave digitada"
              style={{
                borderWidth: 1,
                borderColor: t.border.strong,
                borderRadius: radius.full,
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
                marginTop: spacing[3],
              }}
            >
              <Text style={{ color: t.text.primary, fontSize: 14, fontWeight: "700" }}>
                Usar esta chave
              </Text>
            </Pressable>
          </View>
        ) : null}

        {erro ? (
          <Text style={{ color: t.chart.down, fontSize: 13, marginTop: spacing[3] }}>{erro}</Text>
        ) : null}

        {atual && !nota ? (
          <Text style={{ color: t.text.tertiary, fontSize: 12, marginTop: spacing[4] }}>
            Esta compra já tem uma nota anexada. Ler outra substitui a de agora.
          </Text>
        ) : null}
      </ScrollView>
    </CustomModal>
  );
}
