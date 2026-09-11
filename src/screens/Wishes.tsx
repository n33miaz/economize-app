import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Plus from "lucide-react-native/dist/esm/icons/plus";
import Target from "lucide-react-native/dist/esm/icons/target";
import Trash2 from "lucide-react-native/dist/esm/icons/trash-2";
import TrendingDown from "lucide-react-native/dist/esm/icons/trending-down";

import { useTheme } from "../theme/ThemeProvider";
import { SHEET_PADDING, spacing } from "../theme/ds";
import { useWishStore } from "../store/wishStore";
import { askConfirm } from "../store/confirmStore";
import { useToastStore } from "../store/toastStore";
import { formatBRL, parseAmount } from "../utils/money";
import {
  describeHourlyRate,
  describeWhatIf,
  formatHours,
  formatWorkTime,
  gapPrompt,
} from "../utils/wishes";
import * as Haptics from "../utils/haptics";
import { APP_ROUTES } from "../routes/routeNames";
import type { Wish } from "../services/api";

import ScreenHeader from "../components/ScreenHeader";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import PageContainer from "../components/PageContainer";
import AdSlot from "../components/AdSlot";
import SectionTitle from "../components/SectionTitle";
import CustomModal from "../components/CustomModal";
import FloatingLabelInput from "../components/FloatingLabelInput";
import Skeleton from "../components/Skeleton";
import ErrorState from "../components/ErrorState";
import FirstTimeCard from "../components/FirstTimeCard";
import PotEmptyState from "../components/PotEmptyState";
import WishCard from "../components/WishCard";
import WishContributionSheet from "../components/WishContributionSheet";

