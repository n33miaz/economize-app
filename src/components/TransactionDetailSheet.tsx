import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Landmark from "lucide-react-native/dist/esm/icons/landmark";
import TriangleAlert from "lucide-react-native/dist/esm/icons/triangle-alert";
import X from "lucide-react-native/dist/esm/icons/x";

import type { BankTransaction, Category } from "../services/api";
import {
  applyReview,
  getApiErrorStatus,
  setFamilyTransfer,
  setInternalTransfer,
  setTransactionIgnored,
  updateTransactionAlias,
} from "../services/api";
import { useAccountsStore } from "../store/accountsStore";
import { useImportSourcesStore } from "../store/importSourcesStore";
import { useFamilyStore } from "../store/familyStore";
import { useCategoriesStore } from "../store/categoriesStore";
import { useToastStore } from "../store/toastStore";
import type { AppTheme } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { SHEET_PADDING, SHEET_TITLE, radius, spacing } from "../theme/ds";
import { typography } from "../theme/typography";
import * as Haptics from "../utils/haptics";
import {
  accountDisplayName,
  accountKindLabel,
  originShortLabel,
} from "../utils/accounts";
import { provenanceOf } from "../utils/provenance";
import CategoryPickerSheet from "./CategoryPickerSheet";
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
import { amountLabel, amountTone, amountVerb } from "../utils/transactionRow";
import BankLogo from "./BankLogo";
import CategoryIcon from "./CategoryIcon";
import CustomModal from "./CustomModal";
import FloatingLabelInput from "./FloatingLabelInput";
import TransactionReceiptBlock from "./TransactionReceiptBlock";
import { amountColor } from "./TransactionRow";

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

/**
 * As três marcas que uma linha do extrato pode carregar, e o que cada uma quer
 * dizer. São coisas diferentes de propósito — juntar tudo em "ignorar" perderia
 * a informação de POR QUE a linha não conta.
 */
type MarkKey = "internal" | "family" | "ignored";

const MARK_FAILURE = "Não consegui mudar isso agora. Tente de novo.";

