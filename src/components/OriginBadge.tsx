import React from "react";
import { Text, View } from "react-native";
import CircleQuestionMark from "lucide-react-native/dist/esm/icons/circle-question-mark";
import CreditCard from "lucide-react-native/dist/esm/icons/credit-card";
import Landmark from "lucide-react-native/dist/esm/icons/landmark";

import type { ConnectorAccount } from "../services/api";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { originLabel } from "../utils/accounts";
import { bankKeyFor } from "../utils/bankBrand";
import BankLogo from "./BankLogo";

interface OriginBadgeProps {
  /** O campo cru da transação — é ele que separa "sem origem" de "não achei". */
  accountId: string | null | undefined;
  /** A conta resolvida no mapa; `undefined` é estado normal, não falha. */
  account: ConnectorAccount | null | undefined;
  /** Teto de largura do rótulo — a lista é mais apertada que a folha. */
  maxLabelWidth?: number;
}

/**
 * De onde veio o lançamento (EC-113).
 *
 * A distinção entre cartão, conta e origem desconhecida é feita pelo ÍCONE, e
 * não por cor: cor semântica aqui diria "isto é bom/ruim" sobre um dado que é
 * só procedência, e o accent está reservado para identidade e interação. A
 * pílula fica no mesmo tom neutro do chip de categoria ao lado.
 *
 * Origem nula não é falha e não veste aviso — ela é a maioria do histórico de
 * quem importa OFX na mão.
 *
 * Quando a instituição é conhecida, o logo do banco entra no lugar do ícone:
 * reconhecer o roxo do Nubank é mais rápido do que ler o nome do cartão. O
 * ícone continua como plano B — e ele ainda distingue cartão de conta, coisa
 * que um logo sozinho não diz.
 */
export default function OriginBadge({
  accountId,
  account,
  maxLabelWidth = 130,
}: OriginBadgeProps) {
  const t = useTheme();
  const known = Boolean(account);
  const Icon = !account
    ? CircleQuestionMark
    : account.type === "CREDIT_CARD"
      ? CreditCard
      : Landmark;
  // A instituição decide o logo; o nome da conta só entra quando ele mesmo
  // carrega a marca ("Nubank Cartão"), nunca por aproximação
  const brand = account
    ? account.institution ?? (bankKeyFor(account.name) ? account.name : null)
    : null;
  const hasLogo = bankKeyFor(brand) !== null;
  const label = originLabel(accountId, account);

  return (
    <View
      // Nó acessível único: sem isto o leitor de tela lê o ícone e o texto como
      // dois elementos soltos no meio da linha da transação
      accessible
      accessibilityLabel={known ? `Origem: ${label}` : label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        minHeight: 24,
        borderRadius: radius.full,
        paddingHorizontal: spacing[2],
        paddingVertical: 2,
        backgroundColor: t.background.elevated,
        borderWidth: 1,
        borderColor: t.border.subtle,
      }}
    >
      {hasLogo ? (
        <BankLogo institution={brand} size={16} />
      ) : (
        <Icon size={12} color={t.text.tertiary} />
      )}
      <Text
        numberOfLines={1}
        style={{
          color: known ? t.text.secondary : t.text.tertiary,
          fontSize: 11,
          fontWeight: "600",
          marginLeft: spacing[1],
          maxWidth: maxLabelWidth,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
