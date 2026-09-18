import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Tag from "lucide-react-native/dist/esm/icons/tag";

import type {
  BankTransaction,
  Category,
  ConnectorAccount,
} from "../services/api";
import type { AppTheme } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import {
  SUPPORT_SEPARATOR,
  amountLabel,
  amountTone,
  rowBadges,
  spokenLabel,
  supportLineParts,
  type AmountTone,
  type TransactionRowVoice,
} from "../utils/transactionRow";
import {
  isRenamed,
  transactionDisplayName,
  transactionOriginalName,
} from "../utils/transactions";
import Badge from "./Badge";
import CategoryIcon from "./CategoryIcon";
import MemberBadge from "./MemberBadge";
import OriginBadge from "./OriginBadge";

/**
 * `card` é a linha do Extrato: cada lançamento é um card próprio, com ícone
 * maior e título em duas linhas. `list` é a linha DENTRO de um card (Fatura,
 * Revisão): mais densa, com divisor opcional.
 */
export type TransactionRowDensity = "card" | "list";

/** Altura da linha `card` sem selos: o esqueleto do Extrato imita esta geometria. */
export const TRANSACTION_ROW_CARD_HEIGHT = 72;

/** Teto de selos na linha do Extrato (escolha 8: "no máximo dois"). */
export const MAX_BADGES_CARD = 2;

export interface TransactionRowMember {
  memberId: string;
  memberName: string;
  isMe: boolean;
}

export interface TransactionRowProps {
  transaction: BankTransaction;
  /** Resolvida pela tela (`catById.get`); ausente = sem categoria. */
  category?: Pick<
    Category,
    "name" | "color" | "icon" | "systemKey" | "parentSystemKey"
  > | null;
  /** Resolvida pela tela (`accountsById.get`); ausente é estado normal. */
  account?: ConnectorAccount | null;
  /** Só quando a tela tem origem como dimensão real (mesma regra do Extrato). */
  showOrigin?: boolean;
  /** Falso quando a categoria já está no contêiner (chip do grupo da Revisão). */
  showCategory?: boolean;
  /**
   * Falso quando a tela já diz a data em cima — o cabeçalho de dia do Extrato.
   */
  showDate?: boolean;
  /** Só na casa: de quem é a linha. */
  member?: TransactionRowMember | null;
  density?: TransactionRowDensity;
  /**
   * Como o valor é falado. Sem a prop, segue o tipo da conta resolvida: linha
   * de cartão fala "compra", linha de conta fala "saída".
   */
  voice?: TransactionRowVoice;
  /** Ausente = linha não interativa (lançamento de outra pessoa). */
  onPress?: (transaction: BankTransaction) => void;
  /** Divisor inferior na densidade `list`. */
  divider?: boolean;
}

/**
 * A anatomia por densidade. Todo `fontSize` é degrau da escala; a coluna do
 * valor tem largura mínima porque a web ignora `adjustsFontSizeToFit` e, sem
 * ela, "- R$ 99.999,99" quebrava em duas linhas a 390 px.
 */
const DENSITY = {
  card: {
    icon: 40,
    gap: spacing[3],
    title: { fontSize: 14, lineHeight: 20, fontWeight: "700" as const },
    titleLines: 2,
    support: { fontSize: 12, lineHeight: 16 },
    amount: { fontSize: 15, lineHeight: 20, minWidth: 96 },
    badgesTop: spacing[2],
  },
  list: {
    icon: 32,
    gap: spacing[2],
    title: { fontSize: 13, lineHeight: 18, fontWeight: "600" as const },
    titleLines: 1,
    support: { fontSize: 11, lineHeight: 14 },
    amount: { fontSize: 13, lineHeight: 18, minWidth: 88 },
    badgesTop: spacing[1],
  },
} as const;

type Theme = ReturnType<typeof useTheme>;

/**
 * A cor do tom, no tema. Fica aqui (e não nas regras puras) porque é a única
 * parte da regra que depende do tema — e a folha de detalhes usa a MESMA
 * função, para o valor lá não discordar do valor da linha.
 */
export function amountColor(t: Theme, tone: AmountTone): string {
  if (tone === "up") return t.chart.up;
  if (tone === "muted") return t.text.tertiary;
  return t.text.primary;
}

/**
 * Uma linha de lançamento, igual em toda tela que lista lançamentos.
 *
 * O disco à esquerda é a CATEGORIA, não a direção do dinheiro: a direção já
 * está no sinal e na cor do valor, e repeti-la num disco de 48 px gastava o
 * lugar mais visível da linha com a informação mais redundante. Sem categoria
 * o disco fica com a etiqueta neutra, que é o próprio convite a categorizar.
 *
 * Débito é neutro de propósito: gastar não é erro, e um extrato inteiro em
 * vermelho não destaca nada. O verde fica só para o que entrou.
 */
