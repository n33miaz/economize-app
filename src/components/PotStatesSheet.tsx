import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { spacing } from "../theme/ds";
import { formatBRL } from "../utils/money";
import { describePotReason, type CyclePerformance } from "../utils/pot";

import CustomModal from "./CustomModal";
import PotIcon, { potStateFor } from "./PotIcon";

/**
 * O anúncio do pote vivo (EC-147).
 *
 * <p>O pote deixou de ser um logo parado: ele conta como o ciclo está indo.
 * Mudança silenciosa em ícone lê como bug — ninguém descobre sozinho que a
 * marca virou indicador —, então a funcionalidade se apresenta uma vez e fica
 * acessível pelo próprio pote a partir daí.
 *
 * <p>Os exemplos são o componente REAL em cada estado, e não imagens: assim a
 * página nunca descreve um pote diferente do que o app desenha, e o tema do
 * usuário vale aqui como vale no resto.
 */

/** Os degraus, com o exemplo em dinheiro que torna a régua concreta. */
const ESTADOS = [
  { sobra: -400, entradas: 5000, exemplo: "Fechou no vermelho" },
  { sobra: 100, entradas: 5000, exemplo: "Sobrou pouco" },
  { sobra: 400, entradas: 5000, exemplo: "Sobrou o esperado" },
  { sobra: 1000, entradas: 5000, exemplo: "Sobrou bem" },
  { sobra: 1600, entradas: 5000, exemplo: "Guardou 30% ou mais" },
] as const;

export default function PotStatesSheet({
  visible,
  onClose,
  performance,
}: {
  visible: boolean;
  onClose: () => void;
  performance: CyclePerformance | null;
}) {
  const t = useTheme();

  const atual =
    performance && performance.income > 0
      ? potStateFor(performance.kept, performance.income)
      : null;
  const motivo = describePotReason(performance);

  return (
    <CustomModal visible={visible} onClose={onClose}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing[5],
          paddingTop: spacing[3],
          paddingBottom: spacing[6],
        }}
      >
        <Text className="text-xl font-bold text-textPrimary">
          Seu pote conta o mês
        </Text>
        <Text className="text-xs text-textSecondary mt-1">
          O pote do Economize! não é só um desenho: ele enche e esvazia conforme
          o quanto sobrou no seu ciclo.
        </Text>

        {/* O estado de hoje primeiro: o exemplo mais convincente é o dele */}
        {atual && (
          <View
            className="flex-row items-center rounded-2xl p-4 mt-4"
            style={{ backgroundColor: t.accent.neonMuted }}
          >
            <PotIcon size={56} level={atual.level} tone={atual.tone} />
            <View className="flex-1 ml-4">
              <Text className="text-[11px] text-textSecondary">
                Seu ciclo agora
              </Text>
              <Text className="text-base font-bold text-textPrimary">
                {atual.label}
              </Text>
              {performance && (
                <Text className="text-xs text-textSecondary mt-0.5">
                  {formatBRL(performance.kept)} guardados de{" "}
                  {formatBRL(performance.income)} que entraram
                </Text>
              )}
            </View>
          </View>
        )}

        {motivo && (
          <Text className="text-xs text-textSecondary mt-3">{motivo}.</Text>
        )}

        <Text className="text-[11px] font-bold text-textSecondary mt-5 mb-2">
          OS ESTADOS
        </Text>

        {ESTADOS.map((estado) => {
          const state = potStateFor(estado.sobra, estado.entradas);
          return (
            <View
              key={estado.exemplo}
              className="flex-row items-center bg-cardBackground rounded-xl p-3 mb-2 border border-border"
            >
              <PotIcon size={40} level={state.level} tone={state.tone} />
              <View className="flex-1 ml-3">
                <Text className="text-sm font-bold text-textPrimary">
                  {state.label}
                </Text>
                <Text className="text-[11px] text-textSecondary mt-0.5">
                  {estado.exemplo} — {formatBRL(estado.sobra)} de{" "}
                  {formatBRL(estado.entradas)}
                </Text>
              </View>
            </View>
          );
        })}

        <View
          className="rounded-xl p-3 mt-3"
          style={{ backgroundColor: t.background.elevated }}
        >
          <Text className="text-xs text-textSecondary">
            <Text className="font-bold text-textPrimary">
              Investir não conta como gastar.
            </Text>{" "}
            O extrato registra a aplicação como saída, mas para o pote ela é o
            contrário: dinheiro que você guardou de outro jeito.
          </Text>
        </View>

        <Text className="text-[11px] text-textSecondary mt-3">
          Sem dados do ciclo, o pote aparece pela metade e em tom neutro — nunca
          no vermelho. Não medimos, então não julgamos.
        </Text>

        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Entendi"
          className="h-14 rounded-xl items-center justify-center mt-5"
          style={{ backgroundColor: t.accent.neon }}
        >
          <Text className="font-bold text-base" style={{ color: t.text.inverse }}>
            Entendi
          </Text>
        </Pressable>
      </ScrollView>
    </CustomModal>
  );
}
