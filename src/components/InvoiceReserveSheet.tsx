import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import X from "lucide-react-native/dist/esm/icons/x";

import type { AccountInvoice, ConnectorAccount } from "../services/api";
import {
  deleteInvoiceReserve,
  saveInvoiceReserve,
} from "../services/api";
import { useTheme } from "../theme/ThemeProvider";
import { radius, SHEET_PADDING, spacing } from "../theme/ds";
import * as Haptics from "../utils/haptics";
import { accountDisplayName } from "../utils/accounts";
import { formatBRL, parseAmount } from "../utils/money";
import CustomModal from "./CustomModal";

interface InvoiceReserveSheetProps {
  visible: boolean;
  /** A fatura sendo coberta; null enquanto a folha está fechada. */
  invoice: AccountInvoice | null;
  cardAccountId: string | null;
  /** Contas onde o dinheiro pode estar parado — cartão não entra na lista. */
  accounts: ConnectorAccount[];
  onClose: () => void;
  /** Chamado depois de gravar ou apagar, para a tela recarregar as faturas. */
  onSaved: () => void;
}

/**
 * Separar dinheiro para uma fatura — EC-181.
 *
 * <p>O pedido veio da situação real: o dono deixou na conta Mercado Pago
 * exatamente o valor da compra parcelada do Mercado Livre e o app lia aquilo
 * como saldo livre. Registrar isso NÃO cria lançamento nenhum: o dinheiro não
 * saiu, e inventar um débito falsificaria o extrato — a única superfície do
 * app que espelha o banco linha a linha.
 *
 * <p>"Separei o valor exato" é o caso comum, então o campo já nasce preenchido
 * com o total da fatura: quem quer o exato só confirma.
 */
export default function InvoiceReserveSheet({
  visible,
  invoice,
  cardAccountId,
  accounts,
  onClose,
  onSaved,
}: InvoiceReserveSheetProps) {
  const t = useTheme();

  const [amount, setAmount] = useState("");
  const [heldIn, setHeldIn] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existing = invoice?.reserve ?? null;

  // Cada abertura recomeça do que está salvo: rascunho de uma fatura não pode
  // reaparecer sobre outra
  useEffect(() => {
    if (!visible || !invoice) return;
    setAmount(
      existing
        ? String(existing.amount).replace(".", ",")
        : String(Math.max(invoice.total, 0).toFixed(2)).replace(".", ","),
    );
    setHeldIn(existing?.heldInAccountId ?? null);
    setNote(existing?.note ?? "");
    setError(null);
    setIsSaving(false);
  }, [visible, invoice, existing]);

  // Só conta bancária guarda dinheiro parado: reservar "no cartão" o valor da
  // fatura do próprio cartão não quer dizer nada
  const holders = accounts.filter((account) => account.type !== "CREDIT_CARD");

  const submit = async () => {
    if (!invoice || !cardAccountId || isSaving) return;
    const value = parseAmount(amount);
    if (value == null) {
      setError("Informe quanto você separou.");
      return;
    }
    if (value <= 0) {
      setError("O valor separado precisa ser maior que zero.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await saveInvoiceReserve(cardAccountId, invoice.reference, {
        amount: value,
        heldInAccountId: heldIn,
        note: note.trim() || null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
      onClose();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Erro fica NA folha, e não em toast: o Toast é montado fora do Modal e
      // pode não aparecer por cima dele
      setError("Não consegui guardar agora. Tente de novo.");
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (!invoice || !cardAccountId || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await deleteInvoiceReserve(cardAccountId, invoice.reference);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
      onClose();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError("Não consegui desfazer agora. Tente de novo.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <CustomModal visible={visible} onClose={onClose}>
      {invoice ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={SHEET_PADDING}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: spacing[3],
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text.primary, fontSize: 16, fontWeight: "800" }}>
                Dinheiro separado
              </Text>
              <Text style={{ color: t.text.tertiary, fontSize: 12, marginTop: 2 }}>
                Fatura de {formatBRL(invoice.total)}
                {invoice.open ? " · ainda em aberto" : ""}
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

          <Text style={{ color: t.text.secondary, fontSize: 12, lineHeight: 17 }}>
            Nada sai da sua conta e nenhum lançamento é criado — o extrato
            continua igual. Isto só diz ao app que essa parte do saldo já tem
            destino, para ela não aparecer como dinheiro livre.
          </Text>

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
            Quanto
          </Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            accessibilityLabel="Valor separado"
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
            Onde está
          </Text>
          <Text style={{ color: t.text.tertiary, fontSize: 11, marginTop: 2 }}>
            Opcional — dá para separar fora do que o app enxerga.
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing[2],
              marginTop: spacing[2],
            }}
          >
            <Chip
              label="Não dizer"
              selected={heldIn == null}
              onPress={() => setHeldIn(null)}
            />
            {holders.map((account) => (
              <Chip
                key={account.id}
                label={accountDisplayName(account)}
                selected={heldIn === account.id}
                onPress={() => setHeldIn(account.id)}
              />
            ))}
          </View>

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
            Anotação
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            maxLength={200}
            accessibilityLabel="Anotação da reserva"
            placeholder="dinheiro do 13º, adiantei o parcelamento…"
            placeholderTextColor={t.text.tertiary}
            style={{
              color: t.text.primary,
              fontSize: 14,
              borderWidth: 1,
              borderColor: t.border.subtle,
              borderRadius: radius.lg,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[3],
              marginTop: spacing[2],
            }}
          />

          {error ? (
            <Text
              style={{ color: t.semantic.danger, fontSize: 12, marginTop: spacing[3] }}
            >
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={submit}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel="Guardar o valor separado"
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

          {existing ? (
            <Pressable
              onPress={remove}
              disabled={isSaving}
              accessibilityRole="button"
              accessibilityLabel="Desfazer a reserva desta fatura"
              style={{
                height: 44,
                alignItems: "center",
                justifyContent: "center",
                marginTop: spacing[2],
              }}
            >
              <Text style={{ color: t.semantic.danger, fontWeight: "700", fontSize: 13 }}>
                Desfazer a reserva
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      ) : null}
    </CustomModal>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={{
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: selected ? t.accent.neon : t.border.subtle,
        backgroundColor: selected ? t.accent.neonMuted : t.background.elevated,
      }}
    >
      <Text
        style={{
          color: selected ? t.accent.neon : t.text.secondary,
          fontSize: 12,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
