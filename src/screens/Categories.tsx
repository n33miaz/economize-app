import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  LayoutAnimation,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  ArchiveRestore,
  ChevronDown,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "../utils/haptics";
import Animated from "react-native-reanimated";

import type { Category, CategoryFlow } from "../services/api";
import { useCategoriesStore } from "../store/categoriesStore";
import { askConfirm } from "../store/confirmStore";
import { useToastStore } from "../store/toastStore";
import type { AppTheme } from "../theme/colors";
import { radius, spacing } from "../theme/ds";
import { useTheme } from "../theme/ThemeProvider";
import { useMotionPresets, usePressScale } from "../theme/motionPresets";
import CategoryForm from "../components/CategoryForm";
import CategoryIcon from "../components/CategoryIcon";
import { buildCategoryTree, groupRootsByGroupName } from "../utils/categoryTree";
import CustomModal from "../components/CustomModal";
import PageContainer from "../components/PageContainer";
import ScreenHeader from "../components/ScreenHeader";
import Skeleton from "../components/Skeleton";

const FLOW_LABELS: Record<CategoryFlow, string> = {
  EXPENSE: "Gasto",
  INCOME: "Receita",
  BOTH: "Gasto e receita",
};

// Lista achatada (seções + itens) num FlatList único: mantém o stagger da
// entrada contínuo entre as seções, coisa que o SectionList quebraria
type Row =
  | { kind: "header"; key: string; title: string }
  | {
      kind: "category";
      key: string;
      category: Category;
      archived: boolean;
      // subcategoria entra recuada e sem a contagem
      child: boolean;
      childCount: number;
      expanded: boolean;
    };

interface CategoryRowProps {
  category: Category;
  index: number;
  archived: boolean;
  child?: boolean;
  childCount?: number;
  expanded?: boolean;
  onToggle?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRestore: () => void;
}

