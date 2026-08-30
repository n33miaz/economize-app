import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import FileText from "lucide-react-native/dist/esm/icons/file-text";
import Plus from "lucide-react-native/dist/esm/icons/plus";
import Trash2 from "lucide-react-native/dist/esm/icons/trash-2";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "../utils/haptics";
import Animated from "react-native-reanimated";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { useMotionPresets, usePressScale } from "../theme/motionPresets";
import {
  Report,
  ReportPeriod,
  useReportsStore,
} from "../store/reportsStore";
import { useToastStore } from "../store/toastStore";
import { askConfirm } from "../store/confirmStore";
import {
  usePreferencesStore,
  selectCycleAnchorDay,
} from "../store/preferencesStore";
import ScreenHeader from "../components/ScreenHeader";
import PageContainer from "../components/PageContainer";
import Skeleton from "../components/Skeleton";
import AssistantFAB, {
  ASSISTANT_FAB_HEIGHT,
} from "../components/AssistantFAB";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { padRowsForColumns } from "../utils/layout";
import { formatBRL, formatBRLCompact } from "../utils/money";
import {
  cycleWindowContaining,
  formatDayMonthShort,
  todayIso,
} from "../utils/cycleWindow";

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  WEEKLY: "Semanais",
  MONTHLY: "Mensais",
  YEARLY: "Anuais",
};

function ReportCard({ item, index }: { item: Report; index: number }) {
  const t = useTheme();
  // Entrada em cascata acompanha a posição do card na lista
  const { listItemEntering } = useMotionPresets();
  const remove = useReportsStore((s) => s.remove);
  const showToast = useToastStore((s) => s.showToast);
  const saldo = item.totalIncome - item.totalExpense;
  const positivo = saldo >= 0;

  // EC-038: o endpoint com dono validado e o `remove` do store existiam desde
  // 2026-08-10; faltava só quem chamasse. Excluir é destrutivo e sem desfazer,
  // então passa pelo diálogo — nunca direto no toque
  const excluir = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    askConfirm({
      title: "Excluir este relatório?",
      message: `O relatório de ${formatDayMonthShort(item.startDate)} a ${formatDayMonthShort(
        item.endDate,
      )} será apagado. Não dá para desfazer, mas você pode gerar de novo.`,
      confirmLabel: "Excluir",
      destructive: true,
      onConfirm: async () => {
        // O retorno é a resposta do servidor, não a leitura de um estado que
        // pode carregar erro de uma tentativa anterior
        if (await remove(item.id)) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showToast("Relatório excluído.", "success");
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          showToast("Não foi possível excluir o relatório.", "error");
        }
      },
    });
  };

  return (
    <Animated.View
      entering={listItemEntering(index)}
      style={{
        backgroundColor: t.background.elevated,
        borderRadius: radius.xl,
        padding: spacing[4],
        borderWidth: 1,
        borderColor: t.border.subtle,
        marginBottom: spacing[3],
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: spacing[2],
        }}
      >
        <Text
          style={{
            color: t.text.tertiary,
            fontSize: 11,
            fontWeight: "700",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {PERIOD_LABELS[item.period]}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ color: t.text.secondary, fontSize: 12 }}>
            {/* Em UTC: o início do relatório mensal é o dia da âncora escolhida
                pelo usuário (mandado como meia-noite UTC), e no fuso do aparelho
                ele aparecia como véspera — "11 ago" para quem escolheu o dia 12 */}
            {formatDayMonthShort(item.startDate)} →{" "}
            {formatDayMonthShort(item.endDate)}
          </Text>
          <TouchableOpacity
            onPress={excluir}
            accessibilityRole="button"
            accessibilityLabel={`Excluir relatório de ${formatDayMonthShort(
              item.startDate,
            )} a ${formatDayMonthShort(item.endDate)}`}
            // O ícone tem 16 px para não competir com os números do card; o
            // hitSlop leva a área de toque aos 44 px que a a11y exige
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            style={{ marginLeft: spacing[3] }}
          >
            <Trash2 size={16} color={t.text.tertiary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Três valores dividem a largura do card, e o card já pode estar numa
          grade de duas colunas: um terço de meia tela não comporta
          "R$ 128.430,17" em 14 px. Abreviar mantém os três alinhados — e cada
          um leva o valor por extenso no rótulo acessível */}
      <View style={{ flexDirection: "row", marginBottom: spacing[3] }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text.tertiary, fontSize: 11 }}>
            Receitas
          </Text>
          <Text
            numberOfLines={1}
            accessibilityLabel={`Receitas: ${formatBRL(item.totalIncome)}`}
            style={{
              color: t.semantic.success,
              fontWeight: "700",
              fontSize: 14,
            }}
          >
            {formatBRLCompact(item.totalIncome)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text.tertiary, fontSize: 11 }}>
            Despesas
          </Text>
          <Text
            numberOfLines={1}
            accessibilityLabel={`Despesas: ${formatBRL(item.totalExpense)}`}
            style={{
              color: t.semantic.danger,
              fontWeight: "700",
              fontSize: 14,
            }}
          >
            {formatBRLCompact(item.totalExpense)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text.tertiary, fontSize: 11 }}>
            Saldo
          </Text>
          <Text
            numberOfLines={1}
            accessibilityLabel={`Saldo: ${formatBRL(saldo)}`}
            style={{
              // Delta financeiro usa o verde semântico, nunca o accent da marca
              color: positivo
                ? t.semantic.success
                : t.semantic.danger,
              fontWeight: "700",
              fontSize: 14,
            }}
          >
            {formatBRLCompact(saldo)}
          </Text>
        </View>
      </View>

      {item.dominantCategory && (
        <View
          style={{
            alignSelf: "flex-start",
            backgroundColor: t.accent.neonMuted,
            paddingHorizontal: spacing[3],
            paddingVertical: 4,
            borderRadius: radius.full,
            marginBottom: spacing[2],
          }}
        >
          <Text
            style={{
              color: t.accent.neon,
              fontSize: 11,
              fontWeight: "700",
            }}
          >
            Categoria dominante · {item.dominantCategory}
          </Text>
        </View>
      )}

      {item.summary && (
        <Text
          style={{
            color: t.text.secondary,
            fontSize: 13,
            lineHeight: 19,
          }}
        >
          {item.summary}
        </Text>
      )}
    </Animated.View>
  );
}

