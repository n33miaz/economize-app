import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Landmark from "lucide-react-native/dist/esm/icons/landmark";
import TriangleAlert from "lucide-react-native/dist/esm/icons/triangle-alert";
import X from "lucide-react-native/dist/esm/icons/x";

import type { BankTransaction, Category } from "../services/api";
import { getApiErrorStatus, updateTransactionAlias } from "../services/api";
import { useAccountsStore } from "../store/accountsStore";
import { useCategoriesStore } from "../store/categoriesStore";
import { useToastStore } from "../store/toastStore";
import type { AppTheme } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { typography } from "../theme/typography";
import * as Haptics from "../utils/haptics";
import {
  accountDisplayName,
  accountKindLabel,
  originShortLabel,
} from "../utils/accounts";
import { categoryPath } from "../utils/categoryTree";
import { formatLongDate } from "../utils/cycleWindow";
import { formatBRL } from "../utils/money";
import {
  TRANSACTION_ALIAS_MAX_LENGTH,
  aliasChanged,
  categorizedByLabel,
  sanitizeTransactionAlias,
  transactionDisplayName,
  transactionOriginalName,
  validateTransactionAlias,
  describeAliasFailure,
} from "../utils/transactions";
import CategoryIcon from "./CategoryIcon";
import CustomModal from "./CustomModal";
import FloatingLabelInput from "./FloatingLabelInput";

// A partir daqui o contador aparece: antes disso ele só faria barulho
const COUNTER_VISIBLE_FROM = 60;

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 40,
        paddingVertical: spacing[2],
      }}
    >
      <Text
        style={{ width: 108, color: t.text.tertiary, fontSize: 12 }}
        numberOfLines={2}
      >
        {label}
      </Text>
      <View style={{ flex: 1, alignItems: "flex-end" }}>{children}</View>
    </View>
  );
}

interface TransactionDetailSheetProps {
  transaction: BankTransaction | null;
  visible: boolean;
  onClose: () => void;
  /** Recebe a transação como o servidor devolveu, para o chamador propagar. */
  onUpdated: (updated: BankTransaction) => void;
}

/**
 * Detalhes da transação e edição do apelido (EC-094).
 *
 * O apelido troca o nome só na visão do usuário; o texto do banco continua
 * guardado e aparece aqui em destaque próprio — renomear não pode custar o
 * acesso ao que o extrato realmente diz.
 */
