import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import CreditCard from "lucide-react-native/dist/esm/icons/credit-card";
import Landmark from "lucide-react-native/dist/esm/icons/landmark";
import X from "lucide-react-native/dist/esm/icons/x";

import type { PurchaseCadence, PurchasePaymentMode } from "../services/api";
import { useAccountsStore } from "../store/accountsStore";
import { useToastStore } from "../store/toastStore";
import { useWishStore } from "../store/wishStore";
import { useTheme } from "../theme/ThemeProvider";
import { SHEET_PADDING, SHEET_TITLE, radius, spacing } from "../theme/ds";
import * as Haptics from "../utils/haptics";
import { preferenceSummary } from "../utils/purchaseDay";
import CustomModal from "./CustomModal";
import SegmentedControl from "./SegmentedControl";

/** "AUTO" não vai ao servidor: é o DELETE da preferência. */
type CadenceChoice = PurchaseCadence | "AUTO";

const CADENCE_OPTIONS: { label: string; value: CadenceChoice }[] = [
  { label: "Mensal", value: "MONTHLY" },
  { label: "Semanal", value: "WEEKLY" },
  { label: "Deixar o app deduzir", value: "AUTO" },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * Como a pessoa faz as compras (EC-237).
 *
 * <p>Três respostas decidem o dia recomendado: de quanto em quanto tempo ela
 * compra, se prefere o fim de semana e com que dinheiro paga. O app deduz as
 * três do extrato — mas dedução é chute educado, e quem compra sabe melhor.
 * "Deixar o app deduzir" existe como opção explícita para a pessoa poder
 * DESFAZER o que declarou sem precisar adivinhar qual era a dedução.
 *
 * <p>Cartão sem dia de fechamento conhecido aparece rotulado, não escondido:
 * escolher é permitido, e a Previsão vai responder "não sei quando seu cartão
 * fecha" em vez de chutar um dia.
 */
export default function PurchasePreferenceSheet({ visible, onClose }: Props) {
  const t = useTheme();
  const showToast = useToastStore((s) => s.showToast);
  const incomePattern = useWishStore((s) => s.incomePattern);
  const isSaving = useWishStore((s) => s.isSaving);
  const savePurchasePreference = useWishStore((s) => s.savePurchasePreference);
  const clearPurchasePreference = useWishStore(
    (s) => s.clearPurchasePreference,
  );
  const accounts = useAccountsStore((s) => s.accounts);
  const fetchAccounts = useAccountsStore((s) => s.fetchAccounts);

  const preference = incomePattern?.preference ?? null;
  const inferred = incomePattern?.inferred ?? null;
  const cartoes = useMemo(
    () => accounts.filter((a) => a.type === "CREDIT_CARD"),
    [accounts],
  );

  const [cadence, setCadence] = useState<CadenceChoice>("AUTO");
  const [weekend, setWeekend] = useState(true);
  const [paymentMode, setPaymentMode] = useState<PurchasePaymentMode>("CASH");
  const [cardAccountId, setCardAccountId] = useState<string | null>(null);

  // Cada abertura parte do que está salvo (ou deduzido): fechar sem salvar
  // não pode deixar rascunho pendurado para a próxima vez
  useEffect(() => {
    if (!visible) return;
    setCadence(preference?.cadence ?? "AUTO");
    setWeekend(
      preference?.weekendPreferred ??
        (inferred?.weekendShare != null ? inferred.weekendShare >= 0.5 : true),
    );
    setPaymentMode(preference?.paymentMode ?? "CASH");
    setCardAccountId(preference?.cardAccountId ?? null);
  }, [visible, preference, inferred]);

  // A lista de cartões vem das contas; quem chega pela Previsão pode nunca
  // ter aberto a Carteira. O store devolve na hora quando já tem
  useEffect(() => {
    if (visible) fetchAccounts();
  }, [visible, fetchAccounts]);

  const escolherCartao = (id: string) => {
    Haptics.selectionAsync();
    setPaymentMode("CARD");
    setCardAccountId(id);
  };

  const escolherConta = () => {
    Haptics.selectionAsync();
    setPaymentMode("CASH");
  };

  const salvar = async () => {
    if (cadence !== "AUTO" && paymentMode === "CARD" && !cardAccountId) {
      showToast("Escolha qual cartão paga o mercado.", "warning");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result =
      cadence === "AUTO"
        ? await clearPurchasePreference()
        : await savePurchasePreference({
            cadence,
            weekendPreferred: weekend,
            paymentMode,
            cardAccountId: paymentMode === "CARD" ? cardAccountId : null,
          });
    showToast(result.message, result.ok ? "success" : "error");
    if (result.ok) onClose();
  };

  const opcaoStyle = (active: boolean) =>
    ({
      flexDirection: "row",
      alignItems: "center",
      minHeight: 52,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: active ? t.accent.neon : t.border.subtle,
      backgroundColor: t.background.elevated,
      marginBottom: spacing[2],
    }) as const;

  return (
    <CustomModal visible={visible} onClose={onClose}>
      <View style={SHEET_PADDING}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: spacing[2],
          }}
        >
          <Text style={{ flex: 1, color: t.text.primary, ...SHEET_TITLE }}>
            Como você faz as compras
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
          É o que decide o dia recomendado: a compra do mês espera o dinheiro
          cair; a da semana espera o dia que você prefere.
        </Text>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 420 }}
        >
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
            Com que frequência
          </Text>
          <SegmentedControl
            options={CADENCE_OPTIONS}
            value={cadence}
            onChange={setCadence}
            size="md"
          />

          {cadence === "AUTO" ? (
            <Text
              style={{
                color: t.text.secondary,
                fontSize: 12,
                lineHeight: 17,
                marginTop: spacing[3],
              }}
            >
              {preferenceSummary(null, inferred)}
            </Text>
          ) : (
            <>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  minHeight: 44,
                  marginTop: spacing[4],
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    color: t.text.primary,
                    fontSize: 14,
                    fontWeight: "600",
                    marginRight: spacing[3],
                  }}
                >
                  Prefiro comprar no fim de semana
                </Text>
                <Switch
                  value={weekend}
                  onValueChange={(next) => {
                    Haptics.selectionAsync();
                    setWeekend(next);
                  }}
                  accessibilityLabel="Prefiro comprar no fim de semana"
                  trackColor={{
                    false: t.border.subtle,
                    true: t.accent.neonMuted,
                  }}
                  thumbColor={weekend ? t.accent.neon : t.text.tertiary}
                />
              </View>

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
                Pago com
              </Text>

              <TouchableOpacity
                onPress={escolherConta}
                accessibilityRole="radio"
                accessibilityLabel="Dinheiro da conta"
                accessibilityState={{ selected: paymentMode === "CASH" }}
                activeOpacity={0.8}
                style={opcaoStyle(paymentMode === "CASH")}
              >
                <Landmark
                  size={18}
                  color={
                    paymentMode === "CASH" ? t.accent.neon : t.text.tertiary
                  }
                />
                <View style={{ flex: 1, marginLeft: spacing[3] }}>
                  <Text
                    style={{
                      color: t.text.primary,
                      fontSize: 14,
                      fontWeight: "600",
                    }}
                  >
                    Dinheiro da conta
                  </Text>
                  <Text
                    style={{ color: t.text.tertiary, fontSize: 11, marginTop: 2 }}
                  >
                    A compra espera o dinheiro cair
                  </Text>
                </View>
              </TouchableOpacity>

              {cartoes.map((cartao) => {
                const active =
                  paymentMode === "CARD" && cardAccountId === cartao.id;
                const fechamento =
                  cartao.statementClosingDay != null
                    ? `Fecha dia ${cartao.statementClosingDay}`
                    : "Fechamento desconhecido";
                return (
                  <TouchableOpacity
                    key={cartao.id}
                    onPress={() => escolherCartao(cartao.id)}
                    accessibilityRole="radio"
                    accessibilityLabel={`Cartão ${cartao.name}, ${fechamento.toLowerCase()}`}
                    accessibilityState={{ selected: active }}
                    activeOpacity={0.8}
                    style={opcaoStyle(active)}
                  >
                    <CreditCard
                      size={18}
                      color={active ? t.accent.neon : t.text.tertiary}
                    />
                    <View style={{ flex: 1, marginLeft: spacing[3] }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: t.text.primary,
                          fontSize: 14,
                          fontWeight: "600",
                        }}
                      >
                        {cartao.name}
                      </Text>
                      <Text
                        style={{
                          color:
                            cartao.statementClosingDay != null
                              ? t.text.tertiary
                              : t.semantic.warning,
                          fontSize: 11,
                          marginTop: 2,
                        }}
                      >
                        {fechamento}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {cartoes.length === 0 ? (
                <Text
                  style={{
                    color: t.text.tertiary,
                    fontSize: 11,
                    lineHeight: 16,
                  }}
                >
                  Nenhum cartão conhecido. Conecte o banco ou importe a fatura
                  para escolher um.
                </Text>
              ) : null}
            </>
          )}
        </ScrollView>

        <TouchableOpacity
          onPress={salvar}
          disabled={isSaving}
          accessibilityRole="button"
          accessibilityLabel="Salvar como você compra"
          activeOpacity={0.8}
          style={{
            height: 52,
            borderRadius: radius.xl,
            alignItems: "center",
            justifyContent: "center",
            marginTop: spacing[4],
            backgroundColor: t.accent.neon,
            opacity: isSaving ? 0.6 : 1,
          }}
        >
          <Text
            style={{ color: t.text.inverse, fontSize: 15, fontWeight: "700" }}
          >
            {cadence === "AUTO" ? "Deixar o app deduzir" : "Salvar"}
          </Text>
        </TouchableOpacity>
      </View>
    </CustomModal>
  );
}
