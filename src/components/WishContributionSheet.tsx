import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import X from "lucide-react-native/dist/esm/icons/x";

import {
  type Wish,
  type WishContribution,
  contributeToWish,
  getWishContributions,
} from "../services/api";
import { useTheme } from "../theme/ThemeProvider";
import { radius, SHEET_PADDING, spacing } from "../theme/ds";
import * as Haptics from "../utils/haptics";
import { formatBRL, parseAmount } from "../utils/money";
import { translateWishError } from "../utils/wishes";
import CustomModal from "./CustomModal";

interface Props {
  visible: boolean;
  /** A meta que vai receber o dinheiro; null enquanto a folha está fechada. */
  wish: Wish | null;
  /**
   * A sobra típica que o app apurou, e o ciclo de onde ela veio.
   *
   * <p>Quando presente, vira a proposta de um toque. Nulo é estado normal:
   * quem não tem ciclo fechado ainda não tem sobra medida, e aí só existe o
   * aporte digitado.
   */
  leftover: { amount: number; cycleMonth: string } | null;
  onClose: () => void;
  /** Chamado depois de gravar, para a tela recarregar a meta. */
  onSaved: () => void;
}

/**
 * Guardar dinheiro numa meta — EC-205.
 *
 * <p><b>O app propõe, ele não move.</b> A sobra do ciclo é o que o app mediu,
 * e ela vira um botão de um toque. Mas quem decide se guardou mesmo é o dono
 * da conta: um app que somasse a sobra à meta sozinho estaria afirmando um
 * fato sobre a vida de alguém que ele não tem como saber — a pessoa pode ter
 * gastado aquela sobra no dia seguinte.
 *
 * <p><b>Medido e digitado ficam separados na lista.</b> O aporte que veio da
 * sobra apurada carrega o ciclo; o digitado não carrega nada. É a mesma
 * distinção que o EC-206 pede da previsão, e é ela que permite ao usuário
 * confiar no número: ele sabe qual parte o app mediu.
 *
 * <p><b>Devolver é lançar negativo.</b> Não existe "apagar aporte": corrigir
 * um dedo errado lança o valor de volta, que sai do saldo e <b>fica</b> no
 * histórico. Apagar esconderia que houve erro, que é o contrário do que o
 * extrato existe para fazer.
 */
