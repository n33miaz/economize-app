import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import ChevronRight from "lucide-react-native/dist/esm/icons/chevron-right";
import CircleAlert from "lucide-react-native/dist/esm/icons/circle-alert";
import RotateCcw from "lucide-react-native/dist/esm/icons/rotate-ccw";
import X from "lucide-react-native/dist/esm/icons/x";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import * as Haptics from "../utils/haptics";

import type { AppTheme } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { usePressScale } from "../theme/motionPresets";
import { useCategoriesStore } from "../store/categoriesStore";
import { useRecurrenceStore } from "../store/recurrenceStore";
import { useToastStore } from "../store/toastStore";
import CategoryIcon from "../components/CategoryIcon";
import CategoryPickerSheet from "../components/CategoryPickerSheet";
import PageContainer from "../components/PageContainer";
import ScreenHeader from "../components/ScreenHeader";
import SectionTitle from "../components/SectionTitle";
import SegmentedControl from "../components/SegmentedControl";
import { formatBRL } from "../utils/money";
import {
  FLOW_LABELS,
  type RecurrenceFormValues,
  type SchedulableCadence,
  buildCreatePayload,
  buildUpdatePayload,
  cadenceUsesAnchorDay,
  emptyFormValues,
  formValuesFromSeries,
  formatDateInput,
  parseAmountInput,
  toIsoDate,
} from "../utils/recurrence";

const FLOW_OPTIONS = [
  { label: "Saída", value: "EXPENSE" as const },
  { label: "Entrada", value: "INCOME" as const },
];

const CADENCE_OPTIONS = [
  { label: "Mensal", value: "MONTHLY" as SchedulableCadence },
  { label: "Semanal", value: "WEEKLY" as SchedulableCadence },
  { label: "Trimestral", value: "QUARTERLY" as SchedulableCadence },
];

const AMOUNT_TYPE_OPTIONS = [
  { label: "Fixo", value: "FIXED" as const },
  { label: "Variável", value: "VARIABLE" as const },
];

