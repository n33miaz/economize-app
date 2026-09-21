import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import Link from "lucide-react-native/dist/esm/icons/link";
import Plus from "lucide-react-native/dist/esm/icons/plus";
import Square from "lucide-react-native/dist/esm/icons/square";
import SquareCheck from "lucide-react-native/dist/esm/icons/square-check";
import X from "lucide-react-native/dist/esm/icons/x";

import type { ReconcileCandidate } from "../services/api";
import { useTheme } from "../theme/ThemeProvider";
import { SHEET_PADDING, SHEET_TITLE, radius, spacing } from "../theme/ds";
import { useMotionPresets } from "../theme/motionPresets";
import { useContentCapStyle } from "../hooks/useBreakpoint";
import { useShoppingSync } from "../hooks/useShoppingSync";
import { askConfirm } from "../store/confirmStore";
import { useShoppingStore } from "../store/shoppingStore";
import { useToastStore } from "../store/toastStore";
import * as Haptics from "../utils/haptics";
import { formatBRL, parseAmount } from "../utils/money";
import {
  type ItemInput,
  type ShoppingItem,
  type ShoppingTrip as Trip,
  activeItems,
  describeItemLine,
  describePriceHint,
  describeReceiptDifference,
  describeTripStatus,
  formatTripDate,
  itemCountLabel,
  itemNameSuggestions,
  itemSubtotal,
  receiptDifference,
  tripItemCount,
  tripTotal,
  tripUncheckedCount,
} from "../utils/shopping";

import AddItemSheet from "../components/AddItemSheet";
import Badge from "../components/Badge";
import CustomModal from "../components/CustomModal";
import PageContainer from "../components/PageContainer";
import PotEmptyState from "../components/PotEmptyState";
import ScreenHeader from "../components/ScreenHeader";
import ShoppingBudgetBar from "../components/ShoppingBudgetBar";
import Skeleton, { SkeletonCard, SkeletonRow } from "../components/Skeleton";
import SyncStatusLine from "../components/SyncStatusLine";

/**
 * A tela do supermercado.
 *
 * <p>É a tela que o dono olha com o carrinho numa mão: o total grande no
 * topo responde "quanto já gastei", a barra responde "cabe mais?", e o botão
 * "+ item" é o gesto que se repete quarenta vezes. Tudo lê e escreve no
 * aparelho; a sincronização acontece por trás e só aparece numa linha.
 *
 * <p>Toque no item edita, segurar tira do carrinho, e o quadradinho à
 * esquerda marca "peguei" — desmarcado, o item fica na lista mas sai da conta.
 */
