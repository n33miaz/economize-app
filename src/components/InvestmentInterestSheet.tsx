import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Check from "lucide-react-native/dist/esm/icons/check";
import Plus from "lucide-react-native/dist/esm/icons/plus";
import X from "lucide-react-native/dist/esm/icons/x";

import type { InvestmentInterest } from "../services/api";
import { getApiErrorStatus } from "../services/api";
import { useInvestmentStore } from "../store/investmentStore";
import { useTheme } from "../theme/ThemeProvider";
import { SHEET_PADDING, SHEET_TITLE, radius, spacing } from "../theme/ds";
import * as Haptics from "../utils/haptics";
import {
  DEFAULT_FOREIGN_MARKET,
  INTEREST_OPTIONS,
  isWatching,
  normalizeTicker,
  watchKey,
} from "../utils/investments";
import CustomModal from "./CustomModal";
import SegmentedControl from "./SegmentedControl";

interface InvestmentInterestSheetProps {
  visible: boolean;
  onClose: () => void;
}

const MARKET_OPTIONS = [
  { label: "EUA (US)", value: "US" },
  { label: "Brasil (B3)", value: "BR" },
];

/**
 * O "+ acompanhar" de Seus indicadores (EC-15x).
 *
 * Duas listas: as taxas, índices e moedas que a API macro cobre — prontas,
 * um toque — e o ticker livre, com o mercado, para o papel no exterior que a
 * cotação vai buscar. O que já está no perfil aparece marcado e não pode ser
 * adicionado de novo: remover é pelo cartão, com confirmação.
 */
