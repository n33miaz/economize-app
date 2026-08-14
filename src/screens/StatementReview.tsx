import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  LayoutAnimation,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  BadgeCheck,
  Check,
  ChevronDown,
  CircleHelp,
  X,
} from "lucide-react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "../utils/haptics";
import Animated from "react-native-reanimated";

import type { Category, CategorizedBy, ReviewGroup } from "../services/api";
import { useCategoriesStore } from "../store/categoriesStore";
import { useReviewStore } from "../store/reviewStore";
import { useToastStore } from "../store/toastStore";
import type { AppTheme } from "../theme/colors";
import { radius, spacing } from "../theme/ds";
import { useTheme } from "../theme/ThemeProvider";
import { useMotionPresets, usePressScale } from "../theme/motionPresets";
import { categoryPath } from "../utils/categoryTree";
import CategoryIcon from "../components/CategoryIcon";
import CategoryPickerSheet from "../components/CategoryPickerSheet";
import ErrorState from "../components/ErrorState";
import PageContainer from "../components/PageContainer";
import ScreenHeader from "../components/ScreenHeader";
import Skeleton from "../components/Skeleton";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDayMonth(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

// Identidade estável do grupo entre re-fetches: a fila não traz id próprio,
// então repetimos aqui a chave que o backend usa para agrupar — descrição
// normalizada MAIS a categoria sugerida. Só com a descrição, dois grupos da
// mesma loja com sugestões diferentes colidiriam: a escolha feita num card
// vazaria para o outro e a categoria (com a regra que ela ensina) cairia em
// transações que o usuário nunca decidiu
function groupKey(group: ReviewGroup) {
  const description =
    group.normalizedDescription ??
    group.sampleDescription ??
    group.transactions[0]?.id ??
    "grupo";
  return `${description}|${group.suggestedCategoryId ?? ""}`;
}

function originLabel(by: CategorizedBy | null, overridden: boolean) {
  if (overridden || by === "USER") return "escolhida";
  if (by === "USER_RULE" || by === "LEARNED_RULE") return "regra sua";
  if (by === "AI") return "sugerida por IA";
  return "sugerida"; // KEYWORD, FALLBACK e origens futuras
}

interface GroupCardProps {
  group: ReviewGroup;
  index: number;
  /** Categoria efetiva do grupo: escolha manual ou sugestão do backend. */
  resolved: Category | undefined;
  overridden: boolean;
  expanded: boolean;
  isApplying: boolean;
  onToggle: () => void;
  onOpenPicker: () => void;
  onConfirm: () => void;
}

function ReviewGroupCard({
  group,
  index,
  resolved,
  overridden,
  expanded,
  isApplying,
  onToggle,
  onOpenPicker,
  onConfirm,
}: GroupCardProps) {
  const t = useTheme();
  const { listItemEntering } = useMotionPresets();
  const chipPress = usePressScale();
  const confirmPress = usePressScale();

  const title = group.sampleDescription ?? "Sem descrição";
  const count = group.transactions.length;
  const confirmDisabled = !resolved || isApplying;
  // O chip mostra o caminho ("Alimentação › Delivery") e a origem vai ao lado:
  // juntos num rótulo só, a elipse comeria justamente a origem
  const chipLabel = resolved ? categoryPath(resolved) : "Escolher categoria";

  return (
    <Animated.View
      entering={listItemEntering(index)}
      style={{
        backgroundColor: t.background.surface,
        borderRadius: radius["2xl"],
        borderWidth: 1,
        borderColor: t.border.subtle,
        marginBottom: spacing[3],
        overflow: "hidden",
      }}
    >
      <TouchableOpacity
        onPress={onToggle}
        accessibilityLabel={`Grupo ${title}, ${count} ${plural(count, "transação", "transações")}. Toque para ${expanded ? "recolher" : "ver as transações"}`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        activeOpacity={0.85}
        style={{ padding: spacing[4] }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {resolved ? (
            // AppTheme tipa hexas literais do dark; os temas são estruturalmente
            // idênticos, então o cast da união é seguro
            <CategoryIcon category={resolved} theme={t as AppTheme} size={40} />
          ) : (
            // Sem categoria nem escolha: o disco de ajuda pede a decisão
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.full,
                backgroundColor: t.semantic.warningMuted,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CircleHelp size={20} color={t.semantic.warning} />
            </View>
          )}
          <View
            style={{ flex: 1, marginLeft: spacing[3], marginRight: spacing[2] }}
          >
            <Text
              numberOfLines={1}
              style={{ color: t.text.primary, fontSize: 15, fontWeight: "700" }}
            >
              {title}
            </Text>
            <Text
              style={{ color: t.text.secondary, fontSize: 12, marginTop: 2 }}
            >
              {count} {plural(count, "transação", "transações")} ·{" "}
              {formatBRL(group.totalAmount)}
            </Text>
          </View>
          <Animated.View style={confirmPress.pressStyle}>
            <TouchableOpacity
              onPress={onConfirm}
              onPressIn={confirmPress.onPressIn}
              onPressOut={confirmPress.onPressOut}
              disabled={confirmDisabled}
              accessibilityLabel={
                resolved
                  ? `Confirmar grupo ${title} como ${resolved.name}`
                  : `Escolha uma categoria antes de confirmar ${title}`
              }
              accessibilityRole="button"
              accessibilityState={{ disabled: confirmDisabled }}
              activeOpacity={0.8}
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.full,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: t.semantic.successMuted,
                opacity: confirmDisabled ? 0.35 : 1,
              }}
            >
              <Check size={20} color={t.semantic.success} />
            </TouchableOpacity>
          </Animated.View>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: spacing[3],
          }}
        >
          <Animated.View style={[chipPress.pressStyle, { flexShrink: 1 }]}>
            <TouchableOpacity
              onPress={onOpenPicker}
              onPressIn={chipPress.onPressIn}
              onPressOut={chipPress.onPressOut}
              accessibilityLabel={
                resolved
                  ? `Categoria ${resolved.name}. Toque para trocar`
                  : "Escolher categoria"
              }
              accessibilityRole="button"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              activeOpacity={0.8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                minHeight: 32,
                borderRadius: radius.full,
                paddingHorizontal: spacing[3],
                paddingVertical: 6,
                backgroundColor: resolved
                  ? t.accent.neonMuted
                  : t.semantic.warningMuted,
                borderWidth: 1,
                borderColor: resolved ? "transparent" : t.semantic.warning,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: resolved ? t.accent.neon : t.semantic.warning,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {chipLabel}
              </Text>
            </TouchableOpacity>
          </Animated.View>
          {resolved && (
            <Text
              numberOfLines={1}
              style={{
                color: t.text.tertiary,
                fontSize: 11,
                marginLeft: spacing[2],
                flexShrink: 1,
              }}
            >
              {originLabel(group.categorizedBy, overridden)}
            </Text>
          )}
          <View style={{ flex: 1 }} />
          <ChevronDown
            size={18}
            color={t.text.tertiary}
            style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
          />
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
          {group.transactions.map((tx) => {
            const negative = tx.type === "DEBIT" || tx.amount < 0;
            return (
              <View
                key={tx.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: spacing[2],
                }}
              >
                <Text
                  style={{ color: t.text.tertiary, fontSize: 11, width: 42 }}
                >
                  {formatDayMonth(tx.date)}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    color: t.text.secondary,
                    fontSize: 12,
                    marginHorizontal: spacing[2],
                  }}
                >
                  {tx.description}
                </Text>
                <Text
                  style={{
                    color: negative ? t.chart.down : t.chart.up,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {negative ? "- " : "+ "}
                  {formatBRL(Math.abs(tx.amount))}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </Animated.View>
  );
}

export default function StatementReview() {
  const t = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useMotionPresets();
  const approvePress = usePressScale();
  const backPress = usePressScale();

  // O projeto não tem ParamList tipado — cast local e pontual
  const uploadId = (route.params as any)?.uploadId as string | undefined;

  const { groups, isLoading, isApplying, error, fetchQueue, apply, confirmAll } =
    useReviewStore();
  const categories = useCategoriesStore((s) => s.items);
  const fetchCategories = useCategoriesStore((s) => s.fetch);
  const { showToast } = useToastStore();

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  // Escolhas manuais ainda não confirmadas, por grupo — só viram verdade no
  // backend quando o usuário toca no check (apply)
  const [choices, setChoices] = useState<Record<string, Category>>({});
  const [pickerKey, setPickerKey] = useState<string | null>(null);

  // Recarregar troca os grupos da fila: escolha antiga guardada por chave
  // grudaria num grupo novo que o usuário nunca abriu
  const reloadQueue = useCallback(() => {
    setChoices({});
    fetchQueue(uploadId);
  }, [uploadId, fetchQueue]);

  useEffect(() => {
    reloadQueue();
    fetchCategories();
  }, [reloadQueue, fetchCategories]);

  useEffect(() => {
    if (error) showToast(error, "error");
  }, [error, showToast]);

  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const txCount = useMemo(
    () => groups.reduce((sum, g) => sum + g.transactions.length, 0),
    [groups],
  );
  const approveTxCount = useMemo(
    () =>
      groups
        .filter((g) => g.suggestedCategoryId)
        .reduce((sum, g) => sum + g.transactions.length, 0),
    [groups],
  );
  const uncategorizedCount = useMemo(
    () => groups.filter((g) => !g.suggestedCategoryId).length,
    [groups],
  );

  const subtitle =
    isLoading && groups.length === 0
      ? "Carregando fila de revisão"
      : groups.length === 0
        ? "Nada pendente"
        : `${txCount} ${plural(txCount, "transação", "transações")} em ${groups.length} ${plural(groups.length, "grupo", "grupos")}`;

  const resolveCategory = (group: ReviewGroup): Category | undefined =>
    choices[groupKey(group)] ??
    (group.suggestedCategoryId
      ? catById.get(group.suggestedCategoryId)
      : undefined);

  const handleToggle = (key: string) => {
    // LayoutAnimation cobre o expandir/recolher; com movimento reduzido o
    // conteúdo simplesmente aparece
    if (!reducedMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const handleConfirmGroup = async (group: ReviewGroup) => {
    const resolved = resolveCategory(group);
    if (!resolved || isApplying) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await apply([
      {
        transactionIds: group.transactions.map((tx) => tx.id),
        categoryId: resolved.id,
      },
    ]);
  };

  const handleApproveAll = async () => {
    if (isApplying || approveTxCount === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const confirmed = await confirmAll();
    if (confirmed > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(
        `${confirmed} ${plural(confirmed, "transação aprovada", "transações aprovadas")}.`,
        "success",
      );
      if (useReviewStore.getState().groups.length === 0) {
        navigation.goBack();
      }
      return;
    }
    // Zero confirmadas sem erro: o store recarregou a fila em vez de esvaziar
    // a tela — sem aviso, o usuário acharia que aprovou tudo. Os grupos vieram
    // do servidor de novo, então as escolhas antigas saem junto
    setChoices({});
    if (!useReviewStore.getState().error) {
      showToast("Nada foi confirmado. Atualizamos a fila.", "warning");
    }
  };

  const pickerGroup =
    pickerKey !== null
      ? groups.find((g) => groupKey(g) === pickerKey)
      : undefined;
  const pickerSelectedId = pickerGroup
    ? (choices[pickerKey!]?.id ?? pickerGroup.suggestedCategoryId)
    : null;

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ marginBottom: spacing[3] }}>
              <Skeleton height={116} borderRadius={radius["2xl"]} />
            </View>
          ))}
        </View>
      );
    }
    if (error) {
      return <ErrorState message={error} onRetry={reloadQueue} />;
    }
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: spacing[6],
        }}
      >
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: radius.full,
            backgroundColor: t.semantic.successMuted,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing[4],
          }}
        >
          <BadgeCheck size={40} color={t.semantic.success} />
        </View>
        <Text
          style={{
            color: t.text.primary,
            fontSize: 18,
            fontWeight: "700",
            marginBottom: spacing[2],
          }}
        >
          Tudo categorizado
        </Text>
        <Text
          style={{
            color: t.text.secondary,
            fontSize: 13,
            textAlign: "center",
            marginBottom: spacing[6],
          }}
        >
          Nenhuma transação aguardando revisão por aqui.
        </Text>
        <Animated.View style={backPress.pressStyle}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            onPressIn={backPress.onPressIn}
            onPressOut={backPress.onPressOut}
            accessibilityLabel="Voltar"
            accessibilityRole="button"
            activeOpacity={0.85}
            style={{
              height: 52,
              borderRadius: radius.full,
              paddingHorizontal: spacing[8],
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: t.accent.neon,
            }}
          >
            <Text
              style={{ color: t.text.inverse, fontWeight: "700", fontSize: 15 }}
            >
              Voltar
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  return (
    <PageContainer>
      {/* Tela modal: já nasce abaixo da status bar, sem inset extra */}
      <ScreenHeader
        title="Revisar categorias"
        subtitle={subtitle}
        showInfoButton={false}
        showProfileButton={false}
        topInset={false}
        rightActions={[
          // Header é dark fixo (como o ScreenHeader inteiro): tokens estáticos
          <TouchableOpacity
            key="close"
            onPress={() => navigation.goBack()}
            accessibilityLabel="Fechar revisão"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.full,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: t.background.elevated,
            }}
          >
            <X size={18} color={t.text.primary} />
          </TouchableOpacity>,
        ]}
      />

      <FlatList
        data={groups}
        keyExtractor={(group) => groupKey(group)}
        extraData={{ choices, expandedKey, isApplying, catById }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: spacing[5],
          paddingBottom: spacing[6],
          flexGrow: 1,
        }}
        renderItem={({ item, index }) => {
          const key = groupKey(item);
          const resolved = resolveCategory(item);
          return (
            <ReviewGroupCard
              group={item}
              index={index}
              resolved={resolved}
              overridden={Boolean(choices[key])}
              expanded={expandedKey === key}
              isApplying={isApplying}
              onToggle={() => handleToggle(key)}
              onOpenPicker={() => setPickerKey(key)}
              onConfirm={() => handleConfirmGroup(item)}
            />
          );
        }}
        ListEmptyComponent={renderEmpty()}
      />

      {!isLoading && groups.length > 0 && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: t.border.subtle,
            backgroundColor: t.background.base,
            paddingHorizontal: spacing[5],
            paddingTop: spacing[3],
            paddingBottom: insets.bottom + spacing[3],
          }}
        >
          {uncategorizedCount > 0 && (
            <Text
              style={{
                color: t.semantic.warning,
                fontSize: 12,
                textAlign: "center",
                marginBottom: spacing[2],
              }}
            >
              {uncategorizedCount === 1
                ? "1 grupo sem categoria fica de fora do aprovar tudo — escolha no chip e confirme."
                : `${uncategorizedCount} grupos sem categoria ficam de fora do aprovar tudo — escolha no chip e confirme.`}
            </Text>
          )}
          {approveTxCount > 0 && (
            <Animated.View style={approvePress.pressStyle}>
              <TouchableOpacity
                onPress={handleApproveAll}
                onPressIn={approvePress.onPressIn}
                onPressOut={approvePress.onPressOut}
                disabled={isApplying}
                accessibilityLabel={`Aprovar todas as ${approveTxCount} transações sugeridas`}
                accessibilityRole="button"
                accessibilityState={{ disabled: isApplying }}
                activeOpacity={0.85}
                style={{
                  height: 52,
                  borderRadius: radius.full,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: t.accent.neon,
                  opacity: isApplying ? 0.7 : 1,
                }}
              >
                {isApplying ? (
                  <ActivityIndicator size="small" color={t.text.inverse} />
                ) : (
                  <Text
                    style={{
                      color: t.text.inverse,
                      fontWeight: "700",
                      fontSize: 15,
                    }}
                  >
                    Aprovar tudo ({approveTxCount})
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          )}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityLabel="Deixar para depois"
            accessibilityRole="button"
            activeOpacity={0.7}
            style={{
              height: 48,
              alignItems: "center",
              justifyContent: "center",
              marginTop: spacing[1],
            }}
          >
            <Text
              style={{ color: t.text.secondary, fontWeight: "700", fontSize: 14 }}
            >
              Deixar para depois
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <CategoryPickerSheet
        visible={pickerKey !== null}
        onClose={() => setPickerKey(null)}
        selectedId={pickerSelectedId}
        onSelect={(category) => {
          if (pickerKey) {
            setChoices((prev) => ({ ...prev, [pickerKey]: category }));
          }
        }}
      />
    </PageContainer>
  );
}