export default function WishContributionSheet({
  visible,
  wish,
  leftover,
  onClose,
  onSaved,
}: Props) {
  const t = useTheme();

  const [amount, setAmount] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<WishContribution[]>([]);

  const carregarHistorico = useCallback(async (id: string) => {
    try {
      setHistory(await getWishContributions(id));
    } catch {
      // O extrato é apoio: falhar aqui não pode impedir de guardar dinheiro
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    if (!visible || !wish) return;
    setAmount("");
    setError(null);
    setIsSaving(false);
    carregarHistorico(wish.id);
  }, [visible, wish, carregarHistorico]);

  const guardar = async (valor: number, cycleMonth?: string) => {
    if (!wish || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await contributeToWish(wish.id, { amount: valor, cycleMonth: cycleMonth ?? null });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await carregarHistorico(wish.id);
      setAmount("");
      onSaved();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // A mensagem do servidor é específica ("a sobra de 2026-09 já foi
      // guardada"), e trocá-la por um genérico faria a pessoa tentar de novo
      setError(translateWishError(e, "Não consegui guardar agora. Tente de novo."));
    } finally {
      setIsSaving(false);
    }
  };

  const submeter = () => {
    const valor = parseAmount(amount);
    if (valor == null || valor === 0) {
      setError("Informe quanto você guardou. Para corrigir, use um valor negativo.");
      return;
    }
    guardar(valor);
  };

  const faltam = wish ? Math.max(0, wish.targetAmount - wish.savedAmount) : 0;

  return (
    <CustomModal visible={visible} onClose={onClose}>
      {wish ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={SHEET_PADDING}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: spacing[3],
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text.primary, fontSize: 16, fontWeight: "800" }}>
                Guardar para {wish.name}
              </Text>
              <Text style={{ color: t.text.tertiary, fontSize: 12, marginTop: 2 }}>
                {formatBRL(wish.savedAmount)} de {formatBRL(wish.targetAmount)}
                {faltam > 0 ? ` · faltam ${formatBRL(faltam)}` : " · meta batida"}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              hitSlop={8}
            >
              <X size={20} color={t.text.tertiary} />
            </Pressable>
          </View>

          {leftover && leftover.amount > 0 ? (
            <Pressable
              onPress={() => guardar(leftover.amount, leftover.cycleMonth)}
              disabled={isSaving}
              accessibilityRole="button"
              accessibilityLabel={`Guardar a sobra de ${formatBRL(leftover.amount)} do ciclo ${leftover.cycleMonth}`}
              style={{
                borderWidth: 1,
                borderColor: t.accent.neon,
                borderRadius: radius.lg,
                padding: spacing[3],
                opacity: isSaving ? 0.5 : 1,
              }}
            >
              <Text style={{ color: t.accent.neon, fontSize: 13, fontWeight: "700" }}>
                Guardar a sobra de {formatBRL(leftover.amount)}
              </Text>
              <Text style={{ color: t.text.tertiary, fontSize: 11, marginTop: 2 }}>
                É o que sobrou no ciclo {leftover.cycleMonth}, medido no seu extrato. Entra
                uma vez só.
              </Text>
            </Pressable>
          ) : null}

          <Text
            style={{
              color: t.text.tertiary,
              fontSize: 10,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginTop: spacing[4],
            }}
          >
            Ou informe o valor
          </Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            accessibilityLabel={`Quanto guardar para ${wish.name}`}
            placeholder="0,00"
            placeholderTextColor={t.text.tertiary}
            style={{
              color: t.text.primary,
              fontSize: 18,
              fontWeight: "700",
              borderWidth: 1,
              borderColor: t.border.subtle,
              borderRadius: radius.lg,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[3],
              marginTop: spacing[2],
            }}
          />
          <Text style={{ color: t.text.tertiary, fontSize: 11, marginTop: spacing[2] }}>
            Valor negativo devolve o dinheiro: sai do saldo e fica no histórico abaixo.
          </Text>

          {error ? (
            <Text style={{ color: t.semantic.danger, fontSize: 12, marginTop: spacing[3] }}>
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={submeter}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel="Guardar o valor informado"
            accessibilityState={{ disabled: isSaving }}
            style={{
              height: 48,
              borderRadius: radius.xl,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: t.accent.neon,
              opacity: isSaving ? 0.5 : 1,
              marginTop: spacing[4],
            }}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={t.text.inverse} />
            ) : (
              <Text style={{ color: t.text.inverse, fontWeight: "700", fontSize: 14 }}>
                Guardar
              </Text>
            )}
          </Pressable>

          {history.length > 0 ? (
            <View style={{ marginTop: spacing[6] }}>
              <Text
                style={{
                  color: t.text.tertiary,
                  fontSize: 10,
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginBottom: spacing[2],
                }}
              >
                O que explica este saldo
              </Text>
              {history.map((linha) => (
                <View
                  key={linha.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: spacing[2],
                    borderTopWidth: 1,
                    borderTopColor: t.border.subtle,
                  }}
                >
                  <View style={{ flex: 1, paddingRight: spacing[2] }}>
                    <Text style={{ color: t.text.primary, fontSize: 13, fontWeight: "700" }}>
                      {linha.amount < 0 ? "Devolvido" : "Guardado"}
                    </Text>
                    <Text style={{ color: t.text.tertiary, fontSize: 11, marginTop: 2 }}>
                      {linha.origin === "MEASURED" && linha.cycleMonth
                        ? `sobra medida do ciclo ${linha.cycleMonth}`
                        : "valor informado por você"}
                      {linha.note ? ` · ${linha.note}` : ""}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: linha.amount < 0 ? t.semantic.danger : t.text.primary,
                      fontSize: 13,
                      fontWeight: "700",
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {linha.amount < 0 ? "" : "+"}
                    {formatBRL(linha.amount)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      ) : null}
    </CustomModal>
  );
}