export default function TransactionRow({
  transaction,
  category,
  account,
  showOrigin = false,
  showCategory = true,
  showDate = true,
  member,
  density = "list",
  voice,
  onPress,
  divider = false,
}: TransactionRowProps) {
  const t = useTheme();
  const geometry = DENSITY[density];
  const interactive = Boolean(onPress);
  const spokenVoice: TransactionRowVoice =
    voice ?? (account?.type === "CREDIT_CARD" ? "card" : "bank");

  const name = transactionDisplayName(transaction);
  const renamed = isRenamed(transaction);
  const parts = supportLineParts({
    tx: transaction,
    categoryName: category?.name,
    showCategory,
    account,
    showOrigin,
    showDate,
  });
  // Teto de dois selos na densidade de card (escolha 8: "selos vivem só na
  // segunda linha, no máximo dois"). Cinco selos podiam coexistir — Revisar,
  // Ignorada, Entre contas, Na casa, Estornada — e a linha crescia até três
  // alturas por causa deles.
  //
  // O que se perde não se perde de vez: `rowBadges` já ordena pelo que pede
  // AÇÃO primeiro, então "Revisar" nunca é cortado; o resto continua inteiro
  // no rótulo falado (`spokenLabel`, logo abaixo, usa a transação e não esta
  // lista) e na folha de detalhes, que é o destino de um toque na linha
  const badges =
    density === "card"
      ? rowBadges(transaction).slice(0, MAX_BADGES_CARD)
      : rowBadges(transaction);
  // Sem conta mapeada a origem vira selo, não texto de apoio — é o que
  // separa "não informada" (histórico de arquivo) de "não reconhecida"
  const originAsBadge = showOrigin && !account;
  const hasBadgeRow = badges.length > 0 || originAsBadge || Boolean(member);

  const label = spokenLabel({
    tx: transaction,
    voice: spokenVoice,
    categoryName: category?.name,
    showCategory,
    account,
    showOrigin,
    member,
    interactive,
  });

  return (
    <TouchableOpacity
      onPress={onPress ? () => onPress(transaction) : undefined}
      disabled={!interactive}
      accessibilityLabel={label}
      accessibilityRole={interactive ? "button" : "text"}
      activeOpacity={interactive ? 0.8 : 1}
      style={
        density === "card"
          ? {
              flexDirection: "row",
              alignItems: "center",
              minHeight: TRANSACTION_ROW_CARD_HEIGHT,
              backgroundColor: t.background.surface,
              borderRadius: radius["2xl"],
              borderWidth: 1,
              borderColor: t.border.subtle,
              padding: spacing[4],
              marginBottom: spacing[3],
            }
          : {
              flexDirection: "row",
              alignItems: "center",
              // 44 é o mínimo da regra §5.8; 56 dá à linha densa espaço para
              // título e apoio sem o polegar errar
              minHeight: 56,
              paddingVertical: spacing[2],
              borderBottomWidth: divider ? 1 : 0,
              borderBottomColor: t.border.subtle,
            }
      }
    >
      {/* Sem categoria na linha (Revisão) o disco também sai: ela mora no
          cabeçalho do grupo, e um disco neutro repetido em cada linha seriam
          32 px dizendo nada. AppTheme tipa hexas literais do dark; os temas
          são estruturalmente idênticos, então o cast da união é seguro */}
      {showCategory && (
        <CategoryIcon
          category={category}
          theme={t as AppTheme}
          size={geometry.icon}
        />
      )}

      <View
        style={{
          flex: 1,
          marginLeft: showCategory ? geometry.gap : 0,
          marginRight: spacing[2],
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {renamed && (
            // A etiqueta marca a linha apelidada; o texto do banco vem logo
            // abaixo para o apelido nunca esconder o original
            <Tag
              size={12}
              color={t.text.tertiary}
              style={{ marginRight: spacing[1] }}
            />
          )}
          <Text
            numberOfLines={geometry.titleLines}
            style={{ flex: 1, color: t.text.primary, ...geometry.title }}
          >
            {name}
          </Text>
        </View>
        {renamed && (
          <Text
            numberOfLines={1}
            style={{ color: t.text.tertiary, fontSize: 11, lineHeight: 14 }}
          >
            No banco: {transactionOriginalName(transaction)}
          </Text>
        )}
        {/* Cada parte é um Text próprio dentro do Text da linha: a categoria
            continua um nó de texto que se acha sozinho (e que se testa), e o
            conjunto ainda corta com uma elipse só */}
        <Text
          numberOfLines={1}
          style={{ color: t.text.tertiary, marginTop: 2, ...geometry.support }}
        >
          {parts.map((part, index) => (
            <React.Fragment key={`${index}-${part}`}>
              {index > 0 && <Text>{SUPPORT_SEPARATOR}</Text>}
              <Text>{part}</Text>
            </React.Fragment>
          ))}
        </Text>
        {hasBadgeRow && (
          // Selos quebram juntos: num iPhone SE origem e "Revisar" não cabem
          // lado a lado, e cortar o nome do cartão apagaria a resposta
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexWrap: "wrap",
              gap: spacing[1],
              marginTop: geometry.badgesTop,
            }}
          >
            {badges.map((badge) => (
              <Badge
                key={badge.key}
                label={badge.label}
                variant={badge.tone}
                accessibilityLabel={badge.spoken}
              />
            ))}
            {originAsBadge && (
              <OriginBadge
                accountId={transaction.accountId}
                account={account}
                maxLabelWidth={118}
              />
            )}
            {member && (
              <MemberBadge
                memberId={member.memberId}
                name={member.memberName}
                isMe={member.isMe}
              />
            )}
          </View>
        )}
      </View>

      <Text
        numberOfLines={1}
        style={{
          color: amountColor(t, amountTone(transaction)),
          fontWeight: "700",
          fontVariant: ["tabular-nums"],
          textAlign: "right",
          flexShrink: 0,
          ...geometry.amount,
        }}
      >
        {amountLabel(transaction)}
      </Text>
    </TouchableOpacity>
  );
}
