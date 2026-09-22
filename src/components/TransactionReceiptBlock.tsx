import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import ChevronRight from "lucide-react-native/dist/esm/icons/chevron-right";
import QrCode from "lucide-react-native/dist/esm/icons/qr-code";
import Receipt from "lucide-react-native/dist/esm/icons/receipt";
import ShoppingCart from "lucide-react-native/dist/esm/icons/shopping-cart";

import type { BankTransaction } from "../services/api";
import { useShoppingStore } from "../store/shoppingStore";
import { useToastStore } from "../store/toastStore";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import * as Haptics from "../utils/haptics";
import { formatBRL } from "../utils/money";
import { type NotaFiscal, descreverNota, lerNotaFiscal } from "../utils/notaFiscal";
import {
  describeTripLine,
  tripCandidatesFor,
  tripLinkedTo,
} from "../utils/shopping";
import { transactionDisplayName } from "../utils/transactions";
import NotaFiscalSheet from "./NotaFiscalSheet";

/** Nome de loja que cabe num cabeçalho, tirado do texto do banco. */
const STORE_NAME_MAX = 40;

interface TransactionReceiptBlockProps {
  transaction: BankTransaction;
  /**
   * Abre a compra ligada. Ausente esconde o atalho — é o caso de quem monta
   * a folha fora de um navegador.
   */
  onOpenTrip?: (tripClientId: string) => void;
}

/**
 * A nota fiscal e o carrinho, vistos DO EXTRATO.
 *
 * <p><b>O relato (21/09/2026), dentro do mercado:</b> <i>"não estou
 * conseguindo anexar a nf na última transação de 600 reais do flash, mas ao
 * clicar em extrato e ir em detalhes não aparece nenhum botões, onde está
 * essa funcionalidade?"</i>
 *
 * <p>Ele tinha razão: não havia. A nota só entrava pelo fechamento de uma
 * compra anotada item a item, e quem já pagou não tem mais o que fechar. O
 * caminho natural — abrir o lançamento e anexar a nota ali — não existia.
 *
 * <p>Agora existe, e ele tem dois lados. Se a compra foi anotada no
 * corredor, este bloco a encontra pelo valor e pela data, e ligá-la é um
 * toque. Se não foi (que é o caso de quase toda compra antiga), ler o QR
 * cria a compra a partir do próprio lançamento: valor do banco, data do
 * banco, nota anexada — e os itens entram depois, se ele quiser.
 */