interface TransactionDetailSheetProps {
  transaction: BankTransaction | null;
  visible: boolean;
  onClose: () => void;
  /** Recebe a transação como o servidor devolveu, para o chamador propagar. */
  onUpdated: (updated: BankTransaction) => void;
  /**
   * Abre a compra do carrinho ligada a este lançamento. Ausente esconde o
   * atalho — a folha continua inteira sem um navegador por perto.
   */
  onOpenTrip?: (tripClientId: string) => void;
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
  onOpenTrip,
}: TransactionDetailSheetProps) {
  const t = useTheme();
  const categories = useCategoriesStore((s) => s.items);
  // O extrato devolve só o `accountId`: quem sabe o nome do cartão é o mapa
  // carregado uma vez pelo accountsStore
  const accountsById = useAccountsStore((s) => s.byId);
  // EC-195: o mapa dos arquivos importados, pelo mesmo motivo do mapa de
  // contas -- a linha traz só o `uploadId`
  const sourcesById = useImportSourcesStore((s) => s.byId);
  const fetchSources = useImportSourcesStore((s) => s.fetchSources);
  const showToast = useToastStore((s) => s.showToast);
  // O interruptor da casa só existe para quem tem casa: sem família, a
  // marca não muda soma nenhuma e seria um controle sem efeito
  const hasFamily = useFamilyStore((s) => s.hasFamily);

  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // EC-198: a categoria vira editável AQUI, e não só na Revisão. Quem
  // desconfia de um número está olhando para ele — mandar a pessoa procurar a
  // mesma linha noutra tela para corrigir é pedir que ela desista
  const [pickerAberto, setPickerAberto] = useState(false);
  const [salvandoCategoria, setSalvandoCategoria] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Trava do envio em ref, e não no estado: `isSaving` fica congelado no
  // fechamento do render, então dois toques no MESMO frame (ou o toque somado
  // ao "concluir" do teclado) passavam os dois pela guarda e disparavam dois
  // PATCH, dois toasts e dois haptics
  const savingRef = useRef(false);

  // Qual das três marcas está sendo gravada agora, ou null. Uma só por vez:
  // são decisões diferentes sobre a mesma linha, e deixar duas em voo faria a
  // resposta mais lenta sobrescrever a mais rápida
  const [markPending, setMarkPending] = useState<MarkKey | null>(null);

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

  // O mapa de arquivos importados, só quando a folha abre: é aqui que a
  // procedência é lida, e carregá-lo no boot custaria uma chamada para quem
  // nunca abre o detalhe. O store tem cache de sessão, então reabrir não pede
  // de novo — e uma falha aqui degrada para "veio de um arquivo importado",
  // que ainda é resposta
  useEffect(() => {
    if (visible) void fetchSources();
  }, [visible, fetchSources]);

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
  const upload = transaction.uploadId
    ? sourcesById.get(transaction.uploadId)
    : undefined;
  const procedencia = provenanceOf(transaction, account, upload);
  const displayName = transactionDisplayName(transaction);
  const originalName = transactionOriginalName(transaction);
  const renamed = Boolean(transaction.displayAlias?.trim());
  const sanitizedDraft = sanitizeTransactionAlias(draft);
  const dirty = aliasChanged(transaction.displayAlias ?? null, sanitizedDraft);
  const atAliasLimit = draft.length >= TRANSACTION_ALIAS_MAX_LENGTH;

  /**
   * Troca a categoria daqui mesmo (EC-198).
   *
   * <p>Usa a MESMA porta da Revisão (`PATCH /transactions/review`), com
   * `learnPattern` ligado: corrigir uma linha ensina o motor, e ensinar de um
   * lugar e não do outro faria a mesma correção valer diferente conforme a
   * tela em que ela foi feita.
   */
  const trocarCategoria = async (novaId: string) => {
    if (salvandoCategoria) return;
    setSalvandoCategoria(true);
    setError(null);
    try {
      await applyReview([
        { transactionIds: [transaction.id], categoryId: novaId, learnPattern: true },
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // A resposta da revisão é um resumo, não a linha: devolvemos a linha
      // com a categoria nova para a tela não precisar recarregar tudo
      onUpdated({ ...transaction, categoryId: novaId, reviewStatus: "CONFIRMED" });
      showToast("Categoria atualizada.", "success");
    } catch (err) {
      // NA folha, e não em toast: o Toast é montado fora do Modal e pode não
      // aparecer por cima dele. Falha silenciosa aqui seria a tela afirmando
      // uma correção que não aconteceu
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(
        getApiErrorStatus(err) === 404
          ? "Este lançamento não existe mais."
          : "Não foi possível trocar a categoria agora.",
      );
    } finally {
      setSalvandoCategoria(false);
    }
  };

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

  const toggleMark = async (key: MarkKey, next: boolean) => {
    if (markPending) return;
    setMarkPending(key);
    try {
      const updated =
        key === "internal"
          ? await setInternalTransfer(transaction.id, next)
          : key === "family"
            ? await setFamilyTransfer(transaction.id, next)
            : await setTransactionIgnored(transaction.id, next);
      Haptics.selectionAsync();
      // A folha continua aberta: marcar é uma decisão que a pessoa costuma
      // tomar junto com outra na mesma linha, e fechar a cada toque obrigaria
      // a reabrir. Quem recarrega a lista é o onUpdated, como no apelido
      onUpdated(updated);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(MARK_FAILURE);
    } finally {
      setMarkPending(null);
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
        contentContainerStyle={SHEET_PADDING}
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
              style={{ color: t.text.primary, ...SHEET_TITLE }}
            >
              {displayName}
            </Text>
            <Text
              // O mesmo verbo que a linha fala: "saída" na conta, "compra"
              // no cartão — a folha não pode discordar da lista que a abriu
              accessibilityLabel={`${amountVerb(
                transaction,
                account?.type === "CREDIT_CARD" ? "card" : "bank",
              )} de ${formatBRL(Math.abs(transaction.amount))}`}
              style={{
                ...typography.numericLg,
                // Pela régua da linha: débito neutro (gastar não é erro),
                // crédito em alta, e o que não conta nas somas rebaixado
                color: amountColor(t, amountTone(transaction)),
                marginTop: spacing[1],
              }}
            >
              {amountLabel(transaction)}
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
            <TouchableOpacity
              onPress={() => setPickerAberto(true)}
              disabled={salvandoCategoria}
              accessibilityRole="button"
              accessibilityLabel={
                category
                  ? `Categoria ${categoryPath(category)}. Toque para trocar`
                  : "Sem categoria. Toque para escolher"
              }
              accessibilityState={{ disabled: salvandoCategoria }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
              style={{ opacity: salvandoCategoria ? 0.5 : 1 }}
            >
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
            </TouchableOpacity>
          </DetailRow>

          <View style={{ height: 1, backgroundColor: t.border.subtle }} />

          {/* EC-113: de onde o lançamento veio. A linha existe SEMPRE — dizer
              "não informada" é resposta, e um campo que some quando não há
              dado faz o usuário achar que a tela quebrou */}
          <DetailRow label="Conta de origem">
            {account ? (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {/* O logo entra só quando há instituição a nomear: sem ela, um
                    monograma de "cartão de crédito" seria enfeite */}
                {account.institution ? (
                  <BankLogo
                    institution={account.institution}
                    size={28}
                    style={{ marginRight: spacing[2] }}
                  />
                ) : null}
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

          {/* EC-195: as duas perguntas de quem desconfia de um número --
              por onde entrou e quando. A resposta nunca é vazia: a pior
              delas ainda é "origem não registrada" */}
          <DetailRow label="Entrou no app">
            <Text
              numberOfLines={2}
              style={{ color: t.text.primary, fontSize: 13, textAlign: "right" }}
            >
              {procedencia.origem}
              {procedencia.entrada ? `${"\n"}${procedencia.entrada}` : ""}
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
          liquidação, e ela é outra coisa que a hora em que a linha entrou aqui.
        </Text>

        {/* Só num débito de verdade: transferência entre as próprias contas e
          entrada de dinheiro não têm cupom fiscal para anexar */}
        {transaction.type === "DEBIT" && !transaction.internalTransfer ? (
          <TransactionReceiptBlock
            transaction={transaction}
            onOpenTrip={onOpenTrip}
          />
        ) : null}

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
          Como esta linha conta
        </Text>
        <Text
          style={{
            color: t.text.secondary,
            fontSize: 12,
            lineHeight: 17,
            marginBottom: spacing[2],
          }}
        >
          Nada aqui apaga o lançamento: ele continua no extrato, com o valor e a
          data do banco. O que muda é em quais somas ele entra.
        </Text>

        {transaction.refunded ? (
          <Text
            style={{
              color: t.text.secondary,
              fontSize: 12,
              lineHeight: 17,
              marginBottom: spacing[3],
            }}
          >
            Esta linha faz par com um estorno de mesmo valor, então ela já está
            fora das somas. As duas continuam no extrato porque o saldo fecha
            com as duas.
          </Text>
        ) : null}

        <MarkRow
          label="É dinheiro meu trocando de bolso"
          hint="Pagamento de fatura, Pix de uma conta minha para outra, aplicação e resgate de investimento. Sai de todas as somas."
          value={transaction.internalTransfer}
          busy={markPending === "internal"}
          disabled={markPending !== null && markPending !== "internal"}
          onChange={(next) => toggleMark("internal", next)}
        />

        {hasFamily ? (
          <MarkRow
            label="Ficou dentro da casa"
            hint="Pix entre vocês, mesada, rateio. Sai só da soma da Casa — aqui o dinheiro entrou mesmo."
            value={transaction.familyTransfer}
            busy={markPending === "family"}
            disabled={markPending !== null && markPending !== "family"}
            onChange={(next) => toggleMark("family", next)}
          />
        ) : null}

        <MarkRow
          label="Esta linha não deveria existir"
          hint="Entrou duas vezes, por duas fontes. Sai de toda soma e continua no extrato com selo."
          value={transaction.ignored}
          busy={markPending === "ignored"}
          disabled={markPending !== null && markPending !== "ignored"}
          onChange={(next) => toggleMark("ignored", next)}
        />

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
      <CategoryPickerSheet
        visible={pickerAberto}
        onClose={() => setPickerAberto(false)}
        selectedId={transaction.categoryId ?? undefined}
        onSelect={(escolhida) => {
          setPickerAberto(false);
          if (escolhida.id !== transaction.categoryId) void trocarCategoria(escolhida.id);
        }}
      />
    </CustomModal>
  );
}

/**
 * Um interruptor de marca. Fica local ao arquivo porque a frase de apoio é o
 * que dá sentido ao controle — as três marcas se parecem e significam coisas
 * diferentes, e um interruptor só com rótulo curto se confundiria.
 */
function MarkRow({
  label,
  hint,
  value,
  busy,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  busy: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        paddingVertical: spacing[2],
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View style={{ flex: 1, marginRight: spacing[3] }}>
        <Text style={{ color: t.text.primary, fontSize: 13, fontWeight: "700" }}>
          {label}
        </Text>
        <Text
          style={{
            color: t.text.tertiary,
            fontSize: 11,
            lineHeight: 15,
            marginTop: 2,
          }}
        >
          {hint}
        </Text>
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={t.accent.neon} />
      ) : (
        <Switch
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          accessibilityLabel={label}
          trackColor={{ false: t.border.subtle, true: t.accent.neonMuted }}
          thumbColor={value ? t.accent.neon : t.text.tertiary}
        />
      )}
    </View>
  );
}
