import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import Check from "lucide-react-native/dist/esm/icons/check";
import Sparkles from "lucide-react-native/dist/esm/icons/sparkles";
import X from "lucide-react-native/dist/esm/icons/x";

import CustomModal from "./CustomModal";
import { useTheme } from "../theme/ThemeProvider";
import { SHEET_PADDING, SHEET_TITLE, radius, spacing } from "../theme/ds";
import { selectPlans, usePlanStore } from "../store/planStore";
import { usePreferencesStore } from "../store/preferencesStore";
import { useToastStore } from "../store/toastStore";
import { formatBRL } from "../utils/money";

interface Props {
  visible: boolean;
  /** Fechar por qualquer caminho: X, "Agora não", toque fora, voltar. */
  onClose: () => void;
}

/**
 * A oferta do Plus, em folha inferior.
 *
 * <p>Duas coisas a diferenciam de um pop-up de venda. Primeiro, ela é HONESTA
 * sobre o que existe: não há pagamento ainda, e a folha diz isso em vez de
 * fingir um botão "Assinar" que não leva a lugar nenhum — o que se pede é
 * interesse, e é só isso que se registra. Segundo, ela sabe calar: "Agora não"
 * vale sete dias, "Tenho interesse" vale trinta, e quem decide se ela aparece
 * é `utils/premiumOffer`, não a folha.
 */
export default function PremiumOfferSheet({ visible, onClose }: Props) {
  const t = useTheme();
  const plans = usePlanStore(selectPlans);
  const hasLoadedPlans = usePlanStore((s) => s.hasLoadedPlans);
  const fetchPlans = usePlanStore((s) => s.fetchPlans);
  const interestRegistered = usePlanStore((s) => s.interestRegistered);
  const registerInterest = usePlanStore((s) => s.registerInterest);
  const markPlusOfferShown = usePreferencesStore((s) => s.markPlusOfferShown);
  const markPlusInterest = usePreferencesStore((s) => s.markPlusInterest);
  const showToast = useToastStore((s) => s.showToast);
  const [working, setWorking] = useState(false);

  // As vantagens vêm do servidor; enquanto não vieram, a folha mostra a
  // promessa padrão (a mesma lista) — e busca uma vez só
  useEffect(() => {
    if (visible && !hasLoadedPlans) fetchPlans();
  }, [visible, hasLoadedPlans, fetchPlans]);

  const plus = plans.find((plan) => plan.id === "PLUS");
  const features = plus?.features ?? [];
  const price = plus ? `${formatBRL(plus.priceMonthly)}/mês` : null;

  /** "Agora não" e todo fechamento sem resposta: sete dias de silêncio. */
  const dismiss = () => {
    markPlusOfferShown(Date.now());
    onClose();
  };

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
    onClose();
  };

  return (
    <CustomModal visible={visible} onClose={dismiss}>
      <View style={SHEET_PADDING}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: spacing[3],
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.full,
              backgroundColor: t.accent.neonMuted,
              alignItems: "center",
              justifyContent: "center",
              marginRight: spacing[3],
            }}
          >
            <Sparkles size={20} color={t.accent.neon} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: t.text.primary, ...SHEET_TITLE }}
            >
              Economize! Plus
            </Text>
            <Text style={{ color: t.text.secondary, fontSize: 13, marginTop: 2 }}>
              Sem anúncios e com mais
            </Text>
          </View>
          <TouchableOpacity
            onPress={dismiss}
            accessibilityLabel="Fechar"
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
            <X size={18} color={t.text.secondary} />
          </TouchableOpacity>
        </View>

        <View
          style={{
            backgroundColor: t.background.elevated,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: t.border.subtle,
            padding: spacing[4],
          }}
        >
          {features.map((feature) => (
            <View
              key={feature}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: spacing[1],
              }}
            >
              <Check size={16} color={t.semantic.success} />
              <Text
                style={{
                  flex: 1,
                  marginLeft: spacing[2],
                  color: t.text.primary,
                  fontSize: 14,
                  lineHeight: 20,
                }}
              >
                {feature}
              </Text>
            </View>
          ))}

          {price && (
            <Text
              style={{
                color: t.text.primary,
                fontSize: 18,
                fontWeight: "700",
                marginTop: spacing[3],
                fontVariant: ["tabular-nums"],
              }}
            >
              {price}
            </Text>
          )}
          {/* A frase honesta: o que se pede aqui é interesse, não cartão */}
          <Text
            style={{
              color: t.text.tertiary,
              fontSize: 12,
              lineHeight: 17,
              marginTop: spacing[1],
            }}
          >
            Pagamento ainda não disponível — estamos medindo o interesse.
          </Text>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={
            interestRegistered ? "Interesse registrado" : "Tenho interesse"
          }
          accessibilityState={{
            disabled: working || interestRegistered,
            busy: working,
          }}
          disabled={working || interestRegistered}
          onPress={handleInterest}
          activeOpacity={0.85}
          style={{
            marginTop: spacing[4],
            height: 52,
            borderRadius: radius.full,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            backgroundColor: interestRegistered
              ? t.semantic.successMuted
              : t.accent.neon,
            opacity: working ? 0.7 : 1,
          }}
        >
          {working ? (
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
            <Text
              style={{ color: t.text.inverse, fontSize: 15, fontWeight: "700" }}
            >
              Tenho interesse
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Agora não"
          onPress={dismiss}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ marginTop: spacing[4], alignSelf: "center" }}
        >
          <Text
            style={{ color: t.text.secondary, fontWeight: "600", fontSize: 14 }}
          >
            Agora não
          </Text>
        </TouchableOpacity>
      </View>
    </CustomModal>
  );
}
