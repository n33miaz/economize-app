import React from "react";
import { Pressable, Text, TouchableOpacity, View } from "react-native";
import ChevronDown from "lucide-react-native/dist/esm/icons/chevron-down";
import Landmark from "lucide-react-native/dist/esm/icons/landmark";
import PiggyBank from "lucide-react-native/dist/esm/icons/piggy-bank";

import type { AccountInvoice, BankTransaction, Category } from "../services/api";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { typography } from "../theme/typography";
import {
  describeInvoice,
  invoiceAmountLabel,
  invoiceBreakdown,
  invoiceDueLabel,
  invoiceIsCredit,
  invoicePeriodLabel,
  invoiceStatusLabel,
  invoiceTitle,
} from "../utils/accounts";
import { formatDayMonth } from "../utils/cycleWindow";
import { formatBRL } from "../utils/money";
import { describeCoverage, readReserve } from "../utils/invoiceReserve";
import { compareInvoice, describeProviderBill } from "../utils/providerBill";
import TransactionRow from "./TransactionRow";

interface InvoiceCardProps {
  invoice: AccountInvoice;
  /** Ciclo derivado pela API (`CALENDAR_MONTH`): o período é aproximado. */
  approximate: boolean;
  expanded: boolean;
  onToggle: () => void;
  onOpenTransaction: (transaction: BankTransaction) => void;
  categories: Map<string, Category>;
  /**
   * Abre a folha de reserva desta fatura (EC-181). Sem a prop, o card apenas
   * MOSTRA o que já está separado — quem não oferece a edição não ganha um
   * botão que não faz nada.
   */
  onEditReserve?: (invoice: AccountInvoice) => void;
}

/**
 * Uma fatura: o que o usuário DEVE, do que esse valor é feito e — ao abrir —
 * cada lançamento que entrou nele.
 *
 * Três decisões que sustentam o card:
 *
 * 1. **O total nunca é recalculado na tela.** Ele vem do servidor (compras
 *    menos estornos) e é o número que o usuário vai conferir contra o app do
 *    banco. As parcelas abaixo explicam esse valor; não o produzem.
 * 2. **Pagamento não é receita nem desconto.** Ele aparece na explicação com a
 *    ressalva escrita, fora da conta do total, porque quitar a fatura é
 *    dinheiro saindo da conta corrente — somá-lo aqui inventaria dinheiro.
 * 3. **Fatura em aberto veste a borda de destaque** e diz "parcial": é o card
 *    de valor provisório, e confundi-lo com uma fatura fechada faz o usuário
 *    planejar com um número que ainda vai crescer.
 *
 * Nada aqui abrevia valor: é superfície de conferência.
 */
