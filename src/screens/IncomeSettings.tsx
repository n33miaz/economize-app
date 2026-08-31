import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import BadgeCheck from "lucide-react-native/dist/esm/icons/badge-check";
import Banknote from "lucide-react-native/dist/esm/icons/banknote";
import Clock from "lucide-react-native/dist/esm/icons/clock";
import Plus from "lucide-react-native/dist/esm/icons/plus";
import Trash2 from "lucide-react-native/dist/esm/icons/trash-2";

import { useTheme } from "../theme/ThemeProvider";
import { spacing } from "../theme/ds";
import { useWishStore } from "../store/wishStore";
import { askConfirm } from "../store/confirmStore";
import { useToastStore } from "../store/toastStore";
import { formatBRL } from "../utils/money";
import { formatHours, incomeKindLabel } from "../utils/wishes";
import type { IncomeSource, IncomeSourceKind } from "../services/api";

import ScreenHeader from "../components/ScreenHeader";
import PageContainer from "../components/PageContainer";
import SectionTitle from "../components/SectionTitle";
import CustomModal from "../components/CustomModal";
import FloatingLabelInput from "../components/FloatingLabelInput";
import Skeleton from "../components/Skeleton";
import ErrorState from "../components/ErrorState";

// O CustomModal entrega só a folha; o respiro lateral é de quem usa, como em
// Categorias e Carteira. Sem ele o conteúdo cola nas duas bordas.
const SHEET_PADDING = {
  paddingHorizontal: spacing[5],
  paddingTop: spacing[3],
  paddingBottom: spacing[6],
} as const;

const KINDS: IncomeSourceKind[] = [
  "SALARY",
  "MEAL_VOUCHER",
  "FOOD_VOUCHER",
  "ADVANCE",
  "OTHER",
];

function parseAmount(raw: string): number | null {
  const cleaned = raw.trim().replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function KindChip({
  kind,
  selected,
  onPress,
}: {
  kind: IncomeSourceKind;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`px-3 py-2 rounded-xl border mr-2 mb-2 ${
        selected ? "bg-accent border-accent" : "bg-elevated border-border"
      }`}
    >
      <Text
        className={`text-xs font-bold ${
          selected ? "text-background" : "text-textSecondary"
        }`}
      >
        {incomeKindLabel(kind)}
      </Text>
    </Pressable>
  );
}

/**
 * De onde vem o dinheiro e quanto se trabalha por ele.
 *
 * <p>Duas coisas moram aqui porque se explicam juntas: a renda confirmada é o
 * numerador do valor da hora, e a jornada é o denominador. Separadas em duas
 * telas, ninguém entenderia por que preencher a segunda.
 */