/** Rótulo + campo, com o mesmo respiro em todo o formulário. */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={{ marginTop: spacing[4] }}>
      <Text
        style={{
          color: t.text.secondary,
          fontSize: 13,
          fontWeight: "700",
          marginBottom: spacing[2],
        }}
      >
        {label}
      </Text>
      {children}
      {hint ? (
        <Text
          style={{
            color: t.text.tertiary,
            fontSize: 12,
            lineHeight: 16,
            marginTop: spacing[2],
          }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Criar e editar agendamento (série `source=USER`). É tela de pilha, e não
 * sheet: o seletor de categoria já é um `Modal` próprio e empilhar `Modal`
 * dentro de `Modal` é justamente o que o React Native não garante nas três
 * plataformas — aqui o sheet abre por cima de uma tela comum.
 */
export default function RecurrenceForm() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  // Os dois temas são estruturalmente idênticos; o cast normaliza os literais
  // `as const` para o tipo que o CategoryIcon espera
  const t = useTheme() as AppTheme;
  const savePress = usePressScale();
  const showToast = useToastStore((s) => s.showToast);

  const params = route.params as { seriesId?: string } | undefined;
  const [editingId, setEditingId] = useState<string | null>(
    params?.seriesId ?? null,
  );

  const activeSeries = useRecurrenceStore((s) => s.series);
  const dismissedSeries = useRecurrenceStore((s) => s.dismissed);
  const isSaving = useRecurrenceStore((s) => s.isSaving);
  const createSeries = useRecurrenceStore((s) => s.createSeries);
  const updateSeries = useRecurrenceStore((s) => s.updateSeries);
  const reactivateSeries = useRecurrenceStore((s) => s.reactivateSeries);
  const fetchSeries = useRecurrenceStore((s) => s.fetchSeries);
  const fetchDismissed = useRecurrenceStore((s) => s.fetchDismissed);

  const categories = useCategoriesStore((s) => s.items);
  const fetchCategories = useCategoriesStore((s) => s.fetch);

  const editing = useMemo(() => {
    if (!editingId) return null;
    return (
      activeSeries.find((item) => item.id === editingId) ??
      dismissedSeries.find((item) => item.id === editingId) ??
      null
    );
  }, [editingId, activeSeries, dismissedSeries]);

  const [values, setValues] = useState<RecurrenceFormValues>(() =>
    editing ? formValuesFromSeries(editing) : emptyFormValues(),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [conflict, setConflict] = useState<{
    message: string;
    seriesId: string | null;
  } | null>(null);

  // Semear o formulário uma vez por série: sem a trava, qualquer atualização
  // da lista no store (uma varredura em segundo plano, por exemplo) apagaria o
  // que o usuário está digitando
  const seededId = useRef<string | null>(editingId);
  useEffect(() => {
    if (editing && seededId.current !== editing.id) {
      seededId.current = editing.id;
      setValues(formValuesFromSeries(editing));
    }
  }, [editing]);

  useEffect(() => {
    if (categories.length === 0) fetchCategories();
  }, [categories.length, fetchCategories]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === values.categoryId) ?? null,
    [categories, values.categoryId],
  );

  const setField = useCallback(
    <K extends keyof RecurrenceFormValues>(
      key: K,
      value: RecurrenceFormValues[K],
    ) => {
      setValues((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // Espelha a regra do servidor em vez de esperar o 400: semana não tem dia do
  // mês, então o campo some E o valor sai do estado
  const handleCadenceChange = useCallback((next: SchedulableCadence) => {
    setValues((prev) => ({
      ...prev,
      cadence: next,
      anchorDay: cadenceUsesAnchorDay(next)
        ? prev.anchorDay || String(new Date().getDate())
        : "",
    }));
  }, []);

  const handleEditExisting = useCallback(
    async (seriesId: string) => {
      Haptics.selectionAsync();
      const known =
        activeSeries.some((item) => item.id === seriesId) ||
        dismissedSeries.some((item) => item.id === seriesId);
      // a série do conflito pode estar descartada (fora da lista de ativas) ou
      // ter acabado de nascer numa varredura — recarregar as duas listas cobre
      // os dois casos antes de trocar o formulário para edição
      if (!known) await Promise.all([fetchSeries(), fetchDismissed()]);
      setConflict(null);
      setEditingId(seriesId);
    },
    [activeSeries, dismissedSeries, fetchSeries, fetchDismissed],
  );

  const handleReactivate = useCallback(async () => {
    if (!editing) return;
    const result = await reactivateSeries(editing.id);
    showToast(result.message, result.ok ? "success" : "error");
  }, [editing, reactivateSeries, showToast]);

  const handleSave = useCallback(async () => {
    // o disabled do botão depende de re-render: dois toques no mesmo frame
    // chegariam aqui duas vezes — o estado fresco do store não mente
    if (useRecurrenceStore.getState().isSaving) return;
    Haptics.selectionAsync();
    setConflict(null);

    if (editing) {
      const built = buildUpdatePayload(values, editing);
      if (!built.ok) {
        showToast(built.message, "warning");
        return;
      }
      const outcome = await updateSeries(editing.id, built.payload);
      if (outcome.status !== "saved") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showToast(
          outcome.status === "error" ? outcome.message : "Não foi possível salvar.",
          "error",
        );
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(
        built.notices.length > 0
          ? `Recorrência salva. ${built.notices.join(" ")}`
          : "Recorrência salva.",
        built.notices.length > 0 ? "info" : "success",
      );
      navigation.goBack();
      return;
    }

    const built = buildCreatePayload(values);
    if (!built.ok) {
      showToast(built.message, "warning");
      return;
    }
    const outcome = await createSeries(built.payload);
    if (outcome.status === "conflict") {
      // 409 não é erro de digitação: o servidor manda o id da série existente
      // justamente para a tela oferecer a edição dela
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setConflict({ message: outcome.message, seriesId: outcome.seriesId });
      return;
    }
    if (outcome.status === "error") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(outcome.message, "error");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast("Agendamento criado.", "success");
    navigation.goBack();
  }, [editing, values, updateSeries, createSeries, showToast, navigation]);

  const amountPreview = parseAmountInput(values.expectedAmount);
  const isDismissedSeries = editing !== null && !editing.active;
  const title = editing ? "Editar recorrência" : "Novo agendamento";

  return (
    <PageContainer>
      <ScreenHeader
        title={title}
        subtitle={
          editing
            ? "Ajuste o ritmo, o valor e a vigência"
            : "Declare um gasto fixo ou uma renda que se repete"
        }
        showInfoButton={false}
        showProfileButton={false}
        topInset={false}
        rightActions={[
          <TouchableOpacity
            key="close"
            onPress={() => navigation.goBack()}
            accessibilityLabel="Fechar sem salvar"
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

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing[5],
          paddingBottom: insets.bottom + spacing[12],
        }}
      >
        {conflict && (
          <View
            style={{
              marginTop: spacing[4],
              borderRadius: radius.xl,
              borderWidth: 1,
              borderColor: t.semantic.warning,
              backgroundColor: t.semantic.warningMuted,
              padding: spacing[4],
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <CircleAlert size={18} color={t.semantic.warning} />
              <Text
                style={{
                  flex: 1,
                  marginLeft: spacing[2],
                  color: t.semantic.warning,
                  fontSize: 13,
                  fontWeight: "700",
                }}
              >
                Essa cobrança já tem recorrência
              </Text>
            </View>
            <Text
              style={{
                color: t.text.secondary,
                fontSize: 13,
                lineHeight: 19,
                marginTop: spacing[2],
              }}
            >
              {conflict.message}
            </Text>
            {conflict.seriesId ? (
              <TouchableOpacity
                onPress={() => handleEditExisting(conflict.seriesId as string)}
                accessibilityLabel="Abrir a recorrência que já existe para editar"
                accessibilityRole="button"
                activeOpacity={0.85}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 44,
                  marginTop: spacing[3],
                  borderRadius: radius.full,
                  backgroundColor: t.semantic.warning,
                  paddingHorizontal: spacing[5],
                }}
              >
                <Text
                  style={{
                    color: t.text.inverse,
                    fontSize: 13,
                    fontWeight: "700",
                  }}
                >
                  Editar a que já existe
                </Text>
                <ChevronRight size={16} color={t.text.inverse} />
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {isDismissedSeries && (
          <View
            style={{
              marginTop: spacing[4],
              borderRadius: radius.xl,
              borderWidth: 1,
              borderColor: t.border.default,
              backgroundColor: t.background.elevated,
              padding: spacing[4],
            }}
          >
            <Text
              style={{ color: t.text.primary, fontSize: 13, fontWeight: "700" }}
            >
              Esta recorrência está descartada
            </Text>
            <Text
              style={{
                color: t.text.secondary,
                fontSize: 13,
                lineHeight: 19,
                marginTop: spacing[1],
              }}
            >
              Ela não entra na previsão nem volta pela varredura enquanto estiver
              assim. Reative para voltar a acompanhar.
            </Text>
            <TouchableOpacity
              onPress={handleReactivate}
              accessibilityLabel="Reativar esta recorrência"
              accessibilityRole="button"
              activeOpacity={0.85}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 44,
                marginTop: spacing[3],
                borderRadius: radius.full,
                backgroundColor: t.accent.neonMuted,
                borderWidth: 1,
                borderColor: t.accent.neon,
              }}
            >
              <RotateCcw size={16} color={t.accent.neon} />
              <Text
                style={{
                  color: t.accent.neon,
                  fontSize: 13,
                  fontWeight: "700",
                  marginLeft: spacing[2],
                }}
              >
                Reativar
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <SectionTitle>O que se repete</SectionTitle>

        <Field
          label="Nome"
          hint="É por este nome que o app procura a cobrança no seu extrato — prefira o nome de quem cobra."
        >
          <TextInput
            className="rounded-xl px-4 text-base"
            style={{
              minHeight: 48,
              backgroundColor: t.background.elevated,
              color: t.text.primary,
              borderWidth: 1,
              borderColor: t.border.default,
            }}
            placeholder="Ex: Spotify, Conta de luz, Salário"
            placeholderTextColor={t.text.tertiary}
            value={values.displayName}
            onChangeText={(text) => setField("displayName", text)}
            maxLength={160}
            accessibilityLabel="Nome da recorrência"
          />
        </Field>

        <Field
          label="Entra ou sai"
          hint={
            editing
              ? "O tipo não muda depois de criada — para inverter, exclua esta e agende outra."
              : undefined
          }
        >
          {editing ? (
            // O PATCH não aceita trocar o fluxo: deixar o controle editável
            // fazia a troca "salvar" com sucesso sem mudar nada no servidor.
            // O rótulo vem do fluxo REAL da série (uma transferência interna
            // não pode aparecer aqui como "Saída")
            <View
              accessible
              accessibilityLabel={`Tipo fixo desta recorrência: ${FLOW_LABELS[
                editing.flow
              ].toLowerCase()}`}
              style={{
                minHeight: 48,
                justifyContent: "center",
                paddingHorizontal: spacing[4],
                borderRadius: radius.xl,
                backgroundColor: t.background.elevated,
                borderWidth: 1,
                borderColor: t.border.subtle,
              }}
            >
              <Text
                style={{ color: t.text.primary, fontSize: 15, fontWeight: "600" }}
              >
                {FLOW_LABELS[editing.flow]}
              </Text>
            </View>
          ) : (
            <SegmentedControl
              options={FLOW_OPTIONS}
              value={values.flow}
              onChange={(next) => setField("flow", next)}
              size="md"
            />
          )}
        </Field>

        <Field
          label="Com que frequência"
          // A previsão projeta a semanal como 4,33 ocorrências por mês; avisar
          // aqui evita o susto do valor mensal ~4,3× maior lá na perspectiva
          hint={
            values.cadence === "WEEKLY"
              ? "Na previsão de saldo, uma cobrança semanal conta ~4,3 vezes por mês."
              : undefined
          }
        >
          <SegmentedControl
            options={CADENCE_OPTIONS}
            value={values.cadence}
            onChange={handleCadenceChange}
            size="md"
          />
        </Field>

        {cadenceUsesAnchorDay(values.cadence) && (
          <Field
            label="Dia da cobrança"
            hint="Dia do mês em que costuma cair. Meses curtos ajustam sozinhos."
          >
            <TextInput
              className="rounded-xl px-4 text-base"
              style={{
                minHeight: 48,
                backgroundColor: t.background.elevated,
                color: t.text.primary,
                borderWidth: 1,
                borderColor: t.border.default,
              }}
              placeholder="Ex: 10"
              placeholderTextColor={t.text.tertiary}
              value={values.anchorDay}
              onChangeText={(text) =>
                setField("anchorDay", text.replace(/[^\d]/g, "").slice(0, 2))
              }
              keyboardType="number-pad"
              accessibilityLabel="Dia do mês em que a cobrança cai"
            />
          </Field>
        )}

        <SectionTitle>Quanto</SectionTitle>

        <Field
          label="Valor esperado"
          // O eco do valor interpretado é a defesa visível contra grafia
          // ambígua ("2.500" é milhar, "2,50" é decimal): o número que vai ser
          // gravado aparece por extenso antes do salvar
          hint={
            amountPreview !== null
              ? `Entendido como ${formatBRL(amountPreview)}.`
              : undefined
          }
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              minHeight: 48,
              paddingHorizontal: spacing[4],
              borderRadius: radius.xl,
              backgroundColor: t.background.elevated,
              borderWidth: 1,
              borderColor: t.border.default,
            }}
          >
            <Text
              style={{ color: t.text.tertiary, fontSize: 16, fontWeight: "700" }}
            >
              R$
            </Text>
            <TextInput
              style={{
                flex: 1,
                marginLeft: spacing[2],
                fontSize: 16,
                color: t.text.primary,
              }}
              placeholder="0,00"
              placeholderTextColor={t.text.tertiary}
              value={values.expectedAmount}
              onChangeText={(text) => setField("expectedAmount", text)}
              keyboardType="decimal-pad"
              accessibilityLabel="Valor esperado da recorrência, em reais"
            />
          </View>
        </Field>

        <Field
          label="Tipo de valor"
          hint={
            values.amountType === "FIXED"
              ? "Assinatura ou plano: o valor é sempre o mesmo."
              : "Conta de consumo: o valor muda todo mês e o app usa este como média."
          }
        >
          <SegmentedControl
            options={AMOUNT_TYPE_OPTIONS}
            value={values.amountType}
            onChange={(next) => setField("amountType", next)}
            size="md"
          />
        </Field>

        <Field label="Categoria">
          <TouchableOpacity
            onPress={() => setPickerOpen(true)}
            accessibilityLabel={
              selectedCategory
                ? `Categoria ${selectedCategory.name}. Toque para trocar`
                : "Escolher categoria"
            }
            accessibilityRole="button"
            activeOpacity={0.8}
            style={{
              flexDirection: "row",
              alignItems: "center",
              minHeight: 56,
              paddingHorizontal: spacing[3],
              borderRadius: radius.xl,
              backgroundColor: t.background.elevated,
              borderWidth: 1,
              borderColor: t.border.default,
            }}
          >
            <CategoryIcon category={selectedCategory} theme={t} size={36} />
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                marginHorizontal: spacing[3],
                color: selectedCategory ? t.text.primary : t.text.tertiary,
                fontSize: 15,
                fontWeight: selectedCategory ? "600" : "400",
              }}
            >
              {selectedCategory ? selectedCategory.name : "Sem categoria"}
            </Text>
            <ChevronRight size={18} color={t.text.tertiary} />
          </TouchableOpacity>
        </Field>

        <SectionTitle>Por quanto tempo</SectionTitle>

        <Field label="Começa em">
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            <TextInput
              className="rounded-xl px-4 text-base"
              style={{
                flex: 1,
                minHeight: 48,
                backgroundColor: t.background.elevated,
                color: t.text.primary,
                borderWidth: 1,
                borderColor: t.border.default,
              }}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={t.text.tertiary}
              value={values.startsAt}
              onChangeText={(text) => setField("startsAt", text)}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Data de início da vigência, no formato dia, mês e ano"
            />
            <TouchableOpacity
              onPress={() =>
                setField("startsAt", formatDateInput(toIsoDate(new Date())))
              }
              accessibilityLabel="Usar a data de hoje como início"
              accessibilityRole="button"
              activeOpacity={0.8}
              style={{
                minHeight: 48,
                paddingHorizontal: spacing[4],
                borderRadius: radius.xl,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: t.background.surface,
                borderWidth: 1,
                borderColor: t.border.subtle,
              }}
            >
              <Text
                style={{ color: t.text.primary, fontSize: 13, fontWeight: "700" }}
              >
                Hoje
              </Text>
            </TouchableOpacity>
          </View>
        </Field>

        <Field
          label="Termina em (opcional)"
          hint="Deixe vazio para uma cobrança sem prazo. Serve para contrato e parcelamento com fim conhecido."
        >
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            <TextInput
              className="rounded-xl px-4 text-base"
              style={{
                flex: 1,
                minHeight: 48,
                backgroundColor: t.background.elevated,
                color: t.text.primary,
                borderWidth: 1,
                borderColor: t.border.default,
              }}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={t.text.tertiary}
              value={values.endsAt}
              onChangeText={(text) => setField("endsAt", text)}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Data de fim da vigência, no formato dia, mês e ano"
            />
            <TouchableOpacity
              onPress={() => setField("endsAt", "")}
              accessibilityLabel="Deixar sem data de fim"
              accessibilityRole="button"
              activeOpacity={0.8}
              style={{
                minHeight: 48,
                paddingHorizontal: spacing[4],
                borderRadius: radius.xl,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: t.background.surface,
                borderWidth: 1,
                borderColor: t.border.subtle,
              }}
            >
              <Text
                style={{ color: t.text.primary, fontSize: 13, fontWeight: "700" }}
              >
                Sem fim
              </Text>
            </TouchableOpacity>
          </View>
        </Field>

        {/* O servidor promove série detectada a "agendada por você" em qualquer
            PATCH — sem este aviso, o selo do card mudava sem explicação */}
        {editing?.source === "DETECTED" && (
          <Text
            style={{
              color: t.text.tertiary,
              fontSize: 12,
              lineHeight: 17,
              marginTop: spacing[4],
            }}
          >
            Esta recorrência foi detectada no seu extrato. Ao salvar um ajuste,
            ela passa a contar como agendada por você.
          </Text>
        )}

        <Animated.View style={[savePress.pressStyle, { marginTop: spacing[6] }]}>
          <TouchableOpacity
            onPress={handleSave}
            onPressIn={savePress.onPressIn}
            onPressOut={savePress.onPressOut}
            disabled={isSaving}
            accessibilityLabel={
              editing
                ? "Salvar alterações da recorrência"
                : `Criar agendamento${
                    amountPreview !== null
                      ? ` de ${amountPreview.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}`
                      : ""
                  }`
            }
            accessibilityRole="button"
            accessibilityState={{ disabled: isSaving }}
            activeOpacity={0.85}
            style={{
              minHeight: 52,
              borderRadius: radius.full,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: t.accent.neon,
              opacity: isSaving ? 0.7 : 1,
            }}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={t.text.inverse} />
            ) : (
              <Text
                style={{ color: t.text.inverse, fontSize: 15, fontWeight: "700" }}
              >
                {editing ? "Salvar" : "Criar agendamento"}
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      <CategoryPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedId={values.categoryId}
        onSelect={(category) => setField("categoryId", category.id)}
        // limpar só existe na criação: o PATCH não aceita remover categoria
        onClear={editing ? undefined : () => setField("categoryId", null)}
      />
    </PageContainer>
  );
}