export default function ShoppingTrip() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const clientId: string | undefined = route.params?.clientId;
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const capStyle = useContentCapStyle();
  const { cardEntering, listItemEntering } = useMotionPresets();
  const showToast = useToastStore((s) => s.showToast);

  const trips = useShoppingStore((s) => s.trips);
  const trip = useShoppingStore((s) =>
    s.trips.find((candidata) => candidata.clientId === clientId),
  );
  const hasHydrated = useShoppingStore((s) => s.hasHydrated);
  const isSyncing = useShoppingStore((s) => s.isSyncing);
  const syncFailed = useShoppingStore((s) => s.syncFailed);
  const lastSyncAt = useShoppingStore((s) => s.lastSyncAt);
  const addItem = useShoppingStore((s) => s.addItem);
  const updateItem = useShoppingStore((s) => s.updateItem);
  const removeItem = useShoppingStore((s) => s.removeItem);
  const toggleItemChecked = useShoppingStore((s) => s.toggleItemChecked);
  const priceSummaryFor = useShoppingStore((s) => s.priceSummaryFor);
  const lookupPrice = useShoppingStore((s) => s.lookupPrice);
  const syncAll = useShoppingStore((s) => s.syncAll);

  useShoppingSync();

  const [folhaItem, setFolhaItem] = useState(false);
  const [editando, setEditando] = useState<ShoppingItem | null>(null);
  const [folhaFechar, setFolhaFechar] = useState(false);

  const suggestionsFor = useCallback(
    (query: string) => itemNameSuggestions(trips, query),
    [trips],
  );
  const resumoDePreco = useCallback(
    (name: string) => priceSummaryFor(name, clientId),
    [priceSummaryFor, clientId],
  );
  const consultarPreco = useCallback(
    (name: string) => lookupPrice(name, clientId),
    [lookupPrice, clientId],
  );

  const itens = useMemo(() => (trip ? activeItems(trip) : []), [trip]);
  // A linha "da última vez" de cada item, do que o aparelho já sabe. Não
  // consulta o servidor por item: quarenta pedidos por tela seria o oposto
  // de rápido, e a folha do item já alimentou o cache ao digitar o nome
  const dicas = useMemo(() => {
    const mapa = new Map<string, string | null>();
    if (!trip) return mapa;
    itens.forEach((item) => {
      mapa.set(
        item.clientId,
        describePriceHint(priceSummaryFor(item.name, trip.clientId), trip.storeName),
      );
    });
    return mapa;
  }, [itens, trip, priceSummaryFor]);

  if (!hasHydrated) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Compra" showProfileButton={false} />
        <PageContainer>
          <View style={{ paddingHorizontal: spacing[5] }}>
            <SkeletonCard lines={1} />
            <View style={{ height: spacing[5] }} />
            <SkeletonRow />
            <View style={{ height: spacing[4] }} />
            <SkeletonRow />
            <View style={{ height: spacing[4] }} />
            <SkeletonRow />
          </View>
        </PageContainer>
      </View>
    );
  }

  if (!trip) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Compra" showProfileButton={false} />
        <PageContainer>
          <PotEmptyState
            mood="atencao"
            title="Compra não encontrada"
            body="Ela pode ter sido apagada ou ainda não chegou neste aparelho."
            actionLabel="Voltar às compras"
            onAction={() => navigation.goBack()}
          />
        </PageContainer>
      </View>
    );
  }

  const total = tripTotal(trip);
  const quantidade = tripItemCount(trip);
  const naoPegos = tripUncheckedCount(trip);
  const aberta = trip.status === "OPEN";
  const diferencaDaNota = receiptDifference(total, trip.receiptTotal);

  const abrirNovo = () => {
    setEditando(null);
    setFolhaItem(true);
  };

  const editar = (item: ShoppingItem) => {
    if (!aberta) return;
    setEditando(item);
    setFolhaItem(true);
  };

  const salvarItem = (input: ItemInput) => {
    if (editando) {
      updateItem(trip.clientId, editando.clientId, input);
    } else {
      addItem(trip.clientId, input);
    }
  };

  const tirarDoCarrinho = (item: ShoppingItem) => {
    askConfirm({
      title: "Tirar do carrinho?",
      message: `"${item.name}" sai da lista desta compra.`,
      confirmLabel: "Tirar",
      cancelLabel: "Manter",
      destructive: true,
      onConfirm: () => {
        removeItem(trip.clientId, item.clientId);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setFolhaItem(false);
      },
    });
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={trip.storeName || "Compra"}
        subtitle={describeTripStatus(trip)}
        showProfileButton={false}
      />
      <PageContainer>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: spacing[5],
            paddingBottom: spacing[8],
          }}
        >
          {/* A manchete: total, itens e a barra do orçamento */}
          <Animated.View
            entering={cardEntering}
            style={{
              backgroundColor: t.background.surface,
              borderWidth: 1,
              borderColor: t.border.subtle,
              borderRadius: radius["2xl"],
              padding: spacing[5],
              marginBottom: spacing[4],
            }}
          >
            <Text style={{ color: t.text.tertiary, fontSize: 12, fontWeight: "700" }}>
              {aberta ? "No carrinho" : "Total da compra"}
            </Text>
            <Text
              accessibilityLabel={`Total ${formatBRL(total)}, ${itemCountLabel(quantidade)}`}
              style={{
                color: t.text.primary,
                fontSize: 36,
                lineHeight: 40,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
                marginTop: spacing[1],
              }}
            >
              {formatBRL(total)}
            </Text>
            <Text style={{ color: t.text.secondary, fontSize: 14, marginTop: 2 }}>
              {itemCountLabel(quantidade)}
              {naoPegos > 0
                ? ` · ${naoPegos} ${naoPegos === 1 ? "não pego" : "não pegos"}`
                : ""}
            </Text>
            <ShoppingBudgetBar total={total} budget={trip.budget} />

            {!trip.mine && trip.ownerName ? (
              <Text style={{ color: t.text.tertiary, fontSize: 12, marginTop: spacing[3] }}>
                Compra de {trip.ownerName}
              </Text>
            ) : null}

            {!aberta ? (
              <View
                style={{
                  marginTop: spacing[4],
                  paddingTop: spacing[3],
                  borderTopWidth: 1,
                  borderTopColor: t.border.subtle,
                }}
              >
                {trip.receiptTotal != null ? (
                  <Text style={{ color: t.text.secondary, fontSize: 13, lineHeight: 18 }}>
                    Nota de {formatBRL(trip.receiptTotal)}.{" "}
                    {describeReceiptDifference(diferencaDaNota)}
                  </Text>
                ) : (
                  <Text style={{ color: t.text.tertiary, fontSize: 13, lineHeight: 18 }}>
                    Sem o total da nota — o carrinho é a referência.
                  </Text>
                )}
                {trip.status === "RECONCILED" ? (
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing[3] }}>
                    <Link size={14} color={t.semantic.success} />
                    <Text
                      style={{
                        color: t.semantic.success,
                        fontSize: 12,
                        fontWeight: "700",
                        marginLeft: spacing[2],
                      }}
                    >
                      Conciliada com o extrato
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setFolhaFechar(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Conciliar com o extrato"
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: 44,
                      borderRadius: radius.xl,
                      borderWidth: 1,
                      borderColor: t.accent.neon,
                      marginTop: spacing[3],
                    }}
                  >
                    <Link size={16} color={t.accent.neon} />
                    <Text
                      style={{
                        color: t.accent.neon,
                        fontSize: 14,
                        fontWeight: "700",
                        marginLeft: spacing[2],
                      }}
                    >
                      Conciliar com o extrato
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : null}

            <SyncStatusLine
              pending={trip.dirty}
              failed={syncFailed}
              syncing={isSyncing}
              lastSyncAt={lastSyncAt}
              onSync={syncAll}
            />
          </Animated.View>

          {/* A lista */}
          {itens.length === 0 ? (
            <PotEmptyState
              compact
              mood="comecar"
              title="Carrinho vazio"
              body={
                aberta
                  ? "Toque em + item e anote o que pegar: quantidade, preço da etiqueta e, se quiser, uma foto."
                  : "Esta compra fechou sem itens anotados."
              }
              actionLabel={aberta ? "+ item" : undefined}
              onAction={aberta ? abrirNovo : undefined}
            />
          ) : (
            <View
              style={{
                backgroundColor: t.background.surface,
                borderWidth: 1,
                borderColor: t.border.subtle,
                borderRadius: radius["2xl"],
                paddingHorizontal: spacing[4],
              }}
            >
              {itens.map((item, index) => (
                <Animated.View key={item.clientId} entering={listItemEntering(index)}>
                  <ItemRow
                    item={item}
                    hint={dicas.get(item.clientId) ?? null}
                    divider={index < itens.length - 1}
                    readOnly={!aberta}
                    onPress={() => editar(item)}
                    onLongPress={() => tirarDoCarrinho(item)}
                    onToggle={() => {
                      toggleItemChecked(trip.clientId, item.clientId);
                      Haptics.selectionAsync();
                    }}
                  />
                </Animated.View>
              ))}
            </View>
          )}
        </ScrollView>
      </PageContainer>

      {aberta ? (
        <View
          style={[
            {
              flexDirection: "row",
              gap: spacing[3],
              paddingHorizontal: spacing[5],
              paddingTop: spacing[3],
              paddingBottom: insets.bottom + spacing[4],
              backgroundColor: t.background.base,
              borderTopWidth: 1,
              borderTopColor: t.border.subtle,
            },
            capStyle,
          ]}
        >
          <Pressable
            onPress={abrirNovo}
            accessibilityRole="button"
            accessibilityLabel="Adicionar item"
            style={{
              flex: 2,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              height: 56,
              borderRadius: radius.xl,
              backgroundColor: t.accent.neon,
            }}
          >
            <Plus size={22} color={t.text.inverse} />
            <Text
              style={{
                color: t.text.inverse,
                fontSize: 18,
                fontWeight: "700",
                marginLeft: spacing[2],
              }}
            >
              item
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setFolhaFechar(true)}
            accessibilityRole="button"
            accessibilityLabel="Fechar compra"
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              height: 56,
              borderRadius: radius.xl,
              borderWidth: 1,
              borderColor: t.border.strong,
            }}
          >
            <Text style={{ color: t.text.primary, fontSize: 14, fontWeight: "700" }}>
              Fechar
            </Text>
          </Pressable>
        </View>
      ) : null}

      <AddItemSheet
        visible={folhaItem}
        storeName={trip.storeName}
        editing={editando}
        suggestionsFor={suggestionsFor}
        priceSummaryFor={resumoDePreco}
        lookupPrice={consultarPreco}
        onSave={salvarItem}
        onDelete={tirarDoCarrinho}
        onClose={() => setFolhaItem(false)}
      />

      <CloseTripSheet
        visible={folhaFechar}
        trip={trip}
        onClose={() => setFolhaFechar(false)}
        onReconciled={(mensagem) => showToast(mensagem, "success")}
      />
    </View>
  );
}