export default function TransactionReceiptBlock({
  transaction,
  onOpenTrip,
}: TransactionReceiptBlockProps) {
  const t = useTheme();
  const showToast = useToastStore((s) => s.showToast);
  const trips = useShoppingStore((s) => s.trips);
  const reconcile = useShoppingStore((s) => s.reconcile);
  const attach = useShoppingStore((s) => s.attachReceiptToTransaction);
  const closeTrip = useShoppingStore((s) => s.closeTrip);

  const [folhaNota, setFolhaNota] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const ligada = useMemo(
    () => tripLinkedTo(trips, transaction.id),
    [trips, transaction.id],
  );
  const candidatas = useMemo(
    () =>
      ligada
        ? []
        : tripCandidatesFor(trips, {
            amount: transaction.amount,
            date: transaction.date,
          }),
    [ligada, trips, transaction.amount, transaction.date],
  );

  const nota: NotaFiscal | null = ligada?.receiptKey
    ? lerNotaFiscal(ligada.receiptKey)
    : null;

  const nomeDaLoja = transactionDisplayName(transaction)
    .trim()
    .slice(0, STORE_NAME_MAX);

  /** Nota lida SEM compra ligada: a compra nasce deste lançamento. */
  const criarComANota = async (lida: NotaFiscal) => {
    setOcupado("nota");
    const resultado = await attach({
      transactionId: transaction.id,
      storeName: nomeDaLoja,
      amount: transaction.amount,
      date: transaction.date,
      receiptKey: lida.chave,
    });
    setOcupado(null);
    Haptics.notificationAsync(
      resultado.ok
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    );
    showToast(
      resultado.ok ? "Nota anexada a este lançamento." : resultado.message,
      resultado.ok ? "success" : "info",
    );
  };

  /** Nota lida COM compra ligada: a chave entra na compra que já existe. */
  const anexarNaCompra = async (lida: NotaFiscal) => {
    if (!ligada) return;
    setOcupado("nota");
    await closeTrip(ligada.clientId, ligada.receiptTotal, lida.chave);
    setOcupado(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast("Nota anexada à compra.", "success");
  };

  const ligarCompra = async (tripClientId: string) => {
    setOcupado(tripClientId);
    const resultado = await reconcile(tripClientId, transaction.id);
    setOcupado(null);
    Haptics.notificationAsync(
      resultado.ok
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    );
    showToast(resultado.message, resultado.ok ? "success" : "info");
  };

  const rotuloSecao = {
    color: t.text.primary,
    fontSize: 15,
    fontWeight: "700" as const,
  };

  const botao = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: spacing[2],
    minHeight: 48,
    paddingHorizontal: spacing[3],
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: t.border.default,
    backgroundColor: t.background.elevated,
    marginTop: spacing[2],
  };

  return (
    <View>
      <View
        style={{
          height: 1,
          backgroundColor: t.border.subtle,
          marginVertical: spacing[4],
        }}
      />

      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
        <Receipt size={16} color={t.text.secondary} />
        <Text style={rotuloSecao}>Nota fiscal e carrinho</Text>
      </View>

      {ligada ? (
        <>
          <Pressable
            onPress={onOpenTrip ? () => onOpenTrip(ligada.clientId) : undefined}
            disabled={!onOpenTrip}
            accessibilityRole={onOpenTrip ? "button" : undefined}
            accessibilityLabel={
              onOpenTrip ? `Abrir a compra ${describeTripLine(ligada)}` : undefined
            }
            style={{ ...botao, borderColor: t.chart.up }}
          >
            <ShoppingCart size={18} color={t.chart.up} />
            <Text
              numberOfLines={1}
              style={{ flex: 1, color: t.text.primary, fontSize: 13, fontWeight: "700" }}
            >
              {describeTripLine(ligada)}
            </Text>
            {onOpenTrip ? <ChevronRight size={18} color={t.text.tertiary} /> : null}
          </Pressable>

          <Text
            style={{
              color: t.text.tertiary,
              fontSize: 12,
              lineHeight: 16,
              marginTop: spacing[2],
            }}
          >
            {nota
              ? descreverNota(nota)
              : "Sem nota anexada — o QR do cupom guarda a loja, o número e a data."}
          </Text>

          <Pressable
            onPress={() => setFolhaNota(true)}
            disabled={ocupado !== null}
            accessibilityRole="button"
            accessibilityLabel={
              nota ? "Trocar a nota fiscal desta compra" : "Ler o QR da nota fiscal"
            }
            style={botao}
          >
            {ocupado === "nota" ? (
              <ActivityIndicator size="small" color={t.accent.neon} />
            ) : (
              <QrCode size={18} color={t.text.primary} />
            )}
            <Text style={{ color: t.text.primary, fontSize: 13, fontWeight: "700" }}>
              {nota ? "Ler outra nota" : "Ler o QR da nota fiscal"}
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text
            style={{
              color: t.text.secondary,
              fontSize: 13,
              lineHeight: 18,
              marginTop: spacing[2],
            }}
          >
            Leia o QR do cupom e este lançamento vira uma compra de{" "}
            {formatBRL(Math.abs(transaction.amount))} com a nota anexada. Os
            itens você anota depois, se quiser.
          </Text>

          <Pressable
            onPress={() => setFolhaNota(true)}
            disabled={ocupado !== null}
            accessibilityRole="button"
            accessibilityLabel="Ler o QR da nota fiscal"
            style={{ ...botao, borderColor: t.accent.neon }}
          >
            {ocupado === "nota" ? (
              <ActivityIndicator size="small" color={t.accent.neon} />
            ) : (
              <QrCode size={18} color={t.accent.neon} />
            )}
            <Text style={{ color: t.text.primary, fontSize: 13, fontWeight: "700" }}>
              Ler o QR da nota fiscal
            </Text>
          </Pressable>

          {candidatas.length > 0 ? (
            <>
              <Text
                style={{
                  color: t.text.tertiary,
                  fontSize: 12,
                  marginTop: spacing[4],
                }}
              >
                Ou ligue a uma compra que você já anotou:
              </Text>
              {candidatas.map((compra) => (
                <Pressable
                  key={compra.clientId}
                  onPress={() => ligarCompra(compra.clientId)}
                  disabled={ocupado !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`Ligar a ${describeTripLine(compra)}`}
                  style={botao}
                >
                  {ocupado === compra.clientId ? (
                    <ActivityIndicator size="small" color={t.accent.neon} />
                  ) : (
                    <ShoppingCart size={18} color={t.text.secondary} />
                  )}
                  <Text
                    numberOfLines={1}
                    style={{ flex: 1, color: t.text.primary, fontSize: 13 }}
                  >
                    {describeTripLine(compra)}
                  </Text>
                </Pressable>
              ))}
            </>
          ) : null}
        </>
      )}

      <NotaFiscalSheet
        visible={folhaNota}
        atual={ligada?.receiptKey ?? null}
        onConfirm={(lida) => {
          setFolhaNota(false);
          if (ligada) anexarNaCompra(lida);
          else criarComANota(lida);
        }}
        onClose={() => setFolhaNota(false)}
      />
    </View>
  );
}
