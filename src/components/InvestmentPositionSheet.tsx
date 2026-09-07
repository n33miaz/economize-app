import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import X from "lucide-react-native/dist/esm/icons/x";

import type {
  InvestmentIndexer,
  InvestmentPosition,
  InvestmentType,
} from "../services/api";
import { getApiErrorDetail, getApiErrorStatus } from "../services/api";
import { useInvestmentStore } from "../store/investmentStore";
import { useToastStore } from "../store/toastStore";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import * as Haptics from "../utils/haptics";
import {
  DEFAULT_FOREIGN_MARKET,
  INVESTMENT_TYPE_ORDER,
  TICKER_TYPES,
  indexerLabel,
  indexersForType,
  interestSuggestedBy,
  investmentTypeLabel,
  isForeignTickerForm,
  positionToFormValues,
  validatePositionForm,
  type PositionFormErrors,
  type PositionFormValues,
} from "../utils/investments";
import CustomModal from "./CustomModal";
import FilterChipRow from "./FilterChipRow";
import FloatingLabelInput from "./FloatingLabelInput";
import SegmentedControl from "./SegmentedControl";

interface InvestmentPositionSheetProps {
  visible: boolean;
  /** Posição em edição; `null` cadastra uma nova. */
  position: InvestmentPosition | null;
  onClose: () => void;
  onSaved?: (position: InvestmentPosition) => void;
}

const CURRENCY_OPTIONS = [
  { label: "Real (R$)", value: "BRL" },
  { label: "Dólar (US$)", value: "USD" },
];

/** Ticker da B3 termina em dígito (PETR4, BOVA11); o do exterior, não (VT, VOO). */
const looksForeign = (code: string) =>
  /^[A-Z]{1,5}$/.test(code.trim().toUpperCase());

function describeSaveFailure(error: unknown): string {
  const status = getApiErrorStatus(error);
  if (status === 404) return "Este servidor ainda não aceita cadastro manual.";
  if (status === 409) {
    return "Só posição cadastrada à mão pode ser editada — as do banco são espelho dele.";
  }
  return getApiErrorDetail(error) ?? "Não foi possível salvar a posição.";
}

/**
 * Cadastro e edição da posição MANUAL (EC-15x).
 *
 * O formulário pede o mínimo para a posição ter valor: nome, tipo e uma
 * medida de quanto foi investido. Tudo o mais é opcional e aparece na ordem
 * em que alguém lê um comprovante: código, quantidade e preço, indexador e
 * taxa, vencimento. Para ETF no exterior a folha sugere dólar e oferece
 * acompanhar o ticker — sem a cotação a posição fica sem valor em reais.
 */