/** Uma linha do carrinho: peguei, foto, nome, conta, promoção e o subtotal. */
function ItemRow({
  item,
  hint,
  divider,
  readOnly,
  onPress,
  onLongPress,
  onToggle,
}: {
  item: ShoppingItem;
  hint: string | null;
  divider: boolean;
  readOnly: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onToggle: () => void;
}) {
  const t = useTheme();
  const subtotal = item.unitPrice > 0 ? formatBRL(itemSubtotal(item)) : "—";
  const falado =
    `${item.name}, ${describeItemLine(item)}` +
    (item.unitPrice > 0 ? `, ${formatBRL(itemSubtotal(item))}` : "") +
    (item.checked ? "" : ", não pego") +
    (item.promoNote ? `, promoção: ${item.promoNote}` : "");

  return (
    <Pressable
      onPress={readOnly ? undefined : onPress}
      onLongPress={readOnly ? undefined : onLongPress}
      delayLongPress={400}
      disabled={readOnly}
      accessibilityRole={readOnly ? "text" : "button"}
      accessibilityLabel={falado}
      accessibilityHint={readOnly ? undefined : "Toque para editar, segure para tirar do carrinho"}
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 60,
        paddingVertical: spacing[3],
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: t.border.subtle,
      }}
    >
      <Pressable
        onPress={onToggle}
        disabled={readOnly}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.checked, disabled: readOnly }}
        accessibilityLabel={item.checked ? `Desmarcar ${item.name}` : `Marcar ${item.name} como pego`}
        hitSlop={8}
        style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center", marginLeft: -spacing[2] }}
      >
        {item.checked ? (
          <SquareCheck size={22} color={t.semantic.success} />
        ) : (
          <Square size={22} color={t.text.tertiary} />
        )}
      </Pressable>

      {item.photoRef ? (
        <Image
          source={{ uri: item.photoRef }}
          accessibilityLabel={`Foto do preço de ${item.name}`}
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.md,
            marginLeft: spacing[1],
            backgroundColor: t.background.elevated,
          }}
        />
      ) : null}

      <View style={{ flex: 1, marginLeft: spacing[3], marginRight: spacing[2] }}>
        <Text
          numberOfLines={2}
          style={{
            color: item.checked ? t.text.primary : t.text.tertiary,
            fontSize: 14,
            fontWeight: "700",
            textDecorationLine: item.checked ? "none" : "line-through",
          }}
        >
          {item.name}
        </Text>
        <Text style={{ color: t.text.tertiary, fontSize: 12, marginTop: 2 }}>
          {describeItemLine(item)}
          {item.addedByName ? ` · ${item.addedByName}` : ""}
        </Text>
        {item.promoNote ? (
          <Badge
            label={item.promoNote}
            variant="success"
            accessibilityLabel={`Promoção: ${item.promoNote}`}
            style={{ marginTop: spacing[1] }}
          />
        ) : null}
        {hint ? (
          <Text style={{ color: t.text.tertiary, fontSize: 11, marginTop: 2 }}>{hint}</Text>
        ) : null}
      </View>

      <Text
        style={{
          color: item.checked ? t.text.primary : t.text.tertiary,
          fontSize: 15,
          fontWeight: "700",
          fontVariant: ["tabular-nums"],
          minWidth: 80,
          textAlign: "right",
        }}
      >
        {subtotal}
      </Text>
    </Pressable>
  );
}

