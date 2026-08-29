import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import ChevronDown from "lucide-react-native/dist/esm/icons/chevron-down";

import type { AccountInvoice, BankTransaction, Category } from "../services/api";
import type { AppTheme } from "../theme/colors";
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
import { formatDayMonth, formatDayMonthShort } from "../utils/cycleWindow";
import { formatBRL } from "../utils/money";
import {
  isRenamed,
  transactionDisplayName,
  transactionOriginalName,
} from "../utils/transactions";
import CategoryIcon from "./CategoryIcon";

interface InvoiceCardProps {
  invoice: AccountInvoice;
  /** Ciclo derivado pela API (`CALENDAR_MONTH`): o período é aproximado. */
  approximate: boolean;
  expanded: boolean;
  onToggle: () => void;
  onOpenTransaction: (transaction: BankTransaction) => void;
  categories: Map<string, Category>;
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
}: InvoiceCardProps) {
  const t = useTheme();
  const open = invoice.open;
  const credited = invoiceIsCredit(invoice);
  const breakdown = invoiceBreakdown(invoice);
  const due = invoiceDueLabel(invoice);
  const count = invoice.transactionCount;

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
                marginTop: 3,
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
            invoice.transactions.map((tx) => {
              const category = tx.categoryId
                ? categories.get(tx.categoryId)
                : undefined;
              const credit = tx.type === "CREDIT";
              const renamed = isRenamed(tx);
              const name = transactionDisplayName(tx);
              const pending =
                tx.reviewStatus && tx.reviewStatus !== "CONFIRMED";

              return (
                <TouchableOpacity
                  key={tx.id}
                  onPress={() => onOpenTransaction(tx)}
                  accessibilityLabel={`${
                    renamed
                      ? `${name}, no banco: ${transactionOriginalName(tx)}`
                      : name
                  }, ${formatDayMonthShort(tx.date)}, ${
                    credit ? "crédito" : "compra"
                  } de ${formatBRL(Math.abs(tx.amount))}, ${
                    category ? category.name : "sem categoria"
                  }${pending ? ", aguardando revisão" : ""}. Abrir detalhes`}
                  accessibilityRole="button"
                  activeOpacity={0.7}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    minHeight: 44,
                    paddingVertical: spacing[2],
                  }}
                >
                  <Text
                    style={{
                      color: t.text.tertiary,
                      fontSize: 11,
                      width: 46,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {formatDayMonthShort(tx.date)}
                  </Text>
                  {/* AppTheme tipa hexas literais do dark; os temas são
                      estruturalmente idênticos, então o cast é seguro */}
                  <CategoryIcon
                    category={category}
                    theme={t as AppTheme}
                    size={24}
                  />
                  <View style={{ flex: 1, marginHorizontal: spacing[2] }}>
                    <Text
                      numberOfLines={1}
                      style={{ color: t.text.primary, fontSize: 12 }}
                    >
                      {name}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: pending ? t.semantic.warning : t.text.tertiary,
                        fontSize: 10,
                        marginTop: 1,
                      }}
                    >
                      {category ? category.name : "Sem categoria"}
                      {pending ? " · revisar" : ""}
                    </Text>
                  </View>
                  <Text
                    style={{
                      // Crédito no cartão (estorno ou pagamento) abate; compra
                      // soma. O sinal é o que separa os dois na leitura rápida
                      color: credit ? t.chart.up : t.text.primary,
                      fontSize: 12,
                      fontWeight: "700",
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {credit ? "+ " : "- "}
                    {formatBRL(Math.abs(tx.amount))}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}