export default function TransactionDetailSheet({
  transaction,
  visible,
  onClose,
  onUpdated,
}: TransactionDetailSheetProps) {
  const t = useTheme();
  const categories = useCategoriesStore((s) => s.items);
  // O extrato devolve só o `accountId`: quem sabe o nome do cartão é o mapa
  // carregado uma vez pelo accountsStore
  const accountsById = useAccountsStore((s) => s.byId);
  const showToast = useToastStore((s) => s.showToast);

  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Trava do envio em ref, e não no estado: `isSaving` fica congelado no
  // fechamento do render, então dois toques no MESMO frame (ou o toque somado
  // ao "concluir" do teclado) passavam os dois pela guarda e disparavam dois
  // PATCH, dois toasts e dois haptics
  const savingRef = useRef(false);

  // Cada abertura recomeça do apelido salvo: rascunho de uma transação não pode
  // reaparecer sobre outra
  useEffect(() => {
    if (visible && transaction) {
      setDraft(transaction.displayAlias ?? "");
      setError(null);
      setIsSaving(false);
      savingRef.current = false;
    }
  }, [visible, transaction]);

  const category: Category | undefined = useMemo(() => {
    if (!transaction?.categoryId) return undefined;
    return categories.find((item) => item.id === transaction.categoryId);
  }, [categories, transaction?.categoryId]);

  if (!transaction) {
    return <CustomModal visible={visible} onClose={onClose}>{null}</CustomModal>;
  }

  const account = transaction.accountId
    ? accountsById.get(transaction.accountId)
    : undefined;
  const displayName = transactionDisplayName(transaction);
  const originalName = transactionOriginalName(transaction);
  const renamed = Boolean(transaction.displayAlias?.trim());
  const negative = transaction.type === "DEBIT" || transaction.amount < 0;
  const sanitizedDraft = sanitizeTransactionAlias(draft);
  const dirty = aliasChanged(transaction.displayAlias ?? null, sanitizedDraft);
  const atAliasLimit = draft.length >= TRANSACTION_ALIAS_MAX_LENGTH;

  const submit = async (value: string | null) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateTransactionAlias(transaction.id, value);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onUpdated(updated);
      onClose();
      showToast(
        value ? "Apelido salvo." : "Apelido removido.",
        "success",
      );
    } catch (e) {
      // Erro fica NA folha, e não em toast: o Toast é montado fora do Modal e
      // pode não aparecer por cima dele. Falha silenciosa aqui seria a tela
      // afirmando um rename que não aconteceu
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(describeAliasFailure(getApiErrorStatus(e)));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleSave = () => {
    const validation = validateTransactionAlias(draft);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    submit(validation.value);
  };

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
            alignItems: "flex-start",
            marginBottom: spacing[3],
          }}
        >
          <View style={{ flex: 1, marginRight: spacing[3] }}>
            <Text
              numberOfLines={2}
              style={{ color: t.text.primary, fontSize: 18, fontWeight: "700" }}
            >
              {displayName}
            </Text>
            <Text
              style={{
                ...typography.numericLg,
                color: negative ? t.chart.down : t.chart.up,
                marginTop: spacing[1],
              }}
            >
              {negative ? "- " : "+ "}
              {formatBRL(Math.abs(transaction.amount))}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            accessibilityLabel="Fechar detalhes"
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

        {/* O texto do banco em bloco próprio quando há apelido: é a informação
            que o rename esconde no resto do app, e ela não pode ficar perdida */}
        {renamed && (
          <View
            accessible
            accessibilityLabel={`Nome no banco: ${originalName}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: spacing[3],
              borderRadius: radius.lg,
              backgroundColor: t.background.elevated,
              borderWidth: 1,
              borderColor: t.border.subtle,
              marginBottom: spacing[3],
            }}
          >
            <Landmark size={15} color={t.text.tertiary} />
            <View style={{ flex: 1, marginLeft: spacing[2] }}>
              <Text style={{ color: t.text.tertiary, fontSize: 11 }}>
                Nome no banco
              </Text>
              <Text
                selectable
                style={{ color: t.text.secondary, fontSize: 13, marginTop: 1 }}
              >
                {originalName}
              </Text>
            </View>
          </View>
        )}

        <View
          style={{
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: t.border.subtle,
            backgroundColor: t.background.elevated,
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[1],
          }}
        >
          <DetailRow label="Categoria">
            {category ? (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {/* AppTheme tipa hexas literais do dark; os temas são
                    estruturalmente idênticos, então o cast da união é seguro */}
                <CategoryIcon
                  category={category}
                  theme={t as AppTheme}
                  size={24}
                />
                <Text
                  numberOfLines={1}
                  style={{
                    color: t.text.primary,
                    fontSize: 13,
                    fontWeight: "600",
                    marginLeft: spacing[2],
                    maxWidth: 180,
                  }}
                >
                  {categoryPath(category)}
                </Text>
              </View>
            ) : (
              <Text style={{ color: t.semantic.warning, fontSize: 13 }}>
                Sem categoria
              </Text>
            )}
          </DetailRow>

          <View style={{ height: 1, backgroundColor: t.border.subtle }} />

          {/* EC-113: de onde o lançamento veio. A linha existe SEMPRE — dizer
              "não informada" é resposta, e um campo que some quando não há
              dado faz o usuário achar que a tela quebrou */}
          <DetailRow label="Conta de origem">
            {account ? (
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  numberOfLines={1}
                  style={{
                    color: t.text.primary,
                    fontSize: 13,
                    fontWeight: "600",
                    textAlign: "right",
                  }}
                >
                  {accountDisplayName(account)}
                </Text>
                <Text style={{ color: t.text.tertiary, fontSize: 11 }}>
                  {accountKindLabel(account.type)}
                  {account.institution ? ` · ${account.institution}` : ""}
                </Text>
              </View>
            ) : (
              <Text
                style={{ color: t.text.tertiary, fontSize: 13, textAlign: "right" }}
              >
                {/* "Não reconhecida" quando a transação TEM origem e o mapa de
                    contas é que não chegou: dizer "não informada" ali afirmaria
                    que o dado não existe */}
                {originShortLabel(transaction.accountId, account)}
              </Text>
            )}
          </DetailRow>

          <View style={{ height: 1, backgroundColor: t.border.subtle }} />

          {/* "Categorização", e não "Origem": desde que a transação sabe de
              qual conta veio, chamar a procedência da CATEGORIA de origem
              passou a disputar a mesma palavra com a linha acima */}
          <DetailRow label="Categorização">
            <Text
              style={{ color: t.text.primary, fontSize: 13, textAlign: "right" }}
            >
              {categorizedByLabel(transaction.categorizedBy)}
              {transaction.reviewStatus !== "CONFIRMED"
                ? " · aguardando revisão"
                : ""}
            </Text>
          </DetailRow>

          <View style={{ height: 1, backgroundColor: t.border.subtle }} />

          <DetailRow label="Lançamento">
            <Text style={{ color: t.text.primary, fontSize: 13 }}>
              {formatLongDate(transaction.date)}
            </Text>
          </DetailRow>

          <View style={{ height: 1, backgroundColor: t.border.subtle }} />

          <DetailRow label="Identificação no banco">
            <Text
              selectable
              numberOfLines={1}
              style={{ color: t.text.secondary, fontSize: 12 }}
            >
              {transaction.transactionId}
            </Text>
          </DetailRow>
        </View>

        <Text
          style={{
            color: t.text.tertiary,
            fontSize: 11,
            lineHeight: 16,
            marginTop: spacing[2],
          }}
        >
          A data é a de lançamento, em UTC — o extrato não traz data de
          liquidação.
          {transaction.accountId
            ? ""
            : " A origem fica em branco quando o lançamento veio de arquivo importado ou é anterior à sincronização por conta — o valor e a categoria continuam valendo."}
        </Text>

        <View
          style={{
            height: 1,
            backgroundColor: t.border.subtle,
            marginVertical: spacing[4],
          }}
        />

        <Text
          style={{
            color: t.text.primary,
            fontSize: 15,
            fontWeight: "700",
            marginBottom: spacing[1],
          }}
        >
          Apelido
        </Text>
        <Text
          style={{
            color: t.text.secondary,
            fontSize: 12,
            lineHeight: 17,
            marginBottom: spacing[3],
          }}
        >
          Troca o nome só na sua tela. O texto do banco continua guardado e a
          categorização automática segue usando ele.
        </Text>

        <FloatingLabelInput
          label="Como você chama isso"
          value={draft}
          onChangeText={(text) => {
            setDraft(text);
            if (error) setError(null);
          }}
          maxLength={TRANSACTION_ALIAS_MAX_LENGTH}
          autoCapitalize="sentences"
          returnKeyType="done"
          onSubmitEditing={handleSave}
          error={error}
        />

        {error ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: spacing[2],
            }}
          >
            <TriangleAlert size={14} color={t.semantic.danger} />
            <Text
              style={{
                flex: 1,
                marginLeft: spacing[2],
                color: t.semantic.danger,
                fontSize: 12,
                lineHeight: 17,
              }}
            >
              {error}
            </Text>
          </View>
        ) : draft.length >= COUNTER_VISIBLE_FROM ? (
          // No teto o campo simplesmente para de aceitar. Sem dizer nada, quem
          // colou um texto longo acha que o app comeu o resto — então o
          // contador vira frase, em cor de aviso e anunciada pelo leitor
          <Text
            accessibilityLiveRegion="polite"
            style={{
              color: atAliasLimit ? t.semantic.warning : t.text.tertiary,
              fontSize: 11,
              marginTop: spacing[2],
              textAlign: "right",
              fontVariant: ["tabular-nums"],
            }}
          >
            {atAliasLimit
              ? `Limite de ${TRANSACTION_ALIAS_MAX_LENGTH} caracteres atingido`
              : `${draft.length}/${TRANSACTION_ALIAS_MAX_LENGTH}`}
          </Text>
        ) : null}

        <TouchableOpacity
          onPress={handleSave}
          disabled={!dirty || isSaving}
          accessibilityLabel="Salvar apelido"
          accessibilityRole="button"
          accessibilityState={{ disabled: !dirty || isSaving }}
          activeOpacity={0.85}
          style={{
            height: 52,
            marginTop: spacing[4],
            borderRadius: radius.full,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.accent.neon,
            opacity: !dirty || isSaving ? 0.5 : 1,
          }}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={t.text.inverse} />
          ) : (
            <Text
              style={{ color: t.text.inverse, fontSize: 15, fontWeight: "700" }}
            >
              Salvar apelido
            </Text>
          )}
        </TouchableOpacity>

        {renamed && (
          <TouchableOpacity
            onPress={() => submit(null)}
            disabled={isSaving}
            accessibilityLabel="Remover apelido e voltar ao nome do banco"
            accessibilityRole="button"
            accessibilityState={{ disabled: isSaving }}
            activeOpacity={0.7}
            style={{
              height: 48,
              alignItems: "center",
              justifyContent: "center",
              marginTop: spacing[1],
            }}
          >
            <Text
              style={{
                color: t.semantic.danger,
                fontSize: 14,
                fontWeight: "700",
              }}
            >
              Remover apelido
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </CustomModal>
  );
}
