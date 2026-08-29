import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import CalendarRange from "lucide-react-native/dist/esm/icons/calendar-range";
import Info from "lucide-react-native/dist/esm/icons/info";
import X from "lucide-react-native/dist/esm/icons/x";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import * as Haptics from "../utils/haptics";
import {
  MAX_CYCLE_ANCHOR_DAY,
  MIN_CYCLE_ANCHOR_DAY,
  cycleWindowContaining,
  describeWindow,
  formatWindowLabel,
  isCalendarMonthAnchor,
  todayIso,
} from "../utils/cycleWindow";
import { usePreferencesStore, selectCycleAnchorDay } from "../store/preferencesStore";
import { useRecurrenceStore } from "../store/recurrenceStore";
import { reloadAnalyticsForAnchorChange } from "../store/analyticsStore";
import CustomModal from "./CustomModal";

// Dia a partir do qual nem todo mês tem o número: a âncora recua para o último
// dia nesses meses, e isso precisa estar escrito antes de o usuário escolher
const SHORT_MONTH_RISK_DAY = 29;

const DAYS = Array.from(
  { length: MAX_CYCLE_ANCHOR_DAY - MIN_CYCLE_ANCHOR_DAY + 1 },
  (_, index) => index + MIN_CYCLE_ANCHOR_DAY,
);

interface CycleAnchorSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Escolha da âncora do ciclo (EC-092). O mês financeiro de quem recebe no dia
 * 5 não é o mês do calendário: a tela deixa escolher o dia da virada, mostra a
 * janela resultante antes de aplicar e avisa que o comparável muda de
 * significado fora do dia 1 — trocar o número exibido sem explicar seria
 * enganar o usuário.
 */