export default function InvestmentInterestSheet({
  visible,
  onClose,
}: InvestmentInterestSheetProps) {
  const t = useTheme();
  const profile = useInvestmentStore((s) => s.profile.data);
  const addInterest = useInvestmentStore((s) => s.addInterest);

  const [ticker, setTicker] = useState("");
  const [market, setMarket] = useState(DEFAULT_FOREIGN_MARKET);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setTicker("");
    setMarket(DEFAULT_FOREIGN_MARKET);
    setPendingKey(null);
    setError(null);
  }, [visible]);

  const add = async (interest: InvestmentInterest) => {
    if (pendingKey) return;
    const key = watchKey(interest);
    setPendingKey(key);
    setError(null);
    try {
      await addInterest(interest);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (interest.kind === "TICKER") setTicker("");
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(
        getApiErrorStatus(e) === 404
          ? "Este servidor ainda não guarda indicadores acompanhados."
          : "Não foi possível adicionar agora.",
      );
    } finally {
      setPendingKey(null);
    }
  };

  const handleAddTicker = () => {
    const code = normalizeTicker(ticker);
    if (!code) {
      setError("Digite um ticker válido (ex.: VT, VOO, BOVA11).");
      return;
    }
    if (isWatching(profile, { kind: "TICKER", code })) {
      setError(`${code} já está entre os seus indicadores.`);
      return;
    }
    add({ kind: "TICKER", code, market });
  };

  return (
    <CustomModal visible={visible} onClose={onClose}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={SHEET_PADDING}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing[4],
          }}
        >
          <View style={{ flex: 1, marginRight: spacing[3] }}>
            <Text style={{ color: t.text.primary, ...SHEET_TITLE }}>
              Acompanhar indicador
            </Text>
            <Text style={{ color: t.text.secondary, fontSize: 12, marginTop: 2 }}>
              O que entra aqui aparece em Seus indicadores e puxa manchetes para o radar.
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            accessibilityLabel="Fechar"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.full,
              backgroundColor: t.background.elevated,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} color={t.text.secondary} />
          </TouchableOpacity>
        </View>

        <Text style={sectionStyle(t)}>Taxas, índices e moedas</Text>
        {INTEREST_OPTIONS.map((option) => {
          const watching = isWatching(profile, option);
          const key = `${option.kind}:${option.code}`;
          const pending = pendingKey === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => add({ kind: option.kind, code: option.code })}
              disabled={watching || pending}
              accessibilityRole="button"
              accessibilityLabel={
                watching
                  ? `${option.label}, já acompanhado`
                  : `Acompanhar ${option.label}`
              }
              accessibilityState={{ disabled: watching || pending }}
              activeOpacity={0.85}
              style={{
                flexDirection: "row",
                alignItems: "center",
                minHeight: 56,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: watching ? t.accent.neon : t.border.subtle,
                backgroundColor: watching
                  ? t.accent.neonMuted
                  : t.background.elevated,
                marginBottom: spacing[2],
                opacity: pending ? 0.6 : 1,
              }}
            >
              <View style={{ flex: 1, marginRight: spacing[3] }}>
                <Text
                  style={{
                    color: t.text.primary,
                    fontSize: 14,
                    fontWeight: "700",
                  }}
                >
                  {option.label}
                </Text>
                <Text
                  style={{ color: t.text.secondary, fontSize: 12, marginTop: 2 }}
                >
                  {option.hint}
                </Text>
              </View>
              {pending ? (
                <ActivityIndicator color={t.accent.neon} />
              ) : watching ? (
                <Check size={18} color={t.accent.neon} />
              ) : (
                <Plus size={18} color={t.text.tertiary} />
              )}
            </TouchableOpacity>
          );
        })}

        <Text style={[sectionStyle(t), { marginTop: spacing[4] }]}>
          Ticker no exterior ou na B3
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing[2],
            marginBottom: spacing[3],
          }}
        >
          <TextInput
            value={ticker}
            onChangeText={(text) => {
              setTicker(text.toUpperCase());
              if (error) setError(null);
            }}
            placeholder="Ex.: VT, VOO"
            placeholderTextColor={t.text.tertiary}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleAddTicker}
            accessibilityLabel="Ticker"
            style={{
              flex: 1,
              height: 48,
              paddingHorizontal: spacing[4],
              borderRadius: radius.xl,
              borderWidth: 1,
              borderColor: t.border.default,
              backgroundColor: t.background.elevated,
              color: t.text.primary,
              fontSize: 15,
            }}
          />
          <TouchableOpacity
            onPress={handleAddTicker}
            disabled={pendingKey !== null}
            accessibilityLabel="Acompanhar ticker"
            accessibilityRole="button"
            activeOpacity={0.85}
            style={{
              height: 48,
              paddingHorizontal: spacing[4],
              borderRadius: radius.full,
              backgroundColor: t.accent.neon,
              alignItems: "center",
              justifyContent: "center",
              opacity: pendingKey ? 0.7 : 1,
            }}
          >
            {pendingKey?.startsWith("TICKER:") ? (
              <ActivityIndicator color={t.text.inverse} />
            ) : (
              <Text style={{ color: t.text.inverse, fontSize: 14, fontWeight: "700" }}>
                Acompanhar
              </Text>
            )}
          </TouchableOpacity>
        </View>
        <SegmentedControl
          options={MARKET_OPTIONS}
          value={market}
          onChange={setMarket}
        />
        <Text
          style={{
            color: t.text.tertiary,
            fontSize: 11,
            lineHeight: 16,
            marginTop: spacing[2],
          }}
        >
          A cotação vem em dólar e convertida para reais; é ela que dá valor à sua posição manual no exterior.
        </Text>

        {error ? (
          <Text
            accessibilityRole="alert"
            style={{
              color: t.semantic.danger,
              fontSize: 13,
              lineHeight: 18,
              marginTop: spacing[3],
            }}
          >
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </CustomModal>
  );
}

const sectionStyle = (t: ReturnType<typeof useTheme>) => ({
  color: t.text.tertiary,
  fontSize: 11,
  fontWeight: "700" as const,
  letterSpacing: 1.2,
  textTransform: "uppercase" as const,
  marginBottom: spacing[2],
});
