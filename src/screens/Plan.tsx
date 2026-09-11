import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import Check from "lucide-react-native/dist/esm/icons/check";
import Sparkles from "lucide-react-native/dist/esm/icons/sparkles";
import Animated from "react-native-reanimated";

import AssistantFAB from "../components/AssistantFAB";
import PageContainer from "../components/PageContainer";
import PotIcon from "../components/PotIcon";
import ScreenHeader from "../components/ScreenHeader";
import SectionTitle from "../components/SectionTitle";
import Skeleton from "../components/Skeleton";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { selectPlans, usePlanStore } from "../store/planStore";
import { usePreferencesStore } from "../store/preferencesStore";
import { useToastStore } from "../store/toastStore";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { useMotionPresets } from "../theme/motionPresets";
import { formatBRL } from "../utils/money";

import type { PlanOption } from "../services/api";

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function PlanCard({
  plan,
  current,
  highlighted,
}: {
  plan: PlanOption;
  current: boolean;
  highlighted: boolean;
}) {
  const t = useTheme();
  return (
    <View
      accessibilityLabel={`${plan.name}${current ? ", seu plano atual" : ""}`}
      style={{
        flex: 1,
        backgroundColor: t.background.elevated,
        borderRadius: radius["2xl"],
        borderWidth: highlighted ? 2 : 1,
        borderColor: highlighted ? t.accent.neon : t.border.subtle,
        padding: spacing[4],
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text
          style={{
            flex: 1,
            color: t.text.primary,
            fontSize: 18,
            fontWeight: "700",
          }}
        >
          {plan.name}
        </Text>
        {current && (
          <View
            style={{
              paddingHorizontal: spacing[2],
              paddingVertical: 2,
              borderRadius: radius.full,
              backgroundColor: t.accent.neonMuted,
            }}
          >
            <Text
              style={{ color: t.accent.neon, fontSize: 10, fontWeight: "700" }}
            >
              SEU PLANO
            </Text>
          </View>
        )}
      </View>
      <Text
        style={{
          color: t.text.primary,
          fontSize: 22,
          fontWeight: "700",
          marginTop: spacing[2],
          fontVariant: ["tabular-nums"],
        }}
      >
        {plan.priceMonthly > 0 ? `${formatBRL(plan.priceMonthly)}/mês` : "R$ 0"}
      </Text>
      <View style={{ marginTop: spacing[3] }}>
        {plan.features.map((feature) => (
          <View
            key={feature}
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              paddingVertical: spacing[1],
            }}
          >
            <Check
              size={15}
              color={highlighted ? t.semantic.success : t.text.tertiary}
              style={{ marginTop: 2 }}
            />
            <Text
              style={{
                flex: 1,
                marginLeft: spacing[2],
                color: t.text.secondary,
                fontSize: 13,
                lineHeight: 18,
              }}
            >
              {feature}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Gratuito × Plus.
 *
 * <p>A tela existe para responder duas perguntas e nada mais: "qual é o meu
 * plano" e "o que o Plus daria a mais". O botão registra INTERESSE, e a
 * frase logo abaixo dele diz por que não é "Assinar": ainda não há pagamento,
 * e o app não finge que há. Uma tela que promete o que não entrega custa mais
 * caro do que uma que admite estar medindo.
 */
export default function Plan() {
  const t = useTheme();
  const { columns } = useBreakpoint();
  const { cardEntering, listItemEntering } = useMotionPresets();
  const showToast = useToastStore((s) => s.showToast);
  const markPlusInterest = usePreferencesStore((s) => s.markPlusInterest);

  const plan = usePlanStore((s) => s.plan);
  const planUntil = usePlanStore((s) => s.planUntil);
  const plans = usePlanStore(selectPlans);
  const isLoading = usePlanStore((s) => s.isLoading);
  const hasLoadedPlans = usePlanStore((s) => s.hasLoadedPlans);
  const checkoutAvailable = usePlanStore((s) => s.checkoutAvailable);
  const interestRegistered = usePlanStore((s) => s.interestRegistered);
  const isRegistering = usePlanStore((s) => s.isRegistering);
  const fetchPlans = usePlanStore((s) => s.fetchPlans);
  const registerInterest = usePlanStore((s) => s.registerInterest);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const isPlus = plan === "PLUS";
  const until = formatDate(planUntil);
  const currentPlan = plans.find((option) => option.id === plan);

  const handleInterest = async () => {
    if (working) return;
    setWorking(true);
    const ok = await registerInterest("PLUS");
    setWorking(false);
    if (!ok) {
      showToast("Não foi possível registrar. Tente de novo.", "error");
      return;
    }
    markPlusInterest(Date.now());
    showToast("Avisaremos você quando o Plus estiver disponível.", "success");
  };

  const busy = working || isRegistering;

  return (
    <PageContainer>
      <ScreenHeader
        title="Plano"
        subtitle="Gratuito ou Plus"
        showProfileButton={false}
      />
      <ScrollView
        contentContainerStyle={{
          padding: spacing[5],
          paddingBottom: spacing[10],
        }}
      >
        <Animated.View
          entering={cardEntering}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: t.background.elevated,
            borderRadius: radius["2xl"],
            borderWidth: 1,
            borderColor: t.border.subtle,
            padding: spacing[4],
          }}
        >
          <PotIcon size={56} level={isPlus ? 1 : 0.5} />
          <View style={{ flex: 1, marginLeft: spacing[4] }}>
            <Text style={{ color: t.text.tertiary, fontSize: 12 }}>
              Seu plano
            </Text>
            <Text
              style={{
                color: t.text.primary,
                fontSize: 22,
                fontWeight: "700",
                marginTop: 2,
              }}
            >
              {currentPlan?.name ?? (isPlus ? "Plus" : "Gratuito")}
            </Text>
            <Text style={{ color: t.text.secondary, fontSize: 13, marginTop: 2 }}>
              {isPlus
                ? until
                  ? `Sem anúncios · válido até ${until}`
                  : "Sem anúncios"
                : "Com anúncios discretos"}
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={listItemEntering(1)}>
          <SectionTitle>Comparar</SectionTitle>
          {isLoading && !hasLoadedPlans ? (
            <View style={{ flexDirection: columns === 2 ? "row" : "column", gap: spacing[3] }}>
              <Skeleton width="100%" height={180} borderRadius={radius["2xl"]} />
              <Skeleton width="100%" height={180} borderRadius={radius["2xl"]} />
            </View>
          ) : (
            // No desktop os dois cartões ficam lado a lado — é assim que se
            // compara; no celular empilham, com o Plus por último (é o convite)
            <View
              style={{
                flexDirection: columns === 2 ? "row" : "column",
                gap: spacing[3],
              }}
            >
              {plans.map((option) => (
                <PlanCard
                  key={option.id}
                  plan={option}
                  current={option.id === plan}
                  highlighted={option.id === "PLUS"}
                />
              ))}
            </View>
          )}
        </Animated.View>

        {!isPlus && (
          <Animated.View entering={listItemEntering(2)} style={{ marginTop: spacing[5] }}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={
                interestRegistered ? "Interesse registrado" : "Tenho interesse"
              }
              accessibilityState={{
                disabled: busy || interestRegistered,
                busy,
              }}
              disabled={busy || interestRegistered}
              onPress={handleInterest}
              activeOpacity={0.85}
              style={{
                height: 52,
                borderRadius: radius.full,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                backgroundColor: interestRegistered
                  ? t.semantic.successMuted
                  : t.accent.neon,
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? (
                <ActivityIndicator color={t.text.inverse} />
              ) : interestRegistered ? (
                <>
                  <Check size={18} color={t.semantic.success} />
                  <Text
                    style={{
                      marginLeft: spacing[2],
                      color: t.semantic.success,
                      fontSize: 15,
                      fontWeight: "700",
                    }}
                  >
                    Interesse registrado
                  </Text>
                </>
              ) : (
                <>
                  <Sparkles size={18} color={t.text.inverse} />
                  <Text
                    style={{
                      marginLeft: spacing[2],
                      color: t.text.inverse,
                      fontSize: 15,
                      fontWeight: "700",
                    }}
                  >
                    Tenho interesse
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {!checkoutAvailable && (
              <Text
                style={{
                  color: t.text.tertiary,
                  fontSize: 12,
                  lineHeight: 17,
                  textAlign: "center",
                  marginTop: spacing[3],
                }}
              >
                Pagamento ainda não disponível — estamos medindo o interesse.
              </Text>
            )}
          </Animated.View>
        )}
      </ScrollView>
    {/* EC-201: o assistente e porta, nao aba. Ele chega sabendo de
        qual tela foi aberto, e sugere as perguntas dela */}
    <AssistantFAB origin="planos" />
    </PageContainer>
  );
}
