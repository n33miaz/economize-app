import React from "react";
import { Text, View } from "react-native";
import TriangleAlert from "lucide-react-native/dist/esm/icons/triangle-alert";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { formatBRL } from "../utils/money";
import type { BalanceFinding } from "../services/api";

interface Props {
  findings: BalanceFinding[];
}

/**
 * O que a instituição diz e o que a tela mostra, quando discordam (EC-196).
 *
 * <p>O defeito que isto existe para não repetir foi visto no concorrente: a
 * tela de saldos dizia R$ 0,00 com o carimbo "Atualizado agora" enquanto a
 * tela de Conexões, no mesmo minuto, dizia que a última leitura tinha 11
 * horas. Não havia aviso porque não havia com quem conferir.
 *
 * <p>A frase vem da API, não daqui. É lá que mora a regra que decidiu haver
 * problema; repetir a explicação na tela criaria duas versões da mesma
 * verdade, e uma delas ficaria para trás. A tela acrescenta só o que é
 * apresentação: o valor formatado em reais.
 */
export default function BalanceCheckNotice({ findings }: Props) {
  const t = useTheme();
  if (findings.length === 0) return null;

  return (
    <View
      accessible
      accessibilityRole="alert"
      // Anúncio automático no Android: um aviso sobre o número que o usuário
      // está lendo não pode depender de ele tropeçar no bloco
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: t.semantic.warningMuted,
        borderRadius: radius.lg,
        padding: spacing[3],
        marginBottom: spacing[3],
        gap: spacing[2],
      }}
    >
      {findings.map((achado) => (
        <View
          key={`${achado.accountId}-${achado.kind}`}
          style={{ flexDirection: "row", gap: spacing[2] }}
        >
          <TriangleAlert size={16} color={t.semantic.warning} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: t.text.primary, fontSize: 12, fontWeight: "700" }}
              numberOfLines={1}
            >
              {achado.accountName}
            </Text>
            <Text style={{ color: t.text.secondary, fontSize: 12, lineHeight: 17 }}>
              {achado.message}
            </Text>
            {achado.movementAfter !== null && achado.movementAfter !== 0 ? (
              <Text style={{ color: t.text.secondary, fontSize: 12, lineHeight: 17 }}>
                Desde então: {formatBRL(achado.movementAfter)}.
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}