function CategoryRow({
  category,
  index,
  archived,
  child = false,
  childCount = 0,
  expanded = false,
  onToggle,
  onEdit,
  onDelete,
  onRestore,
}: CategoryRowProps) {
  const t = useTheme();
  const { listItemEntering } = useMotionPresets();
  const restorePress = usePressScale();

  return (
    <Animated.View
      entering={listItemEntering(index)}
      style={{
        marginLeft: child ? spacing[6] : 0,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: t.background.surface,
        borderWidth: 1,
        borderColor: t.border.subtle,
        borderRadius: radius.xl,
        paddingVertical: spacing[2],
        paddingHorizontal: spacing[3],
        marginBottom: spacing[2],
      }}
    >
      {/* Esmaece só o conteúdo: a ação "Reativar" continua legível */}
      <TouchableOpacity
        disabled={childCount === 0}
        onPress={onToggle}
        accessibilityLabel={
          childCount > 0
            ? `${category.name}, ${childCount} subcategorias. Toque para ${expanded ? "recolher" : "expandir"}`
            : category.name
        }
        accessibilityRole={childCount > 0 ? "button" : "text"}
        accessibilityState={childCount > 0 ? { expanded } : undefined}
        activeOpacity={0.7}
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          opacity: archived ? 0.55 : 1,
        }}
      >
        {/* AppTheme tipa hexas literais do dark; temas são estruturalmente
            idênticos, então o cast da união é seguro */}
        <CategoryIcon
          category={category}
          theme={t as AppTheme}
          size={child ? 30 : 36}
        />
        <View
          style={{ flex: 1, marginLeft: spacing[3], marginRight: spacing[2] }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text
              numberOfLines={1}
              style={{
                color: t.text.primary,
                fontSize: 14,
                fontWeight: "700",
                flexShrink: 1,
              }}
            >
              {category.name}
            </Text>
            {category.system && (
              <View
                style={{
                  marginLeft: spacing[2],
                  paddingHorizontal: spacing[2],
                  paddingVertical: 2,
                  borderRadius: radius.full,
                  backgroundColor: t.background.elevated,
                  borderWidth: 1,
                  borderColor: t.border.subtle,
                }}
              >
                <Text
                  style={{
                    color: t.text.tertiary,
                    fontSize: 10,
                    fontWeight: "700",
                  }}
                >
                  padrão
                </Text>
              </View>
            )}
          </View>
          <Text style={{ color: t.text.tertiary, fontSize: 11, marginTop: 2 }}>
            {childCount > 0
              ? `${FLOW_LABELS[category.flow]} · ${childCount} ${childCount === 1 ? "subcategoria" : "subcategorias"}`
              : FLOW_LABELS[category.flow]}
          </Text>
        </View>
        {childCount > 0 && (
          <ChevronDown
            size={18}
            color={t.text.tertiary}
            style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
          />
        )}
      </TouchableOpacity>

      {archived ? (
        <Animated.View style={restorePress.pressStyle}>
          <TouchableOpacity
            onPress={onRestore}
            onPressIn={restorePress.onPressIn}
            onPressOut={restorePress.onPressOut}
            accessibilityLabel={`Reativar categoria ${category.name}`}
            accessibilityRole="button"
            activeOpacity={0.8}
            style={{
              flexDirection: "row",
              alignItems: "center",
              minHeight: 44,
              paddingHorizontal: spacing[3],
              borderRadius: radius.full,
              backgroundColor: t.accent.neonMuted,
            }}
          >
            <ArchiveRestore size={16} color={t.accent.neon} />
            <Text
              style={{
                color: t.accent.neon,
                fontSize: 12,
                fontWeight: "700",
                marginLeft: spacing[1],
              }}
            >
              Reativar
            </Text>
          </TouchableOpacity>
        </Animated.View>
      ) : category.system ? null : (
        <View style={{ flexDirection: "row" }}>
          <TouchableOpacity
            onPress={onEdit}
            accessibilityLabel={`Editar categoria ${category.name}`}
            accessibilityRole="button"
            activeOpacity={0.7}
            style={{
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Pencil size={18} color={t.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDelete}
            accessibilityLabel={`Excluir categoria ${category.name}`}
            accessibilityRole="button"
            activeOpacity={0.7}
            style={{
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Trash2 size={18} color={t.semantic.danger} />
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

export default function Categories() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const addPress = usePressScale();
  const { items, isLoading, fetch, remove, update } = useCategoriesStore();
  const { showToast } = useToastStore();

  // "new" abre o formulário vazio; uma Category abre em modo edição
  const [formTarget, setFormTarget] = useState<Category | "new" | null>(null);
  // acordeão: com 14 raízes e ~57 subcategorias, abrir tudo viraria um paredão
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch();
  }, [fetch]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const roots = buildCategoryTree(items);
    for (const section of groupRootsByGroupName(roots)) {
      out.push({ kind: "header", key: `h-${section.title}`, title: section.title });
      for (const root of section.data) {
        const isOpen = expanded.has(root.id);
        out.push({
          kind: "category",
          key: root.id,
          category: root,
          archived: false,
          child: false,
          childCount: root.children.length,
          expanded: isOpen,
        });
        if (!isOpen) continue;
        for (const sub of root.children) {
          out.push({
            kind: "category",
            key: sub.id,
            category: sub,
            archived: false,
            child: true,
            childCount: 0,
            expanded: false,
          });
        }
      }
    }
    const archived = items.filter((c) => c.archived);
    if (archived.length > 0) {
      out.push({ kind: "header", key: "h-arquivadas", title: "Arquivadas" });
      for (const category of archived) {
        out.push({
          kind: "category",
          key: category.id,
          category,
          archived: true,
          child: Boolean(category.parentId),
          childCount: 0,
          expanded: false,
        });
      }
    }
    return out;
  }, [items, expanded]);

  const toggleExpanded = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = (category: Category) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const childCount = items.filter((c) => c.parentId === category.id).length;
    askConfirm({
      title: "Excluir categoria",
      message:
        childCount > 0
          ? `Remover "${category.name}" leva junto ${childCount === 1 ? "a subcategoria dela" : `as ${childCount} subcategorias dela`}. Se houver transações no histórico, tudo é arquivado em vez de excluído.`
          : `Remover "${category.name}"? Se houver transações no histórico, ela será arquivada em vez de excluída.`,
      confirmLabel: "Excluir",
      destructive: true,
      onConfirm: async () => {
        const result = await remove(category.id);
        if (result === "deleted") {
          showToast("Categoria excluída.", "success");
        } else if (result === "archived") {
          showToast("Categoria arquivada — há transações no histórico.", "info");
        } else {
          showToast(
            useCategoriesStore.getState().error ||
              "Falha ao remover categoria.",
            "error",
          );
        }
      },
    });
  };

  const handleRestore = async (category: Category) => {
    const updated = await update(category.id, { archived: false });
    if (updated) {
      showToast("Categoria reativada.", "success");
    } else {
      showToast(
        useCategoriesStore.getState().error || "Falha ao reativar categoria.",
        "error",
      );
    }
  };

  const renderRow = ({ item, index }: { item: Row; index: number }) => {
    if (item.kind === "header") {
      return (
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
          {item.title}
        </Text>
      );
    }
    return (
      <CategoryRow
        category={item.category}
        index={index}
        archived={item.archived}
        child={item.child}
        childCount={item.childCount}
        expanded={item.expanded}
        onToggle={() => toggleExpanded(item.category.id)}
        onEdit={() => setFormTarget(item.category)}
        onDelete={() => handleDelete(item.category)}
        onRestore={() => handleRestore(item.category)}
      />
    );
  };

  return (
    <PageContainer>
      <ScreenHeader
        title="Categorias"
        subtitle="Organize seus gastos do seu jeito"
        showProfileButton={false}
        rightActions={[
          // ScreenHeader é dark fixo — as actions seguem os tokens estáticos dele
          <Animated.View key="add" style={addPress.pressStyle}>
            <TouchableOpacity
              onPress={() => setFormTarget("new")}
              onPressIn={addPress.onPressIn}
              onPressOut={addPress.onPressOut}
              accessibilityLabel="Nova categoria"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.85}
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.full,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: t.accent.neon,
              }}
            >
              <Plus size={18} color={t.text.inverse} />
            </TouchableOpacity>
          </Animated.View>,
        ]}
      />

      <FlatList
        data={isLoading && items.length === 0 ? [] : rows}
        keyExtractor={(row) => row.key}
        renderItem={renderRow}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing[5],
          paddingTop: spacing[2],
          paddingBottom: insets.bottom + spacing[10],
        }}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingTop: spacing[4] }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <View key={i} style={{ marginBottom: spacing[2] }}>
                  <Skeleton height={56} borderRadius={radius.xl} />
                </View>
              ))}
            </View>
          ) : null
        }
      />

      <CustomModal visible={formTarget !== null} onClose={() => setFormTarget(null)}>
        <View
          style={{
            paddingHorizontal: spacing[5],
            paddingTop: spacing[3],
            paddingBottom: spacing[6],
          }}
        >
          <Text
            style={{
              color: t.text.primary,
              fontSize: 20,
              fontWeight: "700",
              marginBottom: spacing[4],
            }}
          >
            {formTarget === "new" ? "Nova categoria" : "Editar categoria"}
          </Text>
          {formTarget !== null && (
            <CategoryForm
              // key força o formulário a renascer com os valores do alvo atual
              key={formTarget === "new" ? "new" : formTarget.id}
              initial={formTarget === "new" ? null : formTarget}
              onSaved={() => setFormTarget(null)}
              onCancel={() => setFormTarget(null)}
            />
          )}
        </View>
      </CustomModal>
    </PageContainer>
  );
}