export default function CycleAnchorSheet({
  visible,
  onClose,
}: CycleAnchorSheetProps) {
  const t = useTheme();
  const anchorDay = usePreferencesStore(selectCycleAnchorDay);
  const setCycleAnchorDay = usePreferencesStore((s) => s.setCycleAnchorDay);
  const series = useRecurrenceStore((s) => s.series);
  const fetchSeries = useRecurrenceStore((s) => s.fetchSeries);

  const [draft, setDraft] = useState(anchorDay);

  // Cada abertura parte do valor salvo: fechar sem aplicar não pode deixar
  // rascunho pendurado para a próxima vez
  useEffect(() => {
    if (visible) setDraft(anchorDay);
  }, [visible, anchorDay]);

  // As sugestões saem das séries detectadas, e só a Home as buscava: aberta
  // pelo Perfil, a folha nunca mostrava "Suas entradas". A busca é da própria
  // folha agora, e só quando não há nada em memória — reabrir não vira request
  useEffect(() => {
    if (visible && series.length === 0) fetchSeries();
  }, [visible, series.length, fetchSeries]);

  const preview = useMemo(
    () => cycleWindowContaining(draft, todayIso()),
    [draft],
  );
  const previewLabel = formatWindowLabel(preview.start, preview.end);
  const previewSpoken = describeWindow(preview.start, preview.end);

  // Sugestões vindas das entradas já detectadas: o dia do salário é a resposta
  // certa para quase todo mundo, e ele já está no servidor
  const suggestions = useMemo(() => {
    const seen = new Set<number>();
    return series
      .filter((item) => item.flow === "INCOME" && item.anchorDay != null)
      .filter((item) => {
        const day = item.anchorDay as number;
        if (day < MIN_CYCLE_ANCHOR_DAY || day > MAX_CYCLE_ANCHOR_DAY) return false;
        if (seen.has(day)) return false;
        seen.add(day);
        return true;
      })
      .slice(0, 3)
      .map((item) => ({
        day: item.anchorDay as number,
        label: item.displayName ?? item.merchantKey,
      }));
  }, [series]);

  const modeChanges =
    isCalendarMonthAnchor(draft) !== isCalendarMonthAnchor(anchorDay);

  const handlePick = (day: number) => {
    if (day === draft) return;
    Haptics.selectionAsync();
    setDraft(day);
  };

  const handleApply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCycleAnchorDay(draft);
    onClose();
    // A âncora muda o recorte de todas as consolidações abertas; sem recarregar,
    // a tela ficaria com o rótulo novo sobre os números velhos
    reloadAnalyticsForAnchorChange();
  };

  return (
    <CustomModal visible={visible} onClose={onClose}>
      <View
        style={{
          paddingHorizontal: spacing[5],
          paddingTop: spacing[3],
          paddingBottom: spacing[6],
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: spacing[2],
          }}
        >
          <Text
            style={{
              flex: 1,
              color: t.text.primary,
              fontSize: 20,
              fontWeight: "700",
            }}
          >
            Ciclo do mês
          </Text>
          <TouchableOpacity
            onPress={onClose}
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

        <Text
          style={{
            color: t.text.secondary,
            fontSize: 13,
            lineHeight: 19,
            marginBottom: spacing[4],
          }}
        >
          Seu mês não precisa começar no dia 1. Escolha o dia em que ele vira —
          normalmente o dia em que o salário cai.
        </Text>

        {/* Prévia: a janela que passa a valer, antes de aplicar */}
        <View
          accessible
          accessibilityLabel={
            previewSpoken
              ? `Prévia do ciclo atual, ${previewSpoken}`
              : "Prévia do ciclo atual"
          }
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: spacing[4],
            borderRadius: radius.xl,
            backgroundColor: t.background.elevated,
            borderWidth: 1,
            borderColor: t.border.subtle,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.full,
              backgroundColor: t.accent.neonMuted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CalendarRange size={18} color={t.accent.neon} />
          </View>
          <View style={{ flex: 1, marginLeft: spacing[3] }}>
            <Text style={{ color: t.text.tertiary, fontSize: 11 }}>
              Ciclo atual com o dia {draft}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                color: t.text.primary,
                fontSize: 16,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
                marginTop: 2,
              }}
            >
              {previewLabel ?? "—"}
            </Text>
          </View>
        </View>

        {suggestions.length > 0 && (
          <View style={{ marginTop: spacing[4] }}>
            <Text
              style={{
                color: t.text.tertiary,
                fontSize: 11,
                fontWeight: "700",
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: spacing[2],
              }}
            >
              Suas entradas
            </Text>
            <View
              style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}
            >
              {suggestions.map((item) => {
                const active = item.day === draft;
                return (
                  <TouchableOpacity
                    key={`${item.label}-${item.day}`}
                    onPress={() => handlePick(item.day)}
                    accessibilityLabel={`Usar o dia ${item.day}, de ${item.label}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    activeOpacity={0.8}
                    style={{
                      minHeight: 36,
                      justifyContent: "center",
                      paddingHorizontal: spacing[3],
                      borderRadius: radius.full,
                      backgroundColor: active
                        ? t.accent.neonMuted
                        : t.background.elevated,
                      borderWidth: 1,
                      borderColor: active ? t.accent.neon : t.border.subtle,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        color: active ? t.accent.neon : t.text.secondary,
                        fontSize: 12,
                        fontWeight: "700",
                        maxWidth: 200,
                      }}
                    >
                      {item.label} · dia {item.day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <Text
          style={{
            color: t.text.tertiary,
            fontSize: 11,
            fontWeight: "700",
            letterSpacing: 1,
            textTransform: "uppercase",
            marginTop: spacing[4],
            marginBottom: spacing[2],
          }}
        >
          Dia da virada
        </Text>

        {/* Grade 1–31: teclado numérico é o gesto natural para escolher um dia,
            e mantém a stack de estilo congelada (nada de DatePicker novo) */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: 232 }}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {DAYS.map((day) => {
              const active = day === draft;
              return (
                <View
                  key={day}
                  style={{ width: `${100 / 7}%`, padding: spacing[1] }}
                >
                  <TouchableOpacity
                    onPress={() => handlePick(day)}
                    accessibilityLabel={
                      day === 1 ? "Dia 1, o mês de calendário" : `Dia ${day}`
                    }
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    activeOpacity={0.8}
                    style={{
                      height: 44,
                      borderRadius: radius.lg,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: active
                        ? t.accent.neon
                        : t.background.elevated,
                      borderWidth: 1,
                      borderColor: active ? t.accent.neon : t.border.subtle,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? t.text.inverse : t.text.primary,
                        fontSize: 14,
                        fontWeight: "700",
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {draft >= SHORT_MONTH_RISK_DAY && (
          <Text
            style={{
              color: t.text.tertiary,
              fontSize: 11,
              lineHeight: 16,
              marginTop: spacing[2],
            }}
          >
            Nos meses que não têm o dia {draft}, o ciclo vira no último dia do
            mês.
          </Text>
        )}

        {/* O aviso que impede a troca silenciosa de significado do delta */}
        {modeChanges && (
          <View
            style={{
              flexDirection: "row",
              marginTop: spacing[3],
              padding: spacing[3],
              borderRadius: radius.lg,
              backgroundColor: t.semantic.infoMuted,
            }}
          >
            <Info size={15} color={t.semantic.info} />
            <Text
              style={{
                flex: 1,
                marginLeft: spacing[2],
                color: t.semantic.info,
                fontSize: 12,
                lineHeight: 17,
              }}
            >
              {isCalendarMonthAnchor(draft)
                ? "Voltando ao dia 1, a comparação passa a ser com o mês anterior do calendário."
                : "Fora do dia 1, a comparação passa a ser com a janela anterior de mesmo tamanho — não com o mês anterior. Os percentuais mudam por isso."}
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={handleApply}
          accessibilityLabel={`Usar o dia ${draft} como início do ciclo`}
          accessibilityRole="button"
          activeOpacity={0.85}
          style={{
            height: 52,
            marginTop: spacing[4],
            borderRadius: radius.full,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.accent.neon,
          }}
        >
          <Text
            style={{ color: t.text.inverse, fontSize: 15, fontWeight: "700" }}
          >
            {draft === anchorDay ? "Manter o dia " + draft : "Usar o dia " + draft}
          </Text>
        </TouchableOpacity>
      </View>
    </CustomModal>
  );
}