export default function IncomeSettings() {
  const t = useTheme();
  const showToast = useToastStore((s) => s.showToast);
  const {
    income,
    isIncomeLoading,
    hasLoadedIncomeOnce,
    isSaving,
    incomeError,
    fetchIncome,
    addIncome,
    editIncome,
    removeIncome,
    acceptSuggestion,
    saveJourney,
  } = useWishStore();

  const [formOpen, setFormOpen] = useState(false);
  const [kind, setKind] = useState<IncomeSourceKind>("SALARY");
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [dia, setDia] = useState("");

  const [jornadaOpen, setJornadaOpen] = useState(false);
  const [dias, setDias] = useState("5");
  const [horas, setHoras] = useState("8");

  useEffect(() => {
    if (!hasLoadedIncomeOnce) fetchIncome();
  }, [hasLoadedIncomeOnce, fetchIncome]);

  // Abrir a jornada já preenchida com o que existe evita redigitar para mudar
  // meia hora — e deixa claro que é edição, não cadastro do zero
  useEffect(() => {
    if (income?.workProfile) {
      setDias(String(income.workProfile.daysPerWeek));
      setHoras(String(income.workProfile.hoursPerDay));
    }
  }, [income?.workProfile]);

  const abrirForm = () => {
    setKind("SALARY");
    setNome("");
    setValor("");
    setDia("");
    setFormOpen(true);
  };

  const salvarFonte = async () => {
    if (!nome.trim()) {
      showToast("Dê um nome à fonte de renda.", "warning");
      return;
    }
    const montante = parseAmount(valor);
    const diaNum = dia.trim() ? Number(dia.trim()) : null;
    if (diaNum != null && (!Number.isInteger(diaNum) || diaNum < 1 || diaNum > 31)) {
      showToast("O dia deve estar entre 1 e 31.", "warning");
      return;
    }
    const result = await addIncome({
      kind,
      name: nome.trim(),
      expectedAmount: montante,
      anchorDay: diaNum,
    });
    showToast(result.message, result.ok ? "success" : "error");
    if (result.ok) setFormOpen(false);
  };

  const salvarJornada = async () => {
    const d = Number(dias.trim());
    const h = parseAmount(horas);
    if (!Number.isInteger(d) || d < 1 || d > 7) {
      showToast("Dias por semana deve estar entre 1 e 7.", "warning");
      return;
    }
    if (h == null || h <= 0 || h > 24) {
      showToast("Horas por dia deve estar entre 1 e 24.", "warning");
      return;
    }
    const result = await saveJourney({ daysPerWeek: d, hoursPerDay: h });
    showToast(result.message, result.ok ? "success" : "error");
    if (result.ok) setJornadaOpen(false);
  };

  const excluirFonte = (source: IncomeSource) => {
    askConfirm({
      title: "Remover fonte de renda?",
      message: `"${source.name}" sai da conta e o valor da sua hora será recalculado.`,
      confirmLabel: "Remover",
      cancelLabel: "Manter",
      destructive: true,
      onConfirm: async () => {
        const result = await removeIncome(source.id);
        showToast(result.message, result.ok ? "success" : "error");
      },
    });
  };

  const confirmar = async (source: IncomeSource) => {
    const result = await editIncome(source.id, { confirmed: true });
    showToast(result.message, result.ok ? "success" : "error");
  };

  if (incomeError && !hasLoadedIncomeOnce) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Renda e jornada" />
        <ErrorState message={incomeError} onRetry={fetchIncome} />
      </View>
    );
  }

  const perfil = income?.workProfile;

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Renda e jornada"
        subtitle="O que entra e quanto você trabalha por isso"
      />
      <PageContainer>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing[10] }}
        >
          {isIncomeLoading && !hasLoadedIncomeOnce ? (
            <>
              <Skeleton height={90} borderRadius={16} className="mb-3" />
              <Skeleton height={140} borderRadius={16} />
            </>
          ) : (
            <>
              {/* ------------------------------------------------ jornada */}
              <Pressable
                onPress={() => setJornadaOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Editar jornada de trabalho"
                className="bg-cardBackground rounded-2xl p-4 border border-border flex-row items-center"
              >
                <View
                  className="w-10 h-10 rounded-xl items-center justify-center"
                  style={{ backgroundColor: t.accent.neonMuted }}
                >
                  <Clock size={20} color={t.accent.neon} />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-sm font-bold text-textPrimary">
                    Sua jornada
                  </Text>
                  <Text className="text-xs text-textSecondary mt-0.5">
                    {perfil
                      ? `${perfil.daysPerWeek} dias por semana · ${formatHours(perfil.hoursPerDay)} por dia · ${formatHours(perfil.hoursPerMonth)} por mês`
                      : "Sem a jornada não dá para dizer quanto vale a sua hora"}
                  </Text>
                </View>
                <Text
                  className="text-xs font-bold"
                  style={{ color: t.accent.neon }}
                >
                  {perfil ? "Editar" : "Informar"}
                </Text>
              </Pressable>

              {/* --------------------------------------------- sugestões */}
              {(income?.suggestions.length ?? 0) > 0 && (
                <>
                  <SectionTitle>Achamos no seu extrato</SectionTitle>
                  {income!.suggestions.map((s) => (
                    <View
                      key={s.seriesId}
                      className="bg-cardBackground rounded-2xl p-4 mb-2 border border-border"
                    >
                      <Text className="text-sm font-bold text-textPrimary">
                        {s.name}
                      </Text>
                      <Text className="text-xs text-textSecondary mt-0.5">
                        {incomeKindLabel(s.suggestedKind)}
                        {s.expectedAmount != null
                          ? ` · ${formatBRL(s.expectedAmount)}`
                          : ""}
                        {s.anchorDay != null ? ` · dia ${s.anchorDay}` : ""}
                      </Text>
                      {/* Confirmar é decisão de quem ganha: o app propõe, e o
                          valor só entra na conta depois deste toque */}
                      <Pressable
                        onPress={async () => {
                          const result = await acceptSuggestion(s.seriesId);
                          showToast(result.message, result.ok ? "success" : "error");
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Confirmar ${s.name}`}
                        className="h-10 rounded-xl items-center justify-center mt-3"
                        style={{ backgroundColor: t.accent.neon }}
                      >
                        <Text
                          className="text-xs font-bold"
                          style={{ color: t.text.inverse }}
                        >
                          É isso, confirmar
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </>
              )}

              {/* ------------------------------------------------ fontes */}
              <SectionTitle>Suas fontes de renda</SectionTitle>

              {(income?.sources.length ?? 0) === 0 ? (
                <View className="items-center py-8">
                  <View
                    className="w-14 h-14 rounded-full items-center justify-center mb-3"
                    style={{ backgroundColor: t.accent.neonMuted }}
                  >
                    <Banknote size={24} color={t.accent.neon} />
                  </View>
                  <Text className="text-textPrimary font-bold text-sm">
                    Nenhuma fonte cadastrada
                  </Text>
                  <Text className="text-textSecondary text-xs text-center mt-1 px-6">
                    Salário, vale-refeição, adiantamento — cada um tem o próprio
                    dia de cair, e é isso que o app usa para fechar seu mês.
                  </Text>
                </View>
              ) : (
                income!.sources.map((source) => (
                  <View
                    key={source.id}
                    className="bg-cardBackground rounded-2xl p-4 mb-2 border border-border"
                  >
                    <View className="flex-row items-center">
                      <View className="flex-1">
                        <View className="flex-row items-center">
                          <Text className="text-sm font-bold text-textPrimary">
                            {source.name}
                          </Text>
                          {source.confirmed && (
                            <BadgeCheck
                              size={14}
                              color={t.semantic.success}
                              style={{ marginLeft: 6 }}
                            />
                          )}
                        </View>
                        <Text className="text-xs text-textSecondary mt-0.5">
                          {incomeKindLabel(source.kind)}
                          {source.expectedAmount != null
                            ? ` · ${formatBRL(source.expectedAmount)}`
                            : ""}
                          {source.anchorDay != null
                            ? ` · cai no dia ${source.anchorDay}`
                            : ""}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => excluirFonte(source)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remover ${source.name}`}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Trash2 size={16} color={t.semantic.danger} />
                      </Pressable>
                    </View>

                    {!source.confirmed && (
                      <Pressable
                        onPress={() => confirmar(source)}
                        accessibilityRole="button"
                        className="h-9 rounded-lg items-center justify-center mt-3"
                        style={{ backgroundColor: t.accent.neonMuted }}
                      >
                        <Text
                          className="text-xs font-bold"
                          style={{ color: t.accent.neon }}
                        >
                          Confirmar este valor
                        </Text>
                      </Pressable>
                    )}
                  </View>
                ))
              )}

              <Pressable
                onPress={abrirForm}
                accessibilityRole="button"
                accessibilityLabel="Cadastrar fonte de renda"
                className="flex-row items-center justify-center h-14 rounded-xl mt-3"
                style={{ backgroundColor: t.accent.neon }}
              >
                <Plus size={20} color={t.text.inverse} />
                <Text
                  className="font-bold text-base ml-2"
                  style={{ color: t.text.inverse }}
                >
                  Nova fonte
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </PageContainer>

      {/* -------------------------------------------------- nova fonte */}
      <CustomModal visible={formOpen} onClose={() => setFormOpen(false)}>
        <View style={SHEET_PADDING}>
          <Text className="text-xl font-bold text-textPrimary mb-1">
            Nova fonte de renda
          </Text>
          <Text className="text-xs text-textSecondary mb-4">
            O dia importa: o vale cai antes do salário, e o app precisa saber disso
            para fechar o mês certo.
          </Text>

          <View className="flex-row flex-wrap mb-2">
            {KINDS.map((k) => (
              <KindChip
                key={k}
                kind={k}
                selected={kind === k}
                onPress={() => setKind(k)}
              />
            ))}
          </View>

          <View className="mb-4">
            <FloatingLabelInput label="Nome" value={nome} onChangeText={setNome} />
          </View>
          <View className="mb-4">
            <FloatingLabelInput
              label="Quanto costuma cair"
              value={valor}
              onChangeText={setValor}
              keyboardType="decimal-pad"
            />
          </View>
          <View className="mb-5">
            <FloatingLabelInput
              label="Dia do mês (opcional)"
              value={dia}
              onChangeText={setDia}
              keyboardType="number-pad"
            />
          </View>

          <Pressable
            onPress={salvarFonte}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel="Salvar fonte de renda"
            className="h-14 rounded-xl items-center justify-center"
            style={{ backgroundColor: t.accent.neon, opacity: isSaving ? 0.6 : 1 }}
          >
            <Text className="font-bold text-base" style={{ color: t.text.inverse }}>
              Salvar
            </Text>
          </Pressable>
        </View>
      </CustomModal>

      {/* ----------------------------------------------------- jornada */}
      <CustomModal visible={jornadaOpen} onClose={() => setJornadaOpen(false)}>
        <View style={SHEET_PADDING}>
          <Text className="text-xl font-bold text-textPrimary mb-1">
            Sua jornada
          </Text>
          <Text className="text-xs text-textSecondary mb-5">
            É o que transforma o seu salário em valor por hora — e o preço de um
            desejo em tempo de vida.
          </Text>

          <View className="mb-4">
            <FloatingLabelInput
              label="Dias por semana"
              value={dias}
              onChangeText={setDias}
              keyboardType="number-pad"
            />
          </View>
          <View className="mb-5">
            <FloatingLabelInput
              label="Horas por dia"
              value={horas}
              onChangeText={setHoras}
              keyboardType="decimal-pad"
            />
          </View>

          <Pressable
            onPress={salvarJornada}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel="Salvar jornada"
            className="h-14 rounded-xl items-center justify-center"
            style={{ backgroundColor: t.accent.neon, opacity: isSaving ? 0.6 : 1 }}
          >
            <Text className="font-bold text-base" style={{ color: t.text.inverse }}>
              Salvar
            </Text>
          </Pressable>
        </View>
      </CustomModal>
    </View>
  );
}
