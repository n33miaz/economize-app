import React, { useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import ChevronDown from "lucide-react-native/dist/esm/icons/chevron-down";
import Copy from "lucide-react-native/dist/esm/icons/copy";
import House from "lucide-react-native/dist/esm/icons/house";
import HousePlus from "lucide-react-native/dist/esm/icons/house-plus";
import KeyRound from "lucide-react-native/dist/esm/icons/key-round";
import LogOut from "lucide-react-native/dist/esm/icons/log-out";
import Pencil from "lucide-react-native/dist/esm/icons/pencil";
import Trash2 from "lucide-react-native/dist/esm/icons/trash-2";
import UserPlus from "lucide-react-native/dist/esm/icons/user-plus";

import type { AppTheme } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { useFamilyStore } from "../store/familyStore";
import { useCategoriesStore } from "../store/categoriesStore";
import { useAccountsStore } from "../store/accountsStore";
import { askConfirm } from "../store/confirmStore";
import { useToastStore } from "../store/toastStore";
import * as Haptics from "../utils/haptics";
import { accountDisplayName, accountKindLabel } from "../utils/accounts";
import {
  INVITE_CODE_LENGTH,
  describeShareScope,
  familyRoleLabel,
  formatInviteCode,
  inviteValidityLabel,
  normalizeInviteCode,
  shareScopeLabel,
  shareScopeSummary,
} from "../utils/family";
import type {
  Category,
  FamilyMember,
  FamilyShareScope,
  FamilySharing,
} from "../services/api";

import ScreenHeader from "../components/ScreenHeader";
import PageContainer from "../components/PageContainer";
import SectionTitle from "../components/SectionTitle";
import SegmentedControl from "../components/SegmentedControl";
import CustomModal from "../components/CustomModal";
import FloatingLabelInput from "../components/FloatingLabelInput";
import Skeleton from "../components/Skeleton";
import ErrorState from "../components/ErrorState";
import ActionRow from "../components/ActionRow";
import MemberAvatar from "../components/MemberAvatar";
import CategoryIcon from "../components/CategoryIcon";

// O CustomModal entrega só a folha; o respiro lateral é de quem usa, como em
// Desejos e Renda. Sem ele o conteúdo cola nas duas bordas.
const SHEET_PADDING = {
  paddingHorizontal: spacing[5],
  paddingTop: spacing[3],
  paddingBottom: spacing[6],
} as const;

const SCOPE_OPTIONS: { label: string; value: FamilyShareScope }[] = [
  { label: shareScopeLabel("NONE"), value: "NONE" },
  { label: shareScopeLabel("TOTALS"), value: "TOTALS" },
  { label: shareScopeLabel("TRANSACTIONS"), value: "TRANSACTIONS" },
];

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

/**
 * Copiar sem biblioteca: o app não tem `expo-clipboard`, e trazer uma para
 * oito letras não se justifica. Na web o navegador oferece a área de
 * transferência; no aparelho o código fica selecionável e o texto diz como
 * copiar — a pessoa vai colar no WhatsApp, que é o caminho real do convite.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  const clipboard = (globalThis as { navigator?: Navigator }).navigator
    ?.clipboard;
  if (!clipboard?.writeText) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Uma linha de "quem mora aqui": disco, nome, papel e o que mostra. */
function MemberRow({
  member,
  canRemove,
  onRemove,
}: {
  member: FamilyMember;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const t = useTheme();
  const summary = `${familyRoleLabel(member.role)} · ${shareScopeSummary(member.shareScope)}`;
  return (
    <View
      className="flex-row items-center py-3"
      accessible
      accessibilityLabel={`${member.name}${member.isMe ? ", você" : ""}. ${summary}`}
    >
      <MemberAvatar memberId={member.id} name={member.name} size={40} />
      <View className="flex-1 ml-3">
        <Text className="text-sm font-bold text-textPrimary" numberOfLines={1}>
          {member.name}
          {member.isMe ? (
            <Text className="text-textTertiary font-medium"> · você</Text>
          ) : null}
        </Text>
        <Text className="text-xs text-textSecondary mt-0.5" numberOfLines={1}>
          {summary}
        </Text>
      </View>
      {canRemove && (
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`Remover ${member.name}`}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Trash2 size={16} color={t.semantic.danger} />
        </Pressable>
      )}
    </View>
  );
}

/** Switch no padrão das telas de conta, com o rótulo à esquerda. */
function ToggleRow({
  label,
  description,
  value,
  onChange,
  disabled,
  left,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  left?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View
      className="flex-row items-center py-2.5"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      {left}
      <View className="flex-1 mr-3">
        <Text className="text-sm text-textPrimary" numberOfLines={1}>
          {label}
        </Text>
        {description ? (
          <Text className="text-xs text-textSecondary mt-0.5" numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ false: t.border.default, true: t.accent.neon }}
        thumbColor={t.background.base}
      />
    </View>
  );
}

/**
 * A casa (EC-150): quem mora comigo e o que cada um mostra.
 *
 * <p>Três estados numa tela só. Sem casa, dois convites: criar ou entrar com
 * um código. Com casa, o nome, as pessoas, o convite (para o dono) e — a
 * parte que importa — "o que EU compartilho", porque o diferencial do produto
 * é ver junto SEM confundir os extratos: cada um decide o que os outros veem.
 */
export default function Family() {
  const t = useTheme();
  const showToast = useToastStore((s) => s.showToast);
  const {
    family,
    hasLoadedOnce,
    isLoading,
    isSaving,
    error,
    lastInvite,
    fetchFamily,
    create,
    rename,
    destroy,
    emitInvite,
    join,
    removeMember,
    leave,
    saveSharing,
  } = useFamilyStore();
  const categories = useCategoriesStore((s) => s.items);
  const fetchCategories = useCategoriesStore((s) => s.fetch);
  const accounts = useAccountsStore((s) => s.accounts);
  const fetchAccounts = useAccountsStore((s) => s.fetchAccounts);

  const [houseName, setHouseName] = useState("");
  const [code, setCode] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  // Rascunho do compartilhamento: nasce do servidor e só volta para ele no
  // "Salvar" — cada switch salvando sozinho faria seis idas para uma decisão
  const [draftScope, setDraftScope] = useState<FamilyShareScope>("TOTALS");
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  // `null` = todas as contas (o "vazio" do contrato); um Set = só estas
  const [sharedAccounts, setSharedAccounts] = useState<Set<string> | null>(null);
  const [includeUnassigned, setIncludeUnassigned] = useState(true);

  useEffect(() => {
    // Sempre, e não só na primeira vez: outra pessoa pode ter entrado pelo
    // código desde a última visita, e esta tela é onde se confere isso
    fetchFamily();
    fetchCategories();
    fetchAccounts();
  }, [fetchFamily, fetchCategories, fetchAccounts]);

  const mySharing = family?.mySharing;
  useEffect(() => {
    if (!mySharing) return;
    setDraftScope(mySharing.shareScope);
    setHidden(new Set(mySharing.hiddenCategoryIds));
    setSharedAccounts(
      mySharing.sharedAccountIds.length > 0
        ? new Set(mySharing.sharedAccountIds)
        : null,
    );
    setIncludeUnassigned(mySharing.includeUnassigned);
  }, [mySharing]);

  const isOwner = family?.role === "OWNER";

  // Raízes primeiro, filhas logo abaixo da mãe: é a ordem em que a pessoa
  // procura "Saúde › Terapia" para escondê-la
  const visibleCategories = useMemo(() => {
    const active = categories.filter((c) => !c.archived);
    const roots = active
      .filter((c) => !c.parentId)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    const ordered: Category[] = [];
    for (const root of roots) {
      ordered.push(root);
      active
        .filter((c) => c.parentId === root.id)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
        .forEach((child) => ordered.push(child));
    }
    return ordered;
  }, [categories]);

  const draft: FamilySharing = useMemo(
    () => ({
      shareScope: draftScope,
      hiddenCategoryIds: [...hidden].sort(),
      sharedAccountIds: sharedAccounts ? [...sharedAccounts].sort() : [],
      includeUnassigned,
    }),
    [draftScope, hidden, sharedAccounts, includeUnassigned],
  );

  const isDirty = useMemo(() => {
    if (!mySharing) return false;
    return (
      draft.shareScope !== mySharing.shareScope ||
      draft.includeUnassigned !== mySharing.includeUnassigned ||
      draft.hiddenCategoryIds.join(",") !==
        [...mySharing.hiddenCategoryIds].sort().join(",") ||
      draft.sharedAccountIds.join(",") !==
        [...mySharing.sharedAccountIds].sort().join(",")
    );
  }, [draft, mySharing]);

  const detailsEnabled = draftScope !== "NONE";

  const toggleHidden = (id: string, hide: boolean) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (hide) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAccount = (id: string, share: boolean) => {
    setSharedAccounts((prev) => {
      const next = new Set(prev ?? accounts.map((a) => a.id));
      if (share) next.add(id);
      else next.delete(id);
      // Todas marcadas volta a ser "todas" (vazio no contrato): assim uma
      // conta sincronizada amanhã entra sozinha, como a pessoa esperaria
      const all = accounts.every((a) => next.has(a.id));
      return all ? null : next;
    });
  };

  const handleCreate = async () => {
    const result = await create(houseName.trim() || undefined);
    showToast(result.message, result.ok ? "success" : "error");
    if (result.ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleJoin = async () => {
    if (code.length !== INVITE_CODE_LENGTH) {
      showToast(`O código tem ${INVITE_CODE_LENGTH} caracteres.`, "warning");
      return;
    }
    const result = await join(code);
    showToast(result.message, result.ok ? "success" : "error");
    if (result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCode("");
    }
  };

  const handleInvite = async () => {
    const result = await emitInvite();
    showToast(result.message, result.ok ? "success" : "error");
  };

  const handleCopy = async () => {
    if (!lastInvite) return;
    const copied = await copyToClipboard(lastInvite.code);
    showToast(
      copied
        ? "Código copiado."
        : "Toque e segure no código para copiar.",
      copied ? "success" : "info",
    );
  };

  const openRename = () => {
    setDraftName(family?.name ?? "");
    setRenameOpen(true);
  };

  const handleRename = async () => {
    const name = draftName.trim();
    if (!name) {
      showToast("A casa precisa de um nome.", "warning");
      return;
    }
    const result = await rename(name);
    showToast(result.message, result.ok ? "success" : "error");
    if (result.ok) setRenameOpen(false);
  };

  const handleSaveSharing = async () => {
    if (sharedAccounts && sharedAccounts.size === 0 && detailsEnabled) {
      showToast(
        "Para não mostrar conta nenhuma, escolha “Nada” no que você compartilha.",
        "warning",
      );
      return;
    }
    const result = await saveSharing(draft);
    showToast(result.message, result.ok ? "success" : "error");
  };

  const confirmRemove = (member: FamilyMember) => {
    askConfirm({
      title: `Remover ${member.name}?`,
      message: `${member.name} deixa de ver a casa, e a casa deixa de ver o que ${member.name} mostrava. As escolhas de compartilhamento dessa pessoa são apagadas.`,
      confirmLabel: "Remover",
      cancelLabel: "Manter",
      destructive: true,
      onConfirm: async () => {
        const result = await removeMember(member.id);
        showToast(result.message, result.ok ? "success" : "error");
      },
    });
  };

  const confirmLeave = () => {
    askConfirm({
      title: "Sair da casa?",
      message:
        "Você deixa de ver a casa e a casa deixa de ver você. Suas escolhas de compartilhamento são apagadas — nada fica lembrado para uma casa futura.",
      confirmLabel: "Sair",
      cancelLabel: "Ficar",
      destructive: true,
      onConfirm: async () => {
        const result = await leave();
        showToast(result.message, result.ok ? "success" : "error");
      },
    });
  };

  const confirmDestroy = () => {
    const others = (family?.members.length ?? 1) - 1;
    askConfirm({
      title: "Apagar a casa?",
      message:
        others > 0
          ? `A casa acaba para todo mundo: ${others} ${plural(others, "pessoa perde", "pessoas perdem")} a visão compartilhada agora, e todos os convites e escolhas são apagados. Não dá para desfazer.`
          : "A casa é apagada com os convites e as suas escolhas. Não dá para desfazer.",
      confirmLabel: "Apagar a casa",
      cancelLabel: "Manter",
      destructive: true,
      onConfirm: async () => {
        const result = await destroy();
        showToast(result.message, result.ok ? "success" : "error");
      },
    });
  };

  if (error && !hasLoadedOnce) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Família" showProfileButton={false} />
        <ErrorState message={error} onRetry={fetchFamily} />
      </View>
    );
  }

  const hiddenCount = hidden.size;
  const hiddenNames = visibleCategories
    .filter((c) => hidden.has(c.id))
    .map((c) => c.name);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Família"
        subtitle="Quem mora com você e o que cada um compartilha"
        showProfileButton={false}
      />
      <PageContainer>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing[5],
            paddingTop: spacing[4],
            paddingBottom: spacing[10],
          }}
        >
          {isLoading && !hasLoadedOnce ? (
            <>
              <Skeleton height={120} borderRadius={radius["2xl"]} className="mb-3" />
              <Skeleton height={180} borderRadius={radius["2xl"]} />
            </>
          ) : !family ? (
            <>
              {/* ------------------------------------------------ sem casa */}
              <Text className="text-sm text-textSecondary leading-5 mb-4">
                Duas contas, dois extratos — e uma visão em conjunto, com cada
                um escolhendo o que mostra. Comece criando a casa ou entre na
                de quem já criou.
              </Text>

              <View className="bg-cardBackground rounded-2xl p-4 border border-border">
                <View className="flex-row items-center">
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center"
                    style={{ backgroundColor: t.accent.neonMuted }}
                  >
                    <HousePlus size={20} color={t.accent.neon} />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-sm font-bold text-textPrimary">
                      Criar a casa
                    </Text>
                    <Text className="text-xs text-textSecondary mt-0.5">
                      Você vira o dono e convida quem mora com você por um
                      código.
                    </Text>
                  </View>
                </View>
                <View className="mt-4 mb-3">
                  <FloatingLabelInput
                    label="Nome da casa (opcional)"
                    value={houseName}
                    onChangeText={setHouseName}
                    maxLength={60}
                  />
                </View>
                <Pressable
                  onPress={handleCreate}
                  disabled={isSaving}
                  accessibilityRole="button"
                  accessibilityLabel="Criar a casa"
                  className="h-12 rounded-xl items-center justify-center"
                  style={{ backgroundColor: t.accent.neon, opacity: isSaving ? 0.6 : 1 }}
                >
                  <Text className="font-bold text-sm" style={{ color: t.text.inverse }}>
                    Criar a casa
                  </Text>
                </Pressable>
              </View>

              <View className="bg-cardBackground rounded-2xl p-4 border border-border mt-3">
                <View className="flex-row items-center">
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center"
                    style={{ backgroundColor: t.accent.neonMuted }}
                  >
                    <KeyRound size={20} color={t.accent.neon} />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-sm font-bold text-textPrimary">
                      Tenho um código
                    </Text>
                    <Text className="text-xs text-textSecondary mt-0.5">
                      Quem criou a casa te mandou 8 letras. Elas valem por 7
                      dias e servem uma vez.
                    </Text>
                  </View>
                </View>
                <View className="mt-4 mb-3">
                  <FloatingLabelInput
                    label="Código do convite"
                    value={formatInviteCode(code)}
                    onChangeText={(raw) => setCode(normalizeInviteCode(raw))}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={INVITE_CODE_LENGTH + 1}
                    style={{ letterSpacing: 2, fontVariant: ["tabular-nums"] }}
                  />
                </View>
                <Pressable
                  onPress={handleJoin}
                  disabled={isSaving}
                  accessibilityRole="button"
                  accessibilityLabel="Entrar na casa"
                  className="h-12 rounded-xl items-center justify-center border"
                  style={{
                    backgroundColor: t.accent.neonMuted,
                    borderColor: t.accent.neon,
                    opacity: isSaving ? 0.6 : 1,
                  }}
                >
                  <Text className="font-bold text-sm" style={{ color: t.accent.neon }}>
                    Entrar na casa
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              {/* ------------------------------------------------ a casa */}
              <View className="bg-cardBackground rounded-2xl p-4 border border-border flex-row items-center">
                <View
                  className="w-12 h-12 rounded-2xl items-center justify-center"
                  style={{ backgroundColor: t.accent.neonMuted }}
                >
                  <House size={22} color={t.accent.neon} />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-lg font-bold text-textPrimary" numberOfLines={1}>
                    {family.name}
                  </Text>
                  <Text className="text-xs text-textSecondary mt-0.5">
                    {family.members.length}{" "}
                    {plural(family.members.length, "pessoa", "pessoas")} ·{" "}
                    {isOwner ? "você é o dono" : "você é membro"}
                  </Text>
                </View>
                {isOwner && (
                  <Pressable
                    onPress={openRename}
                    accessibilityRole="button"
                    accessibilityLabel="Renomear a casa"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Pencil size={18} color={t.text.tertiary} />
                  </Pressable>
                )}
              </View>

              {/* --------------------------------------------- membros */}
              <SectionTitle>Quem mora aqui</SectionTitle>
              <View
                className="bg-cardBackground rounded-2xl border border-border"
                style={{ paddingHorizontal: spacing[4] }}
              >
                {family.members.map((member, index) => (
                  <View key={member.id}>
                    {index > 0 && (
                      <View style={{ height: 1, backgroundColor: t.border.subtle }} />
                    )}
                    <MemberRow
                      member={member}
                      canRemove={isOwner && !member.isMe}
                      onRemove={() => confirmRemove(member)}
                    />
                  </View>
                ))}
              </View>

              {/* --------------------------------------------- convite */}
              {isOwner && (
                <>
                  <SectionTitle>Convidar</SectionTitle>
                  {lastInvite ? (
                    <View className="bg-cardBackground rounded-2xl p-4 border border-border items-center">
                      <Text className="text-xs text-textSecondary">
                        Mande este código para quem mora com você
                      </Text>
                      <Text
                        selectable
                        accessibilityLabel={`Código do convite: ${lastInvite.code.split("").join(" ")}`}
                        className="font-bold text-textPrimary mt-2"
                        style={{
                          fontSize: 34,
                          letterSpacing: 4,
                          fontVariant: ["tabular-nums"],
                        }}
                      >
                        {formatInviteCode(lastInvite.code)}
                      </Text>
                      <Text className="text-xs text-textTertiary mt-1">
                        {inviteValidityLabel(lastInvite.expiresAt)} · serve uma vez
                      </Text>
                      <View className="flex-row mt-4" style={{ gap: spacing[2] }}>
                        <Pressable
                          onPress={handleCopy}
                          accessibilityRole="button"
                          accessibilityLabel="Copiar código"
                          className="flex-row items-center h-10 px-4 rounded-xl"
                          style={{ backgroundColor: t.accent.neon }}
                        >
                          <Copy size={16} color={t.text.inverse} />
                          <Text className="font-bold text-xs ml-2" style={{ color: t.text.inverse }}>
                            Copiar
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={handleInvite}
                          disabled={isSaving}
                          accessibilityRole="button"
                          accessibilityLabel="Gerar outro código"
                          className="h-10 px-4 rounded-xl items-center justify-center border border-border"
                          style={{ opacity: isSaving ? 0.6 : 1 }}
                        >
                          <Text className="font-bold text-xs text-textPrimary">
                            Gerar outro
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View className="bg-cardBackground rounded-2xl p-4 border border-border">
                      <Text className="text-xs text-textSecondary leading-4">
                        {family.invite
                          ? `Há um convite ativo (${inviteValidityLabel(family.invite.expiresAt).toLowerCase()}). Se o código se perdeu, gere outro — o anterior deixa de valer.`
                          : "Gere um código de 8 letras e mande pelo WhatsApp. Ele vale por 7 dias e serve uma vez."}
                      </Text>
                      <Pressable
                        onPress={handleInvite}
                        disabled={isSaving}
                        accessibilityRole="button"
                        accessibilityLabel="Convidar alguém"
                        className="flex-row items-center justify-center h-12 rounded-xl mt-3"
                        style={{ backgroundColor: t.accent.neon, opacity: isSaving ? 0.6 : 1 }}
                      >
                        <UserPlus size={18} color={t.text.inverse} />
                        <Text className="font-bold text-sm ml-2" style={{ color: t.text.inverse }}>
                          {family.invite ? "Gerar novo código" : "Convidar alguém"}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </>
              )}

              {/* -------------------------------- o que eu compartilho */}
              <SectionTitle>O que eu compartilho</SectionTitle>
              <View className="bg-cardBackground rounded-2xl p-4 border border-border">
                <SegmentedControl<FamilyShareScope>
                  size="md"
                  value={draftScope}
                  onChange={setDraftScope}
                  options={SCOPE_OPTIONS}
                />
                <Text className="text-xs text-textSecondary leading-4 mt-3">
                  {describeShareScope(draftScope)}
                </Text>

                {/* Categorias: fechadas por padrão porque são dezenas — o
                    resumo diz o que está oculto sem abrir a lista */}
                <View
                  style={{
                    height: 1,
                    backgroundColor: t.border.subtle,
                    marginVertical: spacing[3],
                  }}
                />
                <Pressable
                  onPress={() => setCategoriesOpen((v) => !v)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: categoriesOpen }}
                  accessibilityLabel={`Categorias ocultas da casa: ${hiddenCount}. Toque para ${categoriesOpen ? "fechar" : "abrir"} a lista`}
                  className="flex-row items-center py-1"
                  style={{ opacity: detailsEnabled ? 1 : 0.5 }}
                >
                  <View className="flex-1 mr-3">
                    <Text className="text-sm font-bold text-textPrimary">
                      Categorias ocultas
                    </Text>
                    <Text className="text-xs text-textSecondary mt-0.5" numberOfLines={2}>
                      {hiddenCount === 0
                        ? "Nenhuma — a casa vê todas as suas categorias"
                        : `${hiddenCount} ${plural(hiddenCount, "oculta", "ocultas")}: ${hiddenNames.join(", ")}`}
                    </Text>
                  </View>
                  <ChevronDown
                    size={18}
                    color={t.text.tertiary}
                    style={{ transform: [{ rotate: categoriesOpen ? "180deg" : "0deg" }] }}
                  />
                </Pressable>
                {categoriesOpen && (
                  <View className="mt-1">
                    <Text className="text-[11px] text-textTertiary leading-4 mb-1">
                      Categoria oculta sai das linhas E das somas — e o seu total
                      na casa é recalculado sem ela, para ninguém deduzir o
                      valor pela diferença.
                    </Text>
                    {visibleCategories.length === 0 ? (
                      <Text className="text-xs text-textSecondary py-2">
                        Suas categorias ainda não carregaram.
                      </Text>
                    ) : (
                      visibleCategories.map((category) => (
                        <ToggleRow
                          key={category.id}
                          label={
                            category.parentId && category.parentName
                              ? `${category.parentName} › ${category.name}`
                              : category.name
                          }
                          value={hidden.has(category.id)}
                          onChange={(hide) => toggleHidden(category.id, hide)}
                          disabled={!detailsEnabled}
                          left={
                            <View style={{ marginRight: spacing[3] }}>
                              <CategoryIcon
                                category={category}
                                theme={t as AppTheme}
                                size={28}
                              />
                            </View>
                          }
                        />
                      ))
                    )}
                  </View>
                )}

                {/* Contas: só quando existem — hoje só o conector popula
                    conta, e para quem importa por arquivo a lista seria vazia */}
                {accounts.length > 0 && (
                  <>
                    <View
                      style={{
                        height: 1,
                        backgroundColor: t.border.subtle,
                        marginVertical: spacing[3],
                      }}
                    />
                    <Text className="text-sm font-bold text-textPrimary mb-1">
                      Contas compartilhadas
                    </Text>
                    {accounts.map((account) => (
                      <ToggleRow
                        key={account.id}
                        label={accountDisplayName(account)}
                        description={accountKindLabel(account.type)}
                        value={sharedAccounts === null || sharedAccounts.has(account.id)}
                        onChange={(share) => toggleAccount(account.id, share)}
                        disabled={!detailsEnabled}
                      />
                    ))}
                  </>
                )}

                <View
                  style={{
                    height: 1,
                    backgroundColor: t.border.subtle,
                    marginVertical: spacing[3],
                  }}
                />
                <ToggleRow
                  label="Incluir extrato importado"
                  description={
                    accounts.length > 0
                      ? "Lançamentos vindos de arquivo (OFX/CSV) não têm conta de origem. Com isto desligado, eles ficam fora da casa."
                      : "Lançamentos vindos de arquivo (OFX/CSV). Hoje todo o seu extrato é assim — desligar esconde tudo."
                  }
                  value={includeUnassigned}
                  onChange={setIncludeUnassigned}
                  disabled={!detailsEnabled}
                />

                <Pressable
                  onPress={handleSaveSharing}
                  disabled={isSaving || !isDirty}
                  accessibilityRole="button"
                  accessibilityLabel="Salvar o que eu compartilho"
                  accessibilityState={{ disabled: isSaving || !isDirty }}
                  className="h-12 rounded-xl items-center justify-center mt-3"
                  style={{
                    backgroundColor: t.accent.neon,
                    opacity: isSaving || !isDirty ? 0.5 : 1,
                  }}
                >
                  <Text className="font-bold text-sm" style={{ color: t.text.inverse }}>
                    {isDirty ? "Salvar o que eu compartilho" : "Tudo salvo"}
                  </Text>
                </Pressable>
              </View>

              {/* ----------------------------------------------- sair */}
              <View style={{ marginTop: spacing[6] }}>
                {isOwner ? (
                  <ActionRow
                    Icon={Trash2}
                    label="Apagar a casa"
                    description="Acaba para todo mundo, não só para você"
                    destructive
                    onPress={confirmDestroy}
                  />
                ) : (
                  <ActionRow
                    Icon={LogOut}
                    label="Sair da casa"
                    description="Você deixa de ver e de ser visto"
                    destructive
                    onPress={confirmLeave}
                  />
                )}
              </View>
            </>
          )}
        </ScrollView>
      </PageContainer>

      {/* ------------------------------------------------------ renomear */}
      <CustomModal visible={renameOpen} onClose={() => setRenameOpen(false)}>
        <View style={SHEET_PADDING}>
          <Text className="text-xl font-bold text-textPrimary mb-1">
            Nome da casa
          </Text>
          <Text className="text-xs text-textSecondary mb-5">
            É como ela aparece para todo mundo que mora aqui.
          </Text>
          <View className="mb-5">
            <FloatingLabelInput
              label="Nome"
              value={draftName}
              onChangeText={setDraftName}
              maxLength={60}
              autoFocus
            />
          </View>
          <Pressable
            onPress={handleRename}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel="Salvar nome da casa"
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