export default function Reports() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const generatePress = usePressScale();
  // Card de relatório é bloco fechado e de altura parecida — o caso em que
  // uma grade de duas colunas ganha o dobro de leitura sem custo nenhum
  const { columns } = useBreakpoint();
  const { items, isLoading, isGenerating, fetch, generate } = useReportsStore();
  const showToast = useToastStore((s) => s.showToast);
  const anchorDay = usePreferencesStore(selectCycleAnchorDay);
  const [tab, setTab] = useState<ReportPeriod>("MONTHLY");

  useEffect(() => {
    fetch(tab);
  }, [tab]);

  const filtered = useMemo(
    () => items.filter((item) => item.period === tab),
    [items, tab],
  );

  // Memoizado porque o preenchimento da última linha devolve array NOVO
  // sempre que sobra vaga: inline, a `data` da FlatList mudava de identidade
  // a cada render do pai e a lista inteira se dava por alterada
  const rows = useMemo(
    () => padRowsForColumns(filtered, columns),
    [filtered, columns],
  );

  const handleGenerate = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const now = new Date();
    const start = new Date(now);
    if (tab === "MONTHLY") {
      // O relatório mensal passa a fechar o CICLO do usuário em vez de "os
      // últimos 30 dias": a mesma âncora que rege a Home e a Análise. O fim
      // continua sendo agora — um relatório que terminasse no futuro venderia
      // um mês fechado que ainda está acontecendo.
      const window = cycleWindowContaining(anchorDay, todayIso(now));
      start.setTime(Date.parse(`${window.start}T00:00:00.000Z`));
    } else if (tab === "WEEKLY") {
      start.setDate(start.getDate() - 7);
    } else {
      start.setFullYear(start.getFullYear() - 1);
    }
    const created = await generate(tab, start.toISOString(), now.toISOString());
    if (!created) {
      showToast(
        "Geração falhou. Tente de novo; se persistir, importe um extrato primeiro.",
        "error",
      );
    }
  };

  return (
    <PageContainer>
      <ScreenHeader
        title="Relatórios"
        subtitle="Consolidado por período"
        showProfileButton={false}
        rightActions={[
          // Gerar como action do header: o rodapé fica livre para o
          // AssistantFAB, sem cálculo mágico de largura para desviar dele
          <Animated.View key="generate" style={generatePress.pressStyle}>
            <TouchableOpacity
              onPress={handleGenerate}
              onPressIn={generatePress.onPressIn}
              onPressOut={generatePress.onPressOut}
              disabled={isGenerating}
              accessibilityLabel="Gerar relatório"
              accessibilityRole="button"
              activeOpacity={0.85}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: t.accent.neon,
                paddingHorizontal: spacing[3],
                height: 36,
                borderRadius: radius.full,
                opacity: isGenerating ? 0.7 : 1,
              }}
            >
              {isGenerating ? (
                <ActivityIndicator
                  size="small"
                  color={t.text.inverse}
                />
              ) : (
                <>
                  <Plus size={16} color={t.text.inverse} />
                  <Text
                    style={{
                      color: t.text.inverse,
                      fontWeight: "700",
                      fontSize: 12,
                      marginLeft: spacing[1],
                    }}
                  >
                    Gerar
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>,
        ]}
      />

      <View
        style={{
          flexDirection: "row",
          gap: spacing[2],
          paddingHorizontal: spacing[5],
          paddingTop: spacing[4],
        }}
      >
        {(Object.keys(PERIOD_LABELS) as ReportPeriod[]).map((p) => {
          const active = p === tab;
          return (
            <TouchableOpacity
              key={p}
              onPress={() => setTab(p)}
              activeOpacity={0.8}
              style={{
                flex: 1,
                paddingVertical: spacing[2],
                borderRadius: radius.full,
                alignItems: "center",
                backgroundColor: active
                  ? t.accent.neon
                  : t.background.elevated,
                borderWidth: 1,
                borderColor: active
                  ? t.accent.neon
                  : t.border.subtle,
              }}
            >
              <Text
                style={{
                  color: active
                    ? t.text.inverse
                    : t.text.primary,
                  fontWeight: "700",
                  fontSize: 12,
                }}
              >
                {PERIOD_LABELS[p]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        // O RN não aceita `numColumns` mudando em voo: a chave remonta a lista
        // quando a janela cruza o breakpoint
        key={`grade-${columns}`}
        data={rows}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? { gap: spacing[3] } : undefined}
        keyExtractor={(item, index) => item?.id ?? `vago-${index}`}
        contentContainerStyle={{
          padding: spacing[5],
          // O rodapé só precisa caber o que flutua sobre a lista: o FAB do
          // assistente. Os 120 fixos vinham da época em que essa reserva era
          // chutada — no desktop sobrava meio card de nada no fim da grade
          paddingBottom:
            insets.bottom + spacing[5] + ASSISTANT_FAB_HEIGHT + spacing[4],
        }}
        renderItem={({ item, index }) => (
          // O buraco da última linha ocupa a coluna sem desenhar nada — sem
          // ele, um relatório sozinho no fim esticaria por toda a largura.
          // O `flex: 1` só existe na grade: numa coluna só, ele seria um filho
          // flexível dentro de um contêiner de rolagem sem altura definida.
          <View style={columns > 1 ? { flex: 1 } : undefined}>
            {item && <ReportCard item={item} index={index} />}
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => fetch(tab)}
            tintColor={t.accent.neon}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <View>
              {[1, 2, 3].map((i) => (
                <View key={i} style={{ marginBottom: spacing[3] }}>
                  <Skeleton width="100%" height={120} borderRadius={16} />
                </View>
              ))}
            </View>
          ) : (
            <View style={{ alignItems: "center", marginTop: spacing[10] }}>
              <FileText size={48} color={t.text.tertiary} />
              <Text
                style={{
                  color: t.text.secondary,
                  marginTop: spacing[3],
                  textAlign: "center",
                  paddingHorizontal: spacing[6],
                }}
              >
                Nenhum relatório {PERIOD_LABELS[tab].toLowerCase()} ainda. Toque
                em "Gerar" para criar o primeiro.
              </Text>
            </View>
          )
        }
      />

      <AssistantFAB />
    </PageContainer>
  );
}
