import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Check from "lucide-react-native/dist/esm/icons/check";
import ChevronLeft from "lucide-react-native/dist/esm/icons/chevron-left";
import ChevronRight from "lucide-react-native/dist/esm/icons/chevron-right";
import Plus from "lucide-react-native/dist/esm/icons/plus";
import Search from "lucide-react-native/dist/esm/icons/search";
import X from "lucide-react-native/dist/esm/icons/x";

import type { Category } from "../services/api";
import { useCategoriesStore } from "../store/categoriesStore";
import type { AppTheme } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import {
  buildCategoryTree,
  categoryPath,
  groupRootsByGroupName,
  matchesSearch,
  type CategoryNode,
} from "../utils/categoryTree";
import CategoryForm from "./CategoryForm";
import CategoryIcon from "./CategoryIcon";
import CustomModal from "./CustomModal";

interface CategoryPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  selectedId?: string | null;
  /** Chamado ao tocar numa categoria (ou criar uma nova); o sheet se fecha em seguida. */
  onSelect: (category: Category) => void;
  /**
   * Quando presente, a lista abre com "Sem categoria" no topo — para os fluxos
   * em que ficar sem categoria é uma escolha válida (ex.: criação de
   * agendamento). Ausente, o sheet se comporta como sempre.
   */
  onClear?: () => void;
}

/**
 * Escolha de categoria em dois níveis. A lista abre só com as raízes e entra na
 * subcategoria por toque — com 14 pais e ~57 filhas, mostrar tudo de uma vez
 * viraria um paredão. A busca corta o caminho e devolve o resultado achatado.
 */