export default function Wishes({ navigation }: any) {
  const t = useTheme();
  const showToast = useToastStore((s) => s.showToast);
  const {
    baseline,
    wishes,
    isLoading,
    hasLoadedOnce,
    isSaving,
    error,
    fetch,
    create,
    update,
    remove,
    purchase,
  } = useWishStore();

  // EC-205: a meta que está recebendo dinheiro. Null = folha fechada
  const [aportando, setAportando] = useState<Wish | null>(null);

  // A sobra que o app MEDIU, e o ciclo dela — vira a proposta de um toque.
  // Null quando não há ciclo fechado: sem medida não há o que propor, e
  // inventar um valor aqui seria afirmar que a pessoa guardou algo
  const sobraMedida = useMemo(() => {
    const valor = baseline?.monthlyLeftover;
    if (valor == null || valor <= 0) return null;
    const agora = new Date();
    const mes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
    return { amount: valor, cycleMonth: mes };
  }, [baseline]);

  // Puxar para atualizar: o gesto que a plataforma inteira ensinou
  // nao pode faltar numa tela de dados
  const { control: refreshControl } = usePullToRefresh(() => fetch());

  const [formOpen, setFormOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [guardado, setGuardado] = useState("");
  const [detalhe, setDetalhe] = useState<Wish | null>(null);

  useEffect(() => {
    if (!hasLoadedOnce) fetch();
  }, [hasLoadedOnce, fetch]);

  // O detalhe lê da lista, e não de uma cópia congelada: sem isso, promover a
  // meta atualizava o cartão de trás e deixava o modal aberto mostrando o
  // estado antigo
  const detalheVivo = useMemo(
    () => (detalhe ? (wishes.find((w) => w.id === detalhe.id) ?? null) : null),
    [detalhe, wishes],
  );

  const abrirForm = () => {
    setNome("");
    setValor("");
    setGuardado("");
    setFormOpen(true);
  };

  const salvar = async () => {
    const alvo = parseAmount(valor);
    if (!nome.trim()) {
      showToast("Dê um nome ao desejo.", "warning");
      return;
    }
    if (alvo == null || alvo <= 0) {
      showToast("Informe quanto custa.", "warning");
      return;
    }
    const jaGuardado = parseAmount(guardado);
    const result = await create({
      name: nome.trim(),
      targetAmount: alvo,
      savedAmount: jaGuardado != null && jaGuardado > 0 ? jaGuardado : undefined,
    });
    showToast(result.message, result.ok ? "success" : "error");
    if (result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setFormOpen(false);
    }
  };

  const promover = async (wish: Wish) => {
    const virandoMeta = wish.status !== "GOAL";
    const result = await update(wish.id, {
      status: virandoMeta ? "GOAL" : "WISH",
    });
    showToast(result.message, result.ok ? "success" : "error");
  };

  const registrarCompra = (wish: Wish) => {
    askConfirm({
      title: "Comprou?",
      message: `Vamos marcar "${wish.name}" como comprado. O quanto você já tinha guardado continua no histórico.`,
      confirmLabel: "Sim, comprei",
      cancelLabel: "Ainda não",
      onConfirm: async () => {
        const result = await purchase(wish.id);
        showToast(result.message, result.ok ? "success" : "error");
        if (result.ok) setDetalhe(null);
      },
    });
  };

  const excluir = (wish: Wish) => {
    askConfirm({
      title: "Excluir desejo?",
      message: `"${wish.name}" sai da lista e o histórico dele se perde.`,
      confirmLabel: "Excluir",
      cancelLabel: "Manter",
      destructive: true,
      onConfirm: async () => {
        const result = await remove(wish.id);
        showToast(result.message, result.ok ? "success" : "error");
        if (result.ok) setDetalhe(null);
      },
    });
  };

  const hourlyLine = baseline ? describeHourlyRate(baseline) : null;
  const gaps = baseline?.gaps ?? [];

  const irPara = (gap: string) => {
    if (gap === "WORK_PROFILE" || gap === "CONFIRMED_INCOME") {
      navigation.navigate(APP_ROUTES.renda);
    } else if (gap === "HISTORY") {
      navigation.navigate(APP_ROUTES.main);
    } else {
      navigation.navigate(APP_ROUTES.analise);
    }
  };

  if (error && !hasLoadedOnce) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Desejos" />
        <ErrorState message={error} onRetry={fetch} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Desejos"
        subtitle="Quanto custa, em horas da sua vida"
      />
      <PageContainer>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing[10] }}
        >
          <FirstTimeCard
            id="desejos-horas-de-vida"
            title="O preço em horas da sua vida"
            body="Cada desejo mostra quantas horas de trabalho ele custa, calculadas com a renda e a jornada que você informar. É para comparar, não para julgar — e o aporte que você registra faz a barra andar."
          />

          {/* O valor da hora é o que dá sentido a todo o resto da tela */}
          {hourlyLine && (
            <View className="bg-cardBackground rounded-2xl p-4 border border-border">
              <Text className="text-xs text-textSecondary">Sua hora</Text>
              <Text
                className="text-3xl font-bold mt-1"
                style={{ color: t.accent.neon }}
              >
                {formatBRL(baseline!.hourlyRate!)}
              </Text>
              <Text className="text-xs text-textSecondary mt-1">
                {/* pelo formatador, e não interpolado cru: número solto sai
                    "173.33" com ponto, num app inteiro em pt-BR */}
                {formatHours(baseline!.hoursPerMonth)} por mês
                {baseline!.monthlyLeftover != null
                  ? ` · sobra típica de ${formatBRL(baseline!.monthlyLeftover)}`
                  : ""}
              </Text>
            </View>
          )}

          {/* Faltar dado é o estado normal de quem chegou agora: cada lacuna
              vira um convite com o motivo, nunca um erro */}
          {gaps.map((gap) => {
            const prompt = gapPrompt(gap);
            return (
              <Pressable
                key={gap}
                onPress={() => irPara(gap)}
                accessibilityRole="button"
                accessibilityLabel={prompt.action}
                className="mt-3 rounded-2xl p-4 border"
                style={{
                  backgroundColor: t.accent.neonMuted,
                  borderColor: t.border.subtle,
                }}
              >
                <Text className="text-sm font-bold text-textPrimary">
                  {prompt.title}
                </Text>
                <Text className="text-xs text-textSecondary mt-1">
                  {prompt.reason}
                </Text>
                <Text
                  className="text-xs font-bold mt-2"
                  style={{ color: t.accent.neon }}
                >
                  {prompt.action} →
                </Text>
              </Pressable>
            );
          })}

          <SectionTitle>O que eu quero</SectionTitle>

          {isLoading && !hasLoadedOnce ? (
            <>
              <Skeleton height={120} borderRadius={16} className="mb-3" />
              <Skeleton height={120} borderRadius={16} className="mb-3" />
            </>
          ) : wishes.length === 0 ? (
            // EC-231: o pote vazio no lugar do disco âmbar. Sem botão próprio
            // porque o "Cadastrar desejo" já vem logo abaixo — dois iguais na
            // mesma tela seria pedir a mesma coisa duas vezes
            <PotEmptyState
              mood="comecar"
              size={80}
              title="Nenhum desejo ainda"
              body="Cadastre algo que você quer comprar e descubra quantas horas de trabalho aquilo custa."
            />
          ) : (
            wishes.map((wish) => (
              <WishCard
                key={wish.id}
                wish={wish}
                onPress={() => setDetalhe(wish)}
              />
            ))
          )}

          <Pressable
            onPress={abrirForm}
            accessibilityRole="button"
            accessibilityLabel="Cadastrar desejo"
            className="flex-row items-center justify-center h-14 rounded-xl mt-2"
            style={{ backgroundColor: t.accent.neon }}
          >
            <Plus size={20} color={t.text.inverse} />
            <Text
              className="font-bold text-base ml-2"
              style={{ color: t.text.inverse }}
            >
              Novo desejo
            </Text>
          </Pressable>
        {/* Fim do conteúdo: o slot nunca fica entre o usuário e os
            números dele. Some por completo no Plus */}
        <AdSlot style={{ marginTop: spacing[4] }} />
        </ScrollView>
      </PageContainer>

      {/* ------------------------------------------------------ cadastro */}
      <CustomModal visible={formOpen} onClose={() => setFormOpen(false)}>
        <View style={SHEET_PADDING}>
          <Text className="text-xl font-bold text-textPrimary mb-1">
            Novo desejo
          </Text>
          <Text className="text-xs text-textSecondary mb-5">
            Vamos dizer quanto isso custa em horas de trabalho.
          </Text>

          <View className="mb-4">
            <FloatingLabelInput
              label="O que você quer"
              value={nome}
              onChangeText={setNome}
            />
          </View>
          <View className="mb-4">
            <FloatingLabelInput
              label="Quanto custa"
              value={valor}
              onChangeText={setValor}
              keyboardType="decimal-pad"
            />
          </View>
          <View className="mb-5">
            <FloatingLabelInput
              label="Já guardei (opcional)"
              value={guardado}
              onChangeText={setGuardado}
              keyboardType="decimal-pad"
            />
          </View>

          <Pressable
            onPress={salvar}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel="Salvar desejo"
            className="h-14 rounded-xl items-center justify-center"
            style={{ backgroundColor: t.accent.neon, opacity: isSaving ? 0.6 : 1 }}
          >
            <Text className="font-bold text-base" style={{ color: t.text.inverse }}>
              Salvar
            </Text>
          </Pressable>
        </View>
      </CustomModal>

      {/* -------------------------------------------------------- detalhe */}
      <CustomModal visible={!!detalheVivo} onClose={() => setDetalhe(null)}>
        {detalheVivo && (
          <ScrollView
            refreshControl={refreshControl}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={SHEET_PADDING}
          >
            <Text className="text-xl font-bold text-textPrimary">
              {detalheVivo.name}
            </Text>
            <Text className="text-xs text-textSecondary mt-1">
              {formatBRL(detalheVivo.targetAmount)}
              {detalheVivo.savedAmount > 0
                ? ` · ${formatBRL(detalheVivo.savedAmount)} guardados`
                : ""}
            </Text>

            {detalheVivo.projection.hoursOfWork != null && (
              <View
                className="rounded-2xl p-4 mt-4"
                style={{ backgroundColor: t.accent.neonMuted }}
              >
                <Text className="text-xs text-textSecondary">
                  Custa da sua vida
                </Text>
                <Text
                  className="text-3xl font-bold mt-1"
                  style={{ color: t.accent.neon }}
                >
                  {formatHours(detalheVivo.projection.hoursOfWork)}
                </Text>
                <Text className="text-xs text-textSecondary mt-1">
                  {formatWorkTime(detalheVivo.projection)}
                </Text>
              </View>
            )}

            {detalheVivo.projection.monthsToAfford != null && (
              <View className="bg-cardBackground rounded-2xl p-4 mt-3 border border-border">
                <View className="flex-row items-center mb-1">
                  <Target size={16} color={t.text.secondary} />
                  <Text className="text-xs text-textSecondary ml-2">
                    No seu ritmo de hoje
                  </Text>
                </View>
                <Text className="text-base font-bold text-textPrimary">
                  {detalheVivo.projection.monthsToAfford} meses
                </Text>
                <Text className="text-xs text-textSecondary mt-1">
                  Guardando {formatBRL(detalheVivo.projection.maxInstallment ?? 0)}{" "}
                  por mês — ou parcelando em{" "}
                  {detalheVivo.projection.installments}x dentro do que sobra.
                </Text>
              </View>
            )}

            {detalheVivo.projection.whatIfs.length > 0 && (
              <>
                <SectionTitle>Como chegar antes</SectionTitle>
                {detalheVivo.projection.whatIfs.map((whatIf) => (
                  <View
                    key={whatIf.percentOfExpense}
                    className="flex-row items-center bg-cardBackground rounded-xl p-3 mb-2 border border-border"
                  >
                    <TrendingDown size={16} color={t.semantic.success} />
                    <Text className="text-xs text-textPrimary ml-3 flex-1">
                      {describeWhatIf(whatIf)}
                    </Text>
                  </View>
                ))}
              </>
            )}

            <View className="mt-5">
              {detalheVivo.status !== "PURCHASED" && (
                <>
                  <Pressable
                    onPress={() => promover(detalheVivo)}
                    accessibilityRole="button"
                    className="h-12 rounded-xl items-center justify-center mb-2"
                    style={{ backgroundColor: t.background.elevated }}
                  >
                    <Text className="font-bold text-sm text-textPrimary">
                      {detalheVivo.status === "GOAL"
                        ? "Deixar de ser meta"
                        : "Transformar em meta"}
                    </Text>
                  </Pressable>
                  {detalheVivo.status === "GOAL" && (
                    <Pressable
                      onPress={() => setAportando(detalheVivo)}
                      accessibilityRole="button"
                      accessibilityLabel={`Guardar dinheiro para ${detalheVivo.name}`}
                      // Borda âmbar, e não fundo âmbar: a tela já gasta as
                      // cinco superfícies de accent que o orçamento permite, e
                      // o destaque aqui se resolve com contorno e texto
                      className="h-12 rounded-xl items-center justify-center mb-2 border"
                      style={{
                        backgroundColor: t.background.elevated,
                        borderColor: t.accent.neon,
                      }}
                    >
                      <Text className="font-bold text-sm" style={{ color: t.accent.neon }}>
                        Guardar dinheiro aqui
                      </Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => registrarCompra(detalheVivo)}
                    accessibilityRole="button"
                    className="h-12 rounded-xl items-center justify-center mb-2"
                    style={{ backgroundColor: t.semantic.successMuted }}
                  >
                    <Text
                      className="font-bold text-sm"
                      style={{ color: t.semantic.success }}
                    >
                      Já comprei
                    </Text>
                  </Pressable>
                </>
              )}
              <Pressable
                onPress={() => excluir(detalheVivo)}
                accessibilityRole="button"
                className="h-12 rounded-xl items-center justify-center flex-row"
                style={{ backgroundColor: t.semantic.dangerMuted }}
              >
                <Trash2 size={16} color={t.semantic.danger} />
                <Text
                  className="font-bold text-sm ml-2"
                  style={{ color: t.semantic.danger }}
                >
                  Excluir
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </CustomModal>

      {/* EC-205: guardar dinheiro numa meta, com o extrato do que já entrou */}
      <WishContributionSheet
        visible={aportando !== null}
        wish={aportando}
        leftover={sobraMedida}
        onClose={() => setAportando(null)}
        onSaved={fetch}
      />
    </View>
  );
}