type FasePorFechar = "confirmar" | "conciliar";

/**
 * Fechar a compra — e, quando há sinal, amarrá-la ao lançamento do extrato.
 *
 * <p>Duas fases numa folha só: primeiro o total do carrinho e o campo do
 * total da nota (opcional; é ele que diz se ficou algo sem anotar); depois
 * de fechar, os lançamentos parecidos do extrato com "É este". Sem sinal a
 * segunda fase explica que a compra sobe depois — e a folha nunca prende a
 * pessoa no caixa esperando rede.
 */
function CloseTripSheet({
  visible,
  trip,
  onClose,
  onReconciled,
}: {
  visible: boolean;
  trip: Trip;
  onClose: () => void;
  onReconciled: (message: string) => void;
}) {
  const t = useTheme();
  const closeTrip = useShoppingStore((s) => s.closeTrip);
  const fetchReconcileCandidates = useShoppingStore((s) => s.fetchReconcileCandidates);
  const reconcile = useShoppingStore((s) => s.reconcile);

  const [fase, setFase] = useState<FasePorFechar>("confirmar");
  const [nota, setNota] = useState("");
  const [fechando, setFechando] = useState(false);
  const [candidatos, setCandidatos] = useState<ReconcileCandidate[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [conciliando, setConciliando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const total = tripTotal(trip);
  const jaFechada = trip.status !== "OPEN";

  const buscarCandidatos = useCallback(async () => {
    setBuscando(true);
    setBuscou(false);
    try {
      setCandidatos(await fetchReconcileCandidates(trip.clientId));
    } finally {
      setBuscando(false);
      setBuscou(true);
    }
  }, [fetchReconcileCandidates, trip.clientId]);

  useEffect(() => {
    if (!visible) return;
    setNota("");
    setErro(null);
    setConciliando(null);
    setCandidatos([]);
    setBuscou(false);
    // Compra já fechada abre direto na conciliação: é o único motivo de a
    // folha voltar a aparecer
    if (jaFechada) {
      setFase("conciliar");
      buscarCandidatos();
    } else {
      setFase("confirmar");
    }
  }, [visible, jaFechada, buscarCandidatos]);

  const fechar = async () => {
    if (fechando) return;
    const valor = nota.trim() ? parseAmount(nota) : null;
    if (nota.trim() && (valor == null || valor < 0)) {
      setErro("Total da nota inválido.");
      return;
    }
    setFechando(true);
    setErro(null);
    await closeTrip(trip.clientId, valor);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setFechando(false);
    setFase("conciliar");
    buscarCandidatos();
  };

  const escolher = async (candidato: ReconcileCandidate) => {
    if (conciliando) return;
    setConciliando(candidato.id);
    const resultado = await reconcile(trip.clientId, candidato.id);
    setConciliando(null);
    if (resultado.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onReconciled(resultado.message);
      onClose();
    } else {
      setErro(resultado.message);
    }
  };

  const diferenca = receiptDifference(total, trip.receiptTotal);

  return (
    <CustomModal visible={visible} onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={SHEET_PADDING}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing[3] }}>
          <Text style={{ flex: 1, color: t.text.primary, ...SHEET_TITLE }}>
            {fase === "confirmar" ? "Fechar compra" : "Conciliar com o extrato"}
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={8}>
            <X size={20} color={t.text.tertiary} />
          </Pressable>
        </View>

        {fase === "confirmar" ? (
          <>
            <Text style={{ color: t.text.secondary, fontSize: 13, lineHeight: 18 }}>
              Carrinho de {formatBRL(total)} com {itemCountLabel(tripItemCount(trip))}. Se
              tiver a nota em mãos, digite o total dela para conferir.
            </Text>

            <Text
              style={{
                color: t.text.tertiary,
                fontSize: 11,
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginTop: spacing[4],
              }}
            >
              Total da nota (opcional)
            </Text>
            <TextInput
              value={nota}
              onChangeText={(texto) => {
                setNota(texto);
                if (erro) setErro(null);
              }}
              keyboardType="decimal-pad"
              accessibilityLabel="Total da nota"
              placeholder="0,00"
              placeholderTextColor={t.text.tertiary}
              returnKeyType="done"
              onSubmitEditing={fechar}
              style={{
                color: t.text.primary,
                fontSize: 18,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
                borderWidth: 1,
                borderColor: t.border.subtle,
                borderRadius: radius.lg,
                backgroundColor: t.background.elevated,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[3],
                marginTop: spacing[2],
              }}
            />

            {erro ? (
              <Text style={{ color: t.semantic.danger, fontSize: 12, marginTop: spacing[3] }}>
                {erro}
              </Text>
            ) : null}

            <Pressable
              onPress={fechar}
              disabled={fechando}
              accessibilityRole="button"
              accessibilityLabel="Confirmar fechamento da compra"
              accessibilityState={{ disabled: fechando }}
              style={{
                height: 52,
                borderRadius: radius.xl,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: t.accent.neon,
                opacity: fechando ? 0.6 : 1,
                marginTop: spacing[4],
              }}
            >
              {fechando ? (
                <ActivityIndicator size="small" color={t.text.inverse} />
              ) : (
                <Text style={{ color: t.text.inverse, fontWeight: "700", fontSize: 16 }}>
                  Fechar compra
                </Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={{ color: t.text.secondary, fontSize: 13, lineHeight: 18 }}>
              {trip.receiptTotal != null
                ? `Nota de ${formatBRL(trip.receiptTotal)}. ${describeReceiptDifference(diferenca) ?? ""}`
                : `Compra de ${formatBRL(total)} fechada.`}
            </Text>

            {trip.dirty ? (
              <Text
                style={{
                  color: t.semantic.warning,
                  fontSize: 13,
                  lineHeight: 18,
                  marginTop: spacing[3],
                }}
              >
                Sem conexão agora. A compra ficou salva neste aparelho e sobe
                quando a internet voltar — volte aqui depois para conciliar com o
                extrato.
              </Text>
            ) : buscando ? (
              <View style={{ marginTop: spacing[4] }}>
                <Skeleton height={56} borderRadius={radius.xl} />
                <View style={{ height: spacing[2] }} />
                <Skeleton height={56} borderRadius={radius.xl} />
              </View>
            ) : candidatos.length > 0 ? (
              <View style={{ marginTop: spacing[4] }}>
                <Text style={{ color: t.text.tertiary, fontSize: 12, marginBottom: spacing[2] }}>
                  Qual destes lançamentos é esta compra?
                </Text>
                {candidatos.map((candidato) => (
                  <View
                    key={candidato.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      minHeight: 56,
                      paddingVertical: spacing[2],
                      borderBottomWidth: 1,
                      borderBottomColor: t.border.subtle,
                    }}
                  >
                    <View style={{ flex: 1, marginRight: spacing[3] }}>
                      <Text numberOfLines={1} style={{ color: t.text.primary, fontSize: 14, fontWeight: "700" }}>
                        {candidato.description}
                      </Text>
                      <Text style={{ color: t.text.tertiary, fontSize: 12, marginTop: 2 }}>
                        {formatTripDate(candidato.date)} · {formatBRL(Math.abs(candidato.amount))}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => escolher(candidato)}
                      disabled={conciliando !== null}
                      accessibilityRole="button"
                      accessibilityLabel={`É este: ${candidato.description}`}
                      accessibilityState={{ disabled: conciliando !== null }}
                      style={{
                        minHeight: 40,
                        paddingHorizontal: spacing[4],
                        borderRadius: radius.full,
                        borderWidth: 1,
                        borderColor: t.accent.neon,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: conciliando && conciliando !== candidato.id ? 0.5 : 1,
                      }}
                    >
                      {conciliando === candidato.id ? (
                        <ActivityIndicator size="small" color={t.accent.neon} />
                      ) : (
                        <Text style={{ color: t.accent.neon, fontSize: 13, fontWeight: "700" }}>
                          É este
                        </Text>
                      )}
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : buscou ? (
              <Text style={{ color: t.text.tertiary, fontSize: 13, lineHeight: 18, marginTop: spacing[3] }}>
                Nenhum lançamento parecido no extrato ainda. Importe o extrato
                depois e volte aqui para conciliar.
              </Text>
            ) : null}

            {erro ? (
              <Text style={{ color: t.semantic.danger, fontSize: 12, marginTop: spacing[3] }}>
                {erro}
              </Text>
            ) : null}

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Concluir"
              style={{
                height: 48,
                borderRadius: radius.xl,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: t.background.elevated,
                marginTop: spacing[4],
              }}
            >
              <Text style={{ color: t.text.primary, fontWeight: "700", fontSize: 14 }}>
                {candidatos.length > 0 ? "Deixar para depois" : "Concluir"}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </CustomModal>
  );
}
