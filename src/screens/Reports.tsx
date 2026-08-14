import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FileText, Plus } from "lucide-react-native";
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
import ScreenHeader from "../components/ScreenHeader";
import PageContainer from "../components/PageContainer";
import Skeleton from "../components/Skeleton";
import AssistantFAB from "../components/AssistantFAB";

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  WEEKLY: "Semanais",
  MONTHLY: "Mensais",
  YEARLY: "Anuais",
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function ReportCard({ item, index }: { item: Report; index: number }) {
  const t = useTheme();
  // Entrada em cascata acompanha a posição do card na lista
  const { listItemEntering } = useMotionPresets();
  const saldo = item.totalIncome - item.totalExpense;
  const positivo = saldo >= 0;
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
        <Text style={{ color: t.text.secondary, fontSize: 12 }}>
          {formatDate(item.startDate)} → {formatDate(item.endDate)}
        </Text>
      </View>

      <View style={{ flexDirection: "row", marginBottom: spacing[3] }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text.tertiary, fontSize: 11 }}>
            Receitas
          </Text>
          <Text
            style={{
              color: t.semantic.success,
              fontWeight: "700",
              fontSize: 14,
            }}
          >
            {formatCurrency(item.totalIncome)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text.tertiary, fontSize: 11 }}>
            Despesas
          </Text>
          <Text
            style={{
              color: t.semantic.danger,
              fontWeight: "700",
              fontSize: 14,
            }}
          >
            {formatCurrency(item.totalExpense)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text.tertiary, fontSize: 11 }}>
            Saldo
          </Text>
          <Text
            style={{
              // Delta financeiro usa o verde semântico, nunca o accent da marca
              color: positivo
                ? t.semantic.success
                : t.semantic.danger,
              fontWeight: "700",
              fontSize: 14,
            }}
          >
            {formatCurrency(saldo)}
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
  const { items, isLoading, isGenerating, fetch, generate } = useReportsStore();
  const showToast = useToastStore((s) => s.showToast);
  const [tab, setTab] = useState<ReportPeriod>("MONTHLY");

  useEffect(() => {
    fetch(tab);
  }, [tab]);

  const filtered = useMemo(
    () => items.filter((item) => item.period === tab),
    [items, tab],
  );

  const handleGenerate = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const now = new Date();
    const start = new Date(now);
    if (tab === "WEEKLY") start.setDate(start.getDate() - 7);
    else if (tab === "MONTHLY") start.setMonth(start.getMonth() - 1);
    else start.setFullYear(start.getFullYear() - 1);
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
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: spacing[5],
          paddingBottom: insets.bottom + 120,
        }}
        renderItem={({ item, index }) => (
          <ReportCard item={item} index={index} />
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
