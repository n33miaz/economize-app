import React, { useMemo } from "react";
import { Text, TouchableOpacity } from "react-native";
import ChevronRight from "lucide-react-native/dist/esm/icons/chevron-right";
import ShoppingBasket from "lucide-react-native/dist/esm/icons/shopping-basket";
import { useNavigation } from "@react-navigation/native";

import { APP_ROUTES } from "../routes/routeNames";
import { useWishStore } from "../store/wishStore";
import { useTheme } from "../theme/ThemeProvider";
import { spacing } from "../theme/ds";
import { describeWeekdayDate } from "../utils/cycleWindow";
import { homeLine } from "../utils/purchaseDay";

/**
 * A linha da Home: "Melhor dia para as compras: sáb 03/10 · o vale cai por
 * volta de 28/09" (EC-237).
 *
 * <p>É UMA linha, e não um tile, de propósito: o `MetricTile` só aceita
 * número, e a resposta aqui é uma data com motivo. Ela mora dentro do card
 * "A vencer", logo depois de "cai em N dias", porque é a mesma pergunta —
 * quando o dinheiro chega — vista pelo lado de quem vai gastá-lo.
 *
 * <p>Autossuficiente: lê o store sozinha e só existe com `READY`. Sem padrão
 * (servidor antigo, histórico curto, sem renda) ela não desenha nada — a
 * Home não é lugar de explicar ausência; a Previsão é.
 */
export default function PurchaseDayLine() {
  const t = useTheme();
  const navigation = useNavigation();
  const pattern = useWishStore((s) => s.incomePattern);
  const linha = useMemo(() => homeLine(pattern), [pattern]);

  if (!linha) return null;

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate(APP_ROUTES.previsao as never)}
      accessibilityRole="button"
      accessibilityLabel={`Melhor dia para as compras: ${describeWeekdayDate(
        linha.spokenDay,
      )}${linha.detail ? `, ${linha.detail}` : ""}. Abrir a previsão`}
      activeOpacity={0.7}
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 36,
        marginTop: spacing[2],
      }}
    >
      <ShoppingBasket size={14} color={t.text.secondary} />
      <Text
        numberOfLines={2}
        style={{
          flex: 1,
          marginLeft: spacing[2],
          color: t.text.secondary,
          fontSize: 12,
          lineHeight: 17,
        }}
      >
        Melhor dia para as compras:{" "}
        <Text
          style={{
            color: t.text.primary,
            fontWeight: "700",
            fontVariant: ["tabular-nums"],
          }}
        >
          {linha.day}
        </Text>
        {linha.detail ? ` · ${linha.detail}` : ""}
      </Text>
      <ChevronRight size={14} color={t.text.tertiary} />
    </TouchableOpacity>
  );
}
