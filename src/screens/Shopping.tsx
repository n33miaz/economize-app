import React, { useEffect, useState } from "react";
import { Keyboard, Pressable, ScrollView, Switch, Text, View } from "react-native";
import ChevronRight from "lucide-react-native/dist/esm/icons/chevron-right";
import Plus from "lucide-react-native/dist/esm/icons/plus";
import Receipt from "lucide-react-native/dist/esm/icons/receipt";
import ShoppingCart from "lucide-react-native/dist/esm/icons/shopping-cart";
import X from "lucide-react-native/dist/esm/icons/x";
import Animated from "react-native-reanimated";

import { useTheme } from "../theme/ThemeProvider";
import { SHEET_PADDING, SHEET_TITLE, radius, spacing } from "../theme/ds";
import { useMotionPresets } from "../theme/motionPresets";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { useShoppingSync } from "../hooks/useShoppingSync";
import { useFamilyStore } from "../store/familyStore";
import {
  type NewTripInput,
  selectHasPendingSync,
  useShoppingStore,
} from "../store/shoppingStore";
import * as Haptics from "../utils/haptics";
import { formatBRL, parseAmount } from "../utils/money";
import {
  type ShoppingTrip,
  closedTrips,
  formatTripDate,
  lastTripDefaults,
  openTrips,
  storeSuggestions,
  tripHeadline,
  tripTotal,
} from "../utils/shopping";
import { APP_ROUTES } from "../routes/routeNames";

import Badge from "../components/Badge";
import CustomModal from "../components/CustomModal";
import FirstTimeCard from "../components/FirstTimeCard";
import FloatingLabelInput from "../components/FloatingLabelInput";
import PageContainer from "../components/PageContainer";
import PotEmptyState from "../components/PotEmptyState";
import ScreenHeader from "../components/ScreenHeader";
import SectionTitle from "../components/SectionTitle";
import ShoppingBudgetBar from "../components/ShoppingBudgetBar";
import { SkeletonCard } from "../components/Skeleton";
import SyncStatusLine from "../components/SyncStatusLine";

/**
 * Compras — a porta do carrinho.
 *
 * <p>A compra aberta fica em destaque (é para ela que o dono volta no meio
 * do mercado), as fechadas ficam abaixo com total e data, e "Nova compra"
 * abre a folha que pergunta só o essencial: onde e, se quiser, quanto.
 *
 * <p>Tudo aqui lê do aparelho. A rede só entra pela linha de status no fim
 * e pelo puxar-para-atualizar — e a falha dela não muda nada na tela.
 */
export default function Shopping({ navigation }: any) {
  const t = useTheme();
  const { cardEntering, listItemEntering } = useMotionPresets();
  const trips = useShoppingStore((s) => s.trips);
  const hasHydrated = useShoppingStore((s) => s.hasHydrated);
  const isSyncing = useShoppingStore((s) => s.isSyncing);
  const syncFailed = useShoppingStore((s) => s.syncFailed);
  const lastSyncAt = useShoppingStore((s) => s.lastSyncAt);
  const pendente = useShoppingStore(selectHasPendingSync);
  const createTrip = useShoppingStore((s) => s.createTrip);
  const syncAll = useShoppingStore((s) => s.syncAll);
  const hasFamily = useFamilyStore((s) => s.hasFamily);

  useShoppingSync();

  const [novaAberta, setNovaAberta] = useState(false);
  const { control: refreshControl } = usePullToRefresh(() => syncAll());

  const abertas = openTrips(trips);
  const fechadas = closedTrips(trips);

  const abrirCompra = (trip: ShoppingTrip) =>
    navigation.navigate(APP_ROUTES.compra, { clientId: trip.clientId });

  const comecar = (input: NewTripInput) => {
    const clientId = createTrip(input);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNovaAberta(false);
    navigation.navigate(APP_ROUTES.compra, { clientId });
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Compras" subtitle="Carrinho de compras" />
      <PageContainer>
        <ScrollView
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing[5],
            paddingBottom: spacing[10],
          }}
        >
          <FirstTimeCard
            id="compras-offline"
            title="Funciona sem sinal"
            body="Anote os itens no mercado mesmo sem internet: tudo fica no aparelho e sobe sozinho quando a conexão voltar — inclusive para a casa."
          />

          {!hasHydrated ? (
            <SkeletonCard lines={2} />
          ) : trips.length === 0 ? (
            <PotEmptyState
              mood="comecar"
              title="Nenhuma compra ainda"
              body="Comece uma compra, anote os itens no corredor e feche no caixa. Depois dá para conferir com a nota e com o extrato."
              actionLabel="Nova compra"
              onAction={() => setNovaAberta(true)}
            />
          ) : (
            <>
              {abertas.map((trip, index) => (
                <Animated.View
                  key={trip.clientId}
                  entering={index === 0 ? cardEntering : listItemEntering(index)}
                >
                  <OpenTripCard trip={trip} onPress={() => abrirCompra(trip)} />
                </Animated.View>
              ))}

              <Pressable
                onPress={() => setNovaAberta(true)}
                accessibilityRole="button"
                accessibilityLabel="Nova compra"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 52,
                  borderRadius: radius.xl,
                  backgroundColor: t.accent.neon,
                  marginTop: spacing[2],
                }}
              >
                <Plus size={20} color={t.text.inverse} />
                <Text
                  style={{
                    color: t.text.inverse,
                    fontSize: 16,
                    fontWeight: "700",
                    marginLeft: spacing[2],
                  }}
                >
                  Nova compra
                </Text>
              </Pressable>

              {fechadas.length > 0 ? (
                <>
                  <SectionTitle>Últimas compras</SectionTitle>
                  <View
                    style={{
                      backgroundColor: t.background.surface,
                      borderWidth: 1,
                      borderColor: t.border.subtle,
                      borderRadius: radius["2xl"],
                      paddingHorizontal: spacing[4],
                    }}
                  >
                    {fechadas.map((trip, index) => (
                      <ClosedTripRow
                        key={trip.clientId}
                        trip={trip}
                        divider={index < fechadas.length - 1}
                        onPress={() => abrirCompra(trip)}
                      />
                    ))}
                  </View>
                </>
              ) : null}
            </>
          )}

          {hasHydrated ? (
            <SyncStatusLine
              pending={pendente}
              failed={syncFailed}
              syncing={isSyncing}
              lastSyncAt={lastSyncAt}
              onSync={syncAll}
            />
          ) : null}
        </ScrollView>
      </PageContainer>

      <NewTripSheet
        visible={novaAberta}
        trips={trips}
        hasFamily={hasFamily}
        onClose={() => setNovaAberta(false)}
        onCreate={comecar}
      />
    </View>
  );
}