export default function CategoryPickerSheet({
  visible,
  onClose,
  selectedId,
  onSelect,
  onClear,
}: CategoryPickerSheetProps) {
  // A superfície do CustomModal segue o tema — o conteúdo tem que seguir junto,
  // senão o claro fica com texto branco em fundo branco
  const t = useTheme();
  // Altura vem de hook: o sheet abre no navegador, onde a janela redimensiona
  const { height: windowHeight } = useWindowDimensions();
  const listMaxHeight = windowHeight * 0.48;
  const items = useCategoriesStore((s) => s.items);
  const [mode, setMode] = useState<"list" | "create">("list");
  const [drillRootId, setDrillRootId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Cada abertura recomeça do topo — o desvio (formulário/nível) é pontual
  useEffect(() => {
    if (visible) {
      setMode("list");
      setDrillRootId(null);
      setSearch("");
    }
  }, [visible]);

  const roots = useMemo(() => buildCategoryTree(items), [items]);
  const sections = useMemo(() => groupRootsByGroupName(roots), [roots]);
  const drillRoot = useMemo(
    () => roots.find((r) => r.id === drillRootId) ?? null,
    [roots, drillRootId],
  );
  const searchHits = useMemo(() => {
    if (!search.trim()) return [];
    return items
      .filter((c) => !c.archived && matchesSearch(c, search))
      .slice(0, 40);
  }, [items, search]);

  const handlePick = (category: Category) => {
    onSelect(category);
    onClose();
  };

  const title =
    mode === "create"
      ? "Nova categoria"
      : drillRoot
        ? drillRoot.name
        : "Escolher categoria";

  const renderRow = (
    category: Category,
    { subtitle, drillInto }: { subtitle?: string; drillInto?: CategoryNode } = {},
  ) => {
    const selected = category.id === selectedId;
    return (
      <TouchableOpacity
        key={category.id}
        onPress={() =>
          drillInto ? setDrillRootId(drillInto.id) : handlePick(category)
        }
        accessibilityLabel={
          drillInto
            ? `Abrir subcategorias de ${category.name}`
            : `Selecionar categoria ${category.name}`
        }
        accessibilityRole="button"
        accessibilityState={{ selected }}
        activeOpacity={0.8}
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: 52,
          paddingHorizontal: spacing[2],
          borderRadius: radius.lg,
          backgroundColor: selected ? t.accent.neonMuted : "transparent",
        }}
      >
        {/* AppTheme tipa hexas literais do dark; os temas são estruturalmente
            idênticos, então o cast da união é seguro */}
        <CategoryIcon category={category} theme={t as AppTheme} size={36} />
        <View style={{ flex: 1, marginLeft: spacing[3] }}>
          <Text
            numberOfLines={1}
            style={{
              color: t.text.primary,
              fontSize: 14,
              fontWeight: selected ? "700" : "500",
            }}
          >
            {category.name}
          </Text>
          {subtitle ? (
            <Text style={{ color: t.text.tertiary, fontSize: 11, marginTop: 1 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {selected && <Check size={18} color={t.accent.neon} />}
        {drillInto && !selected && (
          <ChevronRight size={18} color={t.text.tertiary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <CustomModal visible={visible} onClose={onClose}>
      <View
        style={{
          paddingHorizontal: spacing[5],
          paddingTop: spacing[3],
          paddingBottom: spacing[6],
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: spacing[3],
          }}
        >
          {drillRoot && mode === "list" && (
            <TouchableOpacity
              onPress={() => setDrillRootId(null)}
              accessibilityLabel="Voltar para todas as categorias"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ marginRight: spacing[2] }}
            >
              <ChevronLeft size={22} color={t.text.primary} />
            </TouchableOpacity>
          )}
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              color: t.text.primary,
              fontSize: 20,
              fontWeight: "700",
            }}
          >
            {title}
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

        {mode === "list" ? (
          <>
            {!drillRoot && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  height: 44,
                  paddingHorizontal: spacing[3],
                  borderRadius: radius.full,
                  backgroundColor: t.background.elevated,
                  borderWidth: 1,
                  borderColor: t.border.subtle,
                  marginBottom: spacing[1],
                }}
              >
                <Search size={16} color={t.text.tertiary} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Buscar categoria"
                  placeholderTextColor={t.text.tertiary}
                  accessibilityLabel="Buscar categoria"
                  style={{
                    flex: 1,
                    marginLeft: spacing[2],
                    color: t.text.primary,
                    fontSize: 14,
                  }}
                />
                {search.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setSearch("")}
                    accessibilityLabel="Limpar busca"
                    accessibilityRole="button"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={16} color={t.text.tertiary} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              // teto explícito: o container do sheet não é flex, então sem
              // ele a lista estoura o maxHeight do modal em vez de rolar
              style={{ maxHeight: listMaxHeight }}
            >
              {search.trim().length > 0 ? (
                searchHits.length > 0 ? (
                  searchHits.map((category) =>
                    renderRow(category, {
                      subtitle: category.parentName ?? undefined,
                    }),
                  )
                ) : (
                  <Text
                    style={{
                      color: t.text.secondary,
                      fontSize: 13,
                      textAlign: "center",
                      paddingVertical: spacing[6],
                    }}
                  >
                    Nenhuma categoria com esse nome.
                  </Text>
                )
              ) : drillRoot ? (
                <>
                  {/* a raiz continua escolhível: nem todo gasto merece detalhe */}
                  {renderRow(drillRoot, { subtitle: "toda a categoria" })}
                  {drillRoot.children.map((child) => renderRow(child))}
                </>
              ) : (
                <>
                  {onClear && (
                    <TouchableOpacity
                      onPress={() => {
                        onClear();
                        onClose();
                      }}
                      accessibilityLabel="Ficar sem categoria"
                      accessibilityRole="button"
                      accessibilityState={{ selected: selectedId == null }}
                      activeOpacity={0.8}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        minHeight: 52,
                        paddingHorizontal: spacing[2],
                        borderRadius: radius.lg,
                        backgroundColor:
                          selectedId == null ? t.accent.neonMuted : "transparent",
                      }}
                    >
                      <CategoryIcon category={null} theme={t as AppTheme} size={36} />
                      <Text
                        numberOfLines={1}
                        style={{
                          flex: 1,
                          marginLeft: spacing[3],
                          color: t.text.primary,
                          fontSize: 14,
                          fontWeight: selectedId == null ? "700" : "500",
                        }}
                      >
                        Sem categoria
                      </Text>
                      {selectedId == null && (
                        <Check size={18} color={t.accent.neon} />
                      )}
                    </TouchableOpacity>
                  )}
                  {sections.map((section) => (
                    <View key={section.title}>
                    <Text
                      style={{
                        color: t.text.tertiary,
                        fontSize: 11,
                        fontWeight: "700",
                        letterSpacing: 1,
                        textTransform: "uppercase",
                        marginTop: spacing[3],
                        marginBottom: spacing[1],
                      }}
                    >
                      {section.title}
                    </Text>
                    {section.data.map((root) =>
                      renderRow(root, {
                        subtitle:
                          root.children.length > 0
                            ? `${root.children.length} subcategorias`
                            : undefined,
                        drillInto: root.children.length > 0 ? root : undefined,
                      }),
                    )}
                    </View>
                  ))}
                </>
              )}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setMode("create")}
              accessibilityLabel="Nova categoria"
              accessibilityRole="button"
              activeOpacity={0.8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                height: 52,
                borderRadius: radius.full,
                marginTop: spacing[3],
                backgroundColor: t.background.elevated,
                borderWidth: 1,
                borderColor: t.border.default,
              }}
            >
              <Plus size={18} color={t.accent.neon} />
              <Text
                style={{
                  color: t.accent.neon,
                  fontWeight: "700",
                  marginLeft: spacing[1],
                }}
              >
                {drillRoot
                  ? `Nova em ${drillRoot.name}`
                  : "Nova categoria"}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <CategoryForm
            initialParentId={drillRoot?.id ?? null}
            onSaved={handlePick}
            onCancel={() => setMode("list")}
          />
        )}
      </View>
    </CustomModal>
  );
}

export { categoryPath };