export default function InvestmentPositionSheet({
  visible,
  position,
  onClose,
  onSaved,
}: InvestmentPositionSheetProps) {
  const t = useTheme();
  const showToast = useToastStore((s) => s.showToast);
  const createPosition = useInvestmentStore((s) => s.createPosition);
  const updatePosition = useInvestmentStore((s) => s.updatePosition);
  const addInterest = useInvestmentStore((s) => s.addInterest);

  const [values, setValues] = useState<PositionFormValues>(() =>
    positionToFormValues(position),
  );
  const [errors, setErrors] = useState<PositionFormErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [followTicker, setFollowTicker] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  // Trava contra o duplo toque: o `isSaving` do estado só vale no render
  // seguinte, e dois toques no mesmo quadro criariam duas posições
  const savingRef = useRef(false);

  // Abrir para outra posição (ou para uma nova) começa do zero — o rascunho da
  // anterior não pode vazar para a seguinte
  useEffect(() => {
    if (!visible) return;
    setValues(positionToFormValues(position));
    setErrors({});
    setFailure(null);
    setFollowTicker(true);
    savingRef.current = false;
    setIsSaving(false);
  }, [visible, position]);

  const isEditing = position !== null;
  const indexerOptions = useMemo(
    () => indexersForType(values.type),
    [values.type],
  );
  const isTickerType = TICKER_TYPES.includes(values.type);
  const foreign = isForeignTickerForm(values);
  // Sugestão, não decisão: ETF/ação com ticker de fora e moeda ainda em real
  const suggestDollar =
    isTickerType && values.currency === "BRL" && looksForeign(values.code);

  const patch = (field: keyof PositionFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const changeType = (type: InvestmentType) => {
    setValues((prev) => {
      const allowed = indexersForType(type);
      return {
        ...prev,
        type,
        // O indexador anterior pode não fazer sentido no tipo novo (CDI numa
        // ação): cai no primeiro que faz
        indexer: allowed.includes(prev.indexer) ? prev.indexer : allowed[0],
      };
    });
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    const validation = validatePositionForm(values);
    if (!validation.ok) {
      setErrors(validation.errors);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    savingRef.current = true;
    setIsSaving(true);
    setFailure(null);
    try {
      const saved = isEditing
        ? await updatePosition(position.id, validation.payload)
        : await createPosition(validation.payload);
      // O ticker no exterior só ganha preço se alguém pedir a cotação: quem
      // cadastra a VT quer vê-la em reais, então o acompanhamento vem junto
      const suggested = interestSuggestedBy(validation.payload);
      if (suggested && followTicker) {
        try {
          await addInterest(suggested);
        } catch {
          // A posição já está salva; o acompanhamento pode ser pedido depois
          // pelo "+ acompanhar" — não vale transformar o sucesso em erro
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved?.(saved);
      onClose();
      showToast(isEditing ? "Posição atualizada." : "Posição cadastrada.", "success");
    } catch (e) {
      // Erro fica NA folha, e não em toast: o Toast é montado fora do Modal e
      // pode não aparecer por cima dele
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFailure(describeSaveFailure(e));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const fieldGap = { marginBottom: spacing[3] };

  return (
    <CustomModal visible={visible} onClose={onClose}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: spacing[5],
          paddingTop: spacing[3],
          paddingBottom: spacing[6],
        }}
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
            <Text
              style={{ color: t.text.primary, fontSize: 18, fontWeight: "700" }}
            >
              {isEditing ? "Editar posição" : "Cadastrar investimento"}
            </Text>
            <Text
              style={{ color: t.text.secondary, fontSize: 12, marginTop: 2 }}
            >
              {isEditing
                ? "Só posição cadastrada à mão pode ser editada aqui."
                : "Para o que o banco não trouxe: CDB em outra corretora, ETF lá fora, cripto."}
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

        <Text style={[labelStyle(t), { marginBottom: spacing[2] }]}>Tipo</Text>
        <View style={fieldGap}>
          <FilterChipRow
            options={INVESTMENT_TYPE_ORDER.map((type) => ({
              key: type,
              label: investmentTypeLabel(type),
            }))}
            value={values.type}
            onChange={(key) => changeType(key as InvestmentType)}
            spokenPrefix="Tipo"
          />
        </View>

        <View style={fieldGap}>
          <FloatingLabelInput
            label="Nome"
            value={values.name}
            onChangeText={(text) => patch("name", text)}
            error={errors.name}
            autoCapitalize="sentences"
            returnKeyType="next"
          />
          {errors.name ? <FieldError message={errors.name} /> : null}
        </View>

        <View style={fieldGap}>
          <FloatingLabelInput
            label="Instituição (opcional)"
            value={values.institution}
            onChangeText={(text) => patch("institution", text)}
            autoCapitalize="words"
          />
        </View>

        <View style={fieldGap}>
          <FloatingLabelInput
            label={isTickerType ? "Código do ativo" : "Código (opcional)"}
            value={values.code}
            onChangeText={(text) => patch("code", text.toUpperCase())}
            error={errors.code}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {errors.code ? <FieldError message={errors.code} /> : null}
        </View>

        {isTickerType && (
          <View style={fieldGap}>
            <Text style={[labelStyle(t), { marginBottom: spacing[2] }]}>
              Moeda
            </Text>
            <SegmentedControl
              options={CURRENCY_OPTIONS}
              value={values.currency === "USD" ? "USD" : "BRL"}
              onChange={(next) => patch("currency", next)}
            />
            {suggestDollar ? (
              <TouchableOpacity
                onPress={() => patch("currency", "USD")}
                accessibilityLabel="Usar dólar e mercado americano"
                accessibilityRole="button"
                style={{ marginTop: spacing[2] }}
              >
                <Text style={{ color: t.accent.neon, fontSize: 12, fontWeight: "700" }}>
                  {`${values.code.trim().toUpperCase()} parece ser do exterior — usar dólar (mercado ${DEFAULT_FOREIGN_MARKET})?`}
                </Text>
              </TouchableOpacity>
            ) : null}
            {foreign ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: spacing[3],
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    color: t.text.secondary,
                    fontSize: 12,
                    lineHeight: 17,
                    marginRight: spacing[3],
                  }}
                >
                  {`Acompanhar a cotação no mercado ${DEFAULT_FOREIGN_MARKET} — é ela que dá o valor em reais.`}
                </Text>
                <Switch
                  value={followTicker}
                  onValueChange={setFollowTicker}
                  accessibilityLabel="Acompanhar a cotação do ticker"
                  trackColor={{ true: t.accent.neon, false: t.border.strong }}
                  thumbColor={t.text.inverse}
                />
              </View>
            ) : null}
          </View>
        )}

        <View style={{ flexDirection: "row", gap: spacing[3], ...fieldGap }}>
          <View style={{ flex: 1 }}>
            <FloatingLabelInput
              label="Quantidade"
              value={values.quantity}
              onChangeText={(text) => patch("quantity", text)}
              error={errors.quantity}
              keyboardType="decimal-pad"
            />
            {errors.quantity ? <FieldError message={errors.quantity} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <FloatingLabelInput
              label={foreign ? "Preço unitário (US$)" : "Preço unitário (R$)"}
              value={values.unitPrice}
              onChangeText={(text) => patch("unitPrice", text)}
              error={errors.unitPrice}
              keyboardType="decimal-pad"
            />
            {errors.unitPrice ? <FieldError message={errors.unitPrice} /> : null}
          </View>
        </View>

        <View style={fieldGap}>
          <FloatingLabelInput
            label="Valor investido (R$)"
            value={values.investedAmount}
            onChangeText={(text) => patch("investedAmount", text)}
            error={errors.investedAmount}
            keyboardType="decimal-pad"
          />
          {errors.investedAmount ? (
            <FieldError message={errors.investedAmount} />
          ) : null}
        </View>

        {!foreign && (
          <View style={fieldGap}>
            <FloatingLabelInput
              label="Valor atual (R$, opcional)"
              value={values.currentValue}
              onChangeText={(text) => patch("currentValue", text)}
              error={errors.currentValue}
              keyboardType="decimal-pad"
            />
            {errors.currentValue ? (
              <FieldError message={errors.currentValue} />
            ) : null}
          </View>
        )}

        {indexerOptions.length > 1 && (
          <>
            <Text style={[labelStyle(t), { marginBottom: spacing[2] }]}>
              Indexador
            </Text>
            <View style={fieldGap}>
              <FilterChipRow
                options={indexerOptions.map((indexer) => ({
                  key: indexer,
                  label: indexer === "NONE" ? "Sem indexador" : indexerLabel(indexer),
                }))}
                value={values.indexer}
                onChange={(key) => patch("indexer", key as InvestmentIndexer)}
                spokenPrefix="Indexador"
              />
            </View>
          </>
        )}

        {values.indexer !== "NONE" && (
          <View style={fieldGap}>
            <FloatingLabelInput
              label={rateLabel(values.indexer)}
              value={values.rate}
              onChangeText={(text) => patch("rate", text)}
              error={errors.rate}
              keyboardType="decimal-pad"
            />
            {errors.rate ? <FieldError message={errors.rate} /> : null}
          </View>
        )}

        {!isTickerType && (
          <View style={fieldGap}>
            <FloatingLabelInput
              label="Vencimento (dd/mm/aaaa, opcional)"
              value={values.maturityDate}
              onChangeText={(text) => patch("maturityDate", text)}
              error={errors.maturityDate}
              keyboardType="numbers-and-punctuation"
            />
            {errors.maturityDate ? (
              <FieldError message={errors.maturityDate} />
            ) : null}
          </View>
        )}

        {failure ? (
          <Text
            accessibilityRole="alert"
            style={{
              color: t.semantic.danger,
              fontSize: 13,
              lineHeight: 18,
              marginBottom: spacing[3],
            }}
          >
            {failure}
          </Text>
        ) : null}

        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          accessibilityLabel={isEditing ? "Salvar alterações" : "Cadastrar posição"}
          accessibilityRole="button"
          accessibilityState={{ disabled: isSaving }}
          activeOpacity={0.85}
          style={{
            height: 52,
            borderRadius: radius.full,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.accent.neon,
            opacity: isSaving ? 0.7 : 1,
            marginTop: spacing[2],
          }}
        >
          {isSaving ? (
            <ActivityIndicator color={t.text.inverse} />
          ) : (
            <Text style={{ color: t.text.inverse, fontSize: 15, fontWeight: "700" }}>
              {isEditing ? "Salvar alterações" : "Cadastrar posição"}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </CustomModal>
  );
}

/** A taxa na gramática do indexador — o rótulo do campo é quem ensina a unidade. */
function rateLabel(indexer: InvestmentIndexer): string {
  switch (indexer) {
    case "CDI":
      return "Taxa (% do CDI, ex.: 110)";
    case "IPCA":
      return "Taxa (IPCA + % a.a., ex.: 6,2)";
    case "SELIC":
      return "Taxa (Selic + % a.a., ex.: 0,1)";
    case "PREFIXADO":
      return "Taxa (% a.a., ex.: 12,5)";
    case "USD":
      return "Taxa (Dólar + % a.a., opcional)";
    default:
      return "Taxa (% a.a., opcional)";
  }
}

const labelStyle = (t: ReturnType<typeof useTheme>) => ({
  color: t.text.tertiary,
  fontSize: 11,
  fontWeight: "700" as const,
  letterSpacing: 1.2,
  textTransform: "uppercase" as const,
});

function FieldError({ message }: { message: string }) {
  const t = useTheme();
  return (
    <Text
      style={{
        color: t.semantic.danger,
        fontSize: 12,
        lineHeight: 16,
        marginTop: spacing[1],
        marginLeft: spacing[1],
      }}
    >
      {message}
    </Text>
  );
}