export default function InvoiceCard({
  invoice,
  approximate,
  expanded,
  onToggle,
  onOpenTransaction,
  categories,
  onEditReserve,
}: InvoiceCardProps) {
  const t = useTheme();
  const open = invoice.open;
  const credited = invoiceIsCredit(invoice);
  const breakdown = invoiceBreakdown(invoice);
  const due = invoiceDueLabel(invoice);
  const count = invoice.transactionCount;
  const reserve = invoice.reserve;
  // O número do emissor ao lado do nosso. Nulo quando ele não entrega fatura
  // fechada — que é o caso de todo cartão sem conector
  const comparacao = compareInvoice(invoice);
  const linhaDoBanco = describeProviderBill(invoice.providerBill);
  const reading = readReserve(invoice);

  return (
    <View
      style={{
        backgroundColor: t.background.surface,
        borderRadius: radius["2xl"],
        borderWidth: 1,
        // Variante "highlighted" do design system: só o ciclo em aberto a usa,
        // e é o que separa provisório de fechado antes de qualquer leitura
        borderColor: open ? t.accent.neon : t.border.subtle,
        marginBottom: spacing[3],
        overflow: "hidden",
      }}
    >
      <TouchableOpacity
        onPress={onToggle}
        accessibilityLabel={describeInvoice(invoice, approximate)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        activeOpacity={0.85}
        style={{ padding: spacing[4] }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View style={{ flex: 1, marginRight: spacing[3] }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <Text
                style={{
                  color: t.text.primary,
                  fontSize: 15,
                  fontWeight: "700",
                  marginRight: spacing[2],
                }}
              >
                {invoiceTitle(invoice)}
              </Text>
              <View
                style={{
                  borderRadius: radius.full,
                  paddingHorizontal: spacing[2],
                  paddingVertical: 1,
                  backgroundColor: open
                    ? t.accent.neonMuted
                    : t.background.elevated,
                }}
              >
                <Text
                  style={{
                    color: open ? t.accent.neon : t.text.tertiary,
                    fontSize: 10,
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {invoiceStatusLabel(invoice)}
                </Text>
              </View>
            </View>
            <Text
              style={{
                color: t.text.secondary,
                fontSize: 12,
                marginTop: spacing[1],
                fontVariant: ["tabular-nums"],
              }}
            >
              {invoicePeriodLabel(invoice)}
              {approximate ? " (aproximado)" : ""}
            </Text>
            <Text
              style={{ color: t.text.tertiary, fontSize: 11, marginTop: 2 }}
            >
              {open
                ? `Fecha em ${formatDayMonth(invoice.closingDate)}`
                : (due ?? "Sem data de vencimento informada")}
              {" · "}
              {count} {count === 1 ? "lançamento" : "lançamentos"}
            </Text>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text
              style={{
                // Estorno maior que compras: o rótulo vira "CRÉDITO" e ganha
                // cor, senão um saldo A FAVOR se lê como dívida
                color: credited ? t.chart.up : t.text.tertiary,
                fontSize: 10,
                fontWeight: "700",
              }}
            >
              {invoiceAmountLabel(invoice)}
            </Text>
            {/* Valor por extenso: esta é a superfície em que o usuário compara
                com o app do banco, e abreviação some com os centavos. O sinal
                é o do servidor — trocá-lo por módulo já seria recalcular */}
            <Text
              style={{
                ...typography.numericMd,
                color: credited ? t.chart.up : t.text.primary,
                marginTop: 2,
              }}
            >
              {formatBRL(invoice.total)}
            </Text>
            <ChevronDown
              size={18}
              color={t.text.tertiary}
              style={{
                marginTop: spacing[1],
                transform: [{ rotate: expanded ? "180deg" : "0deg" }],
              }}
            />
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            marginTop: spacing[3],
            gap: spacing[2],
          }}
        >
          {breakdown.map((row) => (
            <View
              key={row.key}
              accessible
              accessibilityLabel={`${row.label}: ${formatBRL(row.value)}${
                row.hint ? `, ${row.hint}` : ""
              }`}
              style={{
                backgroundColor: t.background.elevated,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: t.border.subtle,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
                flexGrow: 1,
                minWidth: 132,
              }}
            >
              <Text
                style={{
                  color: t.text.tertiary,
                  fontSize: 10,
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {row.label}
              </Text>
              <Text
                style={{
                  // Estorno é dinheiro voltando (up); pagamento fica neutro de
                  // propósito — pintá-lo de verde o venderia como receita
                  color:
                    row.key === "refunds" ? t.chart.up : t.text.primary,
                  fontSize: 13,
                  fontWeight: "700",
                  marginTop: 1,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {formatBRL(row.value)}
              </Text>
              {row.hint ? (
                <Text
                  style={{ color: t.text.tertiary, fontSize: 10, marginTop: 1 }}
                >
                  {row.hint}
                </Text>
              ) : null}
            </View>
          ))}
        </View>

        {/* A fatura que o BANCO fechou. Entra ANTES da reserva porque ela
            fala do mesmo número que o topo do card — e quando os dois
            discordam, é porque falta lançamento aqui, não porque o banco
            errou. Ver utils/providerBill.ts */}
        {comparacao ? (
          <View
            accessible
            accessibilityLabel={`${comparacao.headline}. ${comparacao.detail}`}
            style={{
              marginTop: spacing[2],
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[2],
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor:
                comparacao.agreement === "faltando" ? t.chart.down : t.border.subtle,
              backgroundColor: t.background.elevated,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Landmark
                size={14}
                color={
                  comparacao.agreement === "faltando" ? t.chart.down : t.text.tertiary
                }
              />
              <Text
                style={{
                  color:
                    comparacao.agreement === "faltando" ? t.chart.down : t.text.primary,
                  fontSize: 12,
                  fontWeight: "700",
                  marginLeft: spacing[2],
                  flex: 1,
                }}
              >
                {comparacao.headline}
              </Text>
            </View>
            <Text
              style={{
                color: t.text.tertiary,
                fontSize: 11,
                lineHeight: 15,
                marginTop: 2,
              }}
            >
              {comparacao.detail}
            </Text>
            {linhaDoBanco ? (
              <Text
                style={{
                  color: t.text.secondary,
                  fontSize: 11,
                  fontWeight: "700",
                  marginTop: 2,
                }}
              >
                {linhaDoBanco}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Reserva (EC-181): dinheiro que JÁ está separado para esta fatura.
            Fica FORA da fileira de chips de propósito — aqueles três são do
            que o ciclo gerou, e reserva não é lançamento: nada saiu da conta */}
        {reserve && reading ? (
          <Pressable
            onPress={onEditReserve ? () => onEditReserve(invoice) : undefined}
            disabled={!onEditReserve}
            accessibilityRole={onEditReserve ? "button" : undefined}
            accessibilityLabel={`Reservado ${formatBRL(reserve.amount)}${
              reserve.heldInAccountName ? ` em ${reserve.heldInAccountName}` : ""
            }, ${describeCoverage(reading)}${
              onEditReserve ? ". Tocar para alterar" : ""
            }`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: spacing[2],
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[2],
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: t.border.subtle,
              backgroundColor: t.background.elevated,
            }}
          >
            <PiggyBank size={16} color={t.chart.up} />
            <Text
              style={{
                color: t.text.primary,
                fontSize: 12,
                fontWeight: "700",
                marginLeft: spacing[2],
                fontVariant: ["tabular-nums"],
              }}
            >
              {formatBRL(reserve.amount)}
            </Text>
            <Text
              style={{ color: t.text.tertiary, fontSize: 12, marginLeft: spacing[2] }}
              numberOfLines={1}
            >
              separado · {describeCoverage(reading)}
              {reserve.heldInAccountName ? ` · ${reserve.heldInAccountName}` : ""}
            </Text>
          </Pressable>
        ) : onEditReserve ? (
          <Pressable
            onPress={() => onEditReserve(invoice)}
            accessibilityRole="button"
            accessibilityLabel="Separar dinheiro para esta fatura"
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: spacing[2],
              paddingVertical: spacing[1],
            }}
          >
            <PiggyBank size={14} color={t.text.tertiary} />
            <Text
              style={{ color: t.text.tertiary, fontSize: 12, marginLeft: spacing[2] }}
            >
              Separar dinheiro para esta fatura
            </Text>
          </Pressable>
        ) : null}
      </TouchableOpacity>

      {expanded && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: t.border.subtle,
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[2],
          }}
        >
          {invoice.transactions.length === 0 ? (
            <Text
              style={{
                color: t.text.tertiary,
                fontSize: 12,
                paddingVertical: spacing[3],
              }}
            >
              Esta fatura não trouxe os lançamentos.
            </Text>
          ) : (
            invoice.transactions.map((tx, index) => (
              // A MESMA linha do Extrato e da Revisão, na densidade de lista.
              // A voz é a do cartão: aqui débito é compra e crédito é estorno
              // ou pagamento — chamar compra de "saída" descreveria a conta
              // corrente. Sem origem: todas as linhas são deste cartão
              <TransactionRow
                key={tx.id}
                transaction={tx}
                density="list"
                voice="card"
                category={
                  tx.categoryId ? categories.get(tx.categoryId) : undefined
                }
                onPress={onOpenTransaction}
                divider={index < invoice.transactions.length - 1}
              />
            ))
          )}
        </View>
      )}
    </View>
  );
}