/** A compra em curso: loja, manchete e a barra do orçamento. */
function OpenTripCard({
  trip,
  onPress,
}: {
  trip: ShoppingTrip;
  onPress: () => void;
}) {
  const t = useTheme();
  const manchete = tripHeadline(trip);
  const deQuem = !trip.mine && trip.ownerName ? `Compra de ${trip.ownerName}` : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${trip.storeName || "Compra"} em andamento: ${manchete}. Abrir`}
      style={{
        backgroundColor: t.background.surface,
        borderWidth: 1,
        borderColor: t.border.default,
        borderRadius: radius["2xl"],
        padding: spacing[5],
        marginBottom: spacing[4],
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.full,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.accent.neonMuted,
          }}
        >
          <ShoppingCart size={20} color={t.accent.neon} />
        </View>
        <View style={{ flex: 1, marginLeft: spacing[3] }}>
          <Text
            numberOfLines={1}
            style={{ color: t.text.primary, fontSize: 16, fontWeight: "700" }}
          >
            {trip.storeName || "Compra"}
          </Text>
          <Text style={{ color: t.text.tertiary, fontSize: 12, marginTop: 2 }}>
            {deQuem ?? `Começou ${formatTripDate(trip.startedAt)}`}
          </Text>
        </View>
        <Badge label="Em andamento" variant="info" />
      </View>

      <Text
        style={{
          color: t.text.primary,
          fontSize: 24,
          lineHeight: 28,
          fontWeight: "700",
          fontVariant: ["tabular-nums"],
          marginTop: spacing[4],
        }}
      >
        {manchete}
      </Text>
      <ShoppingBudgetBar total={tripTotal(trip)} budget={trip.budget} height={6} />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: spacing[3],
        }}
      >
        <Text style={{ flex: 1, color: t.accent.neon, fontSize: 13, fontWeight: "700" }}>
          Continuar a compra
        </Text>
        <ChevronRight size={18} color={t.accent.neon} />
      </View>
    </Pressable>
  );
}

/** Uma compra fechada: loja, quando, quanto — e se já bateu com o extrato. */
function ClosedTripRow({
  trip,
  divider,
  onPress,
}: {
  trip: ShoppingTrip;
  divider: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const total = tripTotal(trip);
  const quando = formatTripDate(trip.closedAt ?? trip.startedAt);
  const conciliada = trip.status === "RECONCILED";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${trip.storeName || "Compra"}, ${quando}, ${formatBRL(total)}${conciliada ? ", conciliada com o extrato" : ""}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 60,
        paddingVertical: spacing[3],
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: t.border.subtle,
      }}
    >
      <Receipt size={18} color={t.text.tertiary} />
      <View style={{ flex: 1, marginLeft: spacing[3], marginRight: spacing[2] }}>
        <Text
          numberOfLines={1}
          style={{ color: t.text.primary, fontSize: 14, fontWeight: "700" }}
        >
          {trip.storeName || "Compra"}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2, gap: spacing[2] }}>
          <Text style={{ color: t.text.tertiary, fontSize: 12 }}>
            {quando}
            {!trip.mine && trip.ownerName ? ` · ${trip.ownerName}` : ""}
          </Text>
          {conciliada ? <Badge label="Conciliada" variant="success" /> : null}
        </View>
      </View>
      <Text
        style={{
          color: t.text.primary,
          fontSize: 15,
          fontWeight: "700",
          fontVariant: ["tabular-nums"],
        }}
      >
        {formatBRL(total)}
      </Text>
    </Pressable>
  );
}

/**
 * A folha de nova compra: onde, quanto (opcional) e, se houver casa, com
 * quem. A loja vem das anteriores em um toque — o dono vai ao mesmo mercado
 * quase sempre — e o orçamento repete o da última compra.
 */
function NewTripSheet({
  visible,
  trips,
  hasFamily,
  onClose,
  onCreate,
}: {
  visible: boolean;
  trips: ShoppingTrip[];
  hasFamily: boolean;
  onClose: () => void;
  onCreate: (input: NewTripInput) => void;
}) {
  const t = useTheme();
  const [loja, setLoja] = useState("");
  const [orcamento, setOrcamento] = useState("");
  const [compartilhar, setCompartilhar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const lojas = storeSuggestions(trips);

  useEffect(() => {
    if (!visible) return;
    const padrao = lastTripDefaults(trips);
    setLoja(padrao.storeName);
    setOrcamento(
      padrao.budget != null ? padrao.budget.toFixed(2).replace(".", ",") : "",
    );
    // Quem já partilhou a última vai partilhar de novo; quem não tem casa,
    // não tem a opção
    const ultima = trips.find((trip) => trip.mine);
    setCompartilhar(hasFamily && (ultima?.shareWithFamily ?? false));
    setErro(null);
  }, [visible, trips, hasFamily]);

  const comecar = () => {
    if (!loja.trim()) {
      setErro("Diga onde você está comprando.");
      return;
    }
    const valor = orcamento.trim() ? parseAmount(orcamento) : null;
    if (orcamento.trim() && (valor == null || valor < 0)) {
      setErro("Orçamento inválido.");
      return;
    }
    onCreate({
      storeName: loja.trim(),
      budget: valor != null && valor > 0 ? valor : null,
      shareWithFamily: hasFamily && compartilhar,
    });
  };

  return (
    <CustomModal visible={visible} onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={SHEET_PADDING}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing[4] }}>
          <Text style={{ flex: 1, color: t.text.primary, ...SHEET_TITLE }}>Nova compra</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={8}>
            <X size={20} color={t.text.tertiary} />
          </Pressable>
        </View>

        <FloatingLabelInput
          label="Onde você está comprando"
          value={loja}
          onChangeText={(texto) => {
            setLoja(texto);
            if (erro) setErro(null);
          }}
          autoCapitalize="words"
          // Os três juntos desligam a correção do teclado do Android, que
          // guarda uma palavra "em composição" e a reescreve sozinha por
          // cima do campo
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
        />
        {lojas.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2], marginTop: spacing[3] }}>
            {lojas.map((nome) => {
              const ativa = nome.trim().toLowerCase() === loja.trim().toLowerCase();
              return (
                <Pressable
                  key={nome}
                  onPress={() => {
                    // Fechar o teclado ANTES de trocar o texto: sem isto o
                    // Android grudava a loja escolhida no que já estava
                    // escrito, e a compra nascia "Zona Rural AtacdAtacadista"
                    Keyboard.dismiss();
                    setLoja(nome);
                    Haptics.selectionAsync();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Comprar em ${nome}`}
                  accessibilityState={{ selected: ativa }}
                  style={{
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                    borderRadius: radius.full,
                    borderWidth: 1,
                    borderColor: ativa ? t.accent.neon : t.border.subtle,
                    backgroundColor: t.background.elevated,
                  }}
                >
                  <Text
                    style={{
                      color: ativa ? t.accent.neon : t.text.secondary,
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    {nome}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={{ marginTop: spacing[4] }}>
          <FloatingLabelInput
            label="Orçamento (opcional)"
            value={orcamento}
            onChangeText={setOrcamento}
            keyboardType="decimal-pad"
          />
        </View>

        {hasFamily ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: spacing[4],
              minHeight: 44,
            }}
          >
            <View style={{ flex: 1, marginRight: spacing[3] }}>
              <Text style={{ color: t.text.primary, fontSize: 14, fontWeight: "700" }}>
                Compartilhar com a casa
              </Text>
              <Text style={{ color: t.text.tertiary, fontSize: 12, marginTop: 2 }}>
                Quem mora com você vê e pode adicionar itens.
              </Text>
            </View>
            <Switch
              value={compartilhar}
              onValueChange={setCompartilhar}
              accessibilityLabel="Compartilhar com a casa"
              trackColor={{ false: t.border.default, true: t.accent.neon }}
              thumbColor={t.background.base}
            />
          </View>
        ) : null}

        {erro ? (
          <Text style={{ color: t.semantic.danger, fontSize: 12, marginTop: spacing[3] }}>
            {erro}
          </Text>
        ) : null}

        <Pressable
          onPress={comecar}
          accessibilityRole="button"
          accessibilityLabel="Começar a compra"
          style={{
            height: 52,
            borderRadius: radius.xl,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.accent.neon,
            marginTop: spacing[5],
          }}
        >
          <Text style={{ color: t.text.inverse, fontWeight: "700", fontSize: 16 }}>
            Começar
          </Text>
        </Pressable>
      </ScrollView>
    </CustomModal>
  );
}
