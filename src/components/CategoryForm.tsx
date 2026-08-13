import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated from "react-native-reanimated";

import type { Category, CategoryFlow } from "../services/api";
import { useCategoriesStore } from "../store/categoriesStore";
import { useToastStore } from "../store/toastStore";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { usePressScale } from "../theme/motionPresets";
import { buildCategoryTree } from "../utils/categoryTree";
import { PICKABLE_COLORS, PICKABLE_ICONS } from "./CategoryIcon";

const FLOW_OPTIONS: { value: CategoryFlow; label: string }[] = [
  { value: "EXPENSE", label: "Gasto" },
  { value: "INCOME", label: "Receita" },
  { value: "BOTH", label: "Ambos" },
];

interface CategoryFormProps {
  /** Categoria em edição; ausente/null = criação */
  initial?: Category | null;
  /** Pré-seleciona a categoria-mãe (o picker já sabe onde o usuário estava) */
  initialParentId?: string | null;
  onSaved: (category: Category) => void;
  onCancel: () => void;
}

/**
 * Formulário de categoria compartilhado entre o CategoryPickerSheet (criação
 * inline) e a tela de Categorias (criar/editar): uma única UX de nome, cor,
 * ícone e tipo em todos os pontos de entrada.
 */
export default function CategoryForm({
  initial,
  initialParentId,
  onSaved,
  onCancel,
}: CategoryFormProps) {
  // A superfície do CustomModal segue o tema — o formulário precisa ler o
  // mesmo tema, senão o claro fica ilegível
  const t = useTheme();
  const savePress = usePressScale();
  const isSaving = useCategoriesStore((s) => s.isSaving);
  const items = useCategoriesStore((s) => s.items);
  const create = useCategoriesStore((s) => s.create);
  const update = useCategoriesStore((s) => s.update);
  const { showToast } = useToastStore();

  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? PICKABLE_COLORS[0]);
  const [icon, setIcon] = useState(initial?.icon ?? PICKABLE_ICONS[0].name);
  const [flow, setFlow] = useState<CategoryFlow>(initial?.flow ?? "EXPENSE");
  const [parentId, setParentId] = useState<string | null>(
    initial ? initial.parentId : (initialParentId ?? null),
  );

  // Uma categoria que já tem filhas não pode virar filha: a árvore para em dois níveis
  const hasChildren = useMemo(
    () => (initial ? items.some((c) => c.parentId === initial.id) : false),
    [items, initial],
  );
  const parentOptions = useMemo(
    () =>
      buildCategoryTree(items).filter(
        (root) => !initial || root.id !== initial.id,
      ),
    [items, initial],
  );

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      showToast("Dê um nome à categoria.", "warning");
      return;
    }
    const payload = { name: trimmed, color, icon, flow };
    const saved = initial
      ? await update(initial.id, {
          ...payload,
          ...(parentId
            ? { parentId }
            : initial.parentId
              ? { clearParent: true }
              : {}),
        })
      : await create({ ...payload, parentId });
    if (saved) {
      showToast(initial ? "Categoria salva." : "Categoria criada.", "success");
      onSaved(saved);
      return;
    }
    // o store guarda o detail do backend (ex.: nome duplicado)
    showToast(
      useCategoriesStore.getState().error || "Não foi possível salvar.",
      "error",
    );
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text
        style={{
          color: t.text.secondary,
          fontSize: 13,
          fontWeight: "700",
          marginBottom: spacing[2],
        }}
      >
        Nome
      </Text>
      <TextInput
        // layout fica no NativeWind; a cor vem do tema porque as classes de
        // cor são espelho estático do dark
        className="rounded-xl p-4 text-base"
        style={{
          backgroundColor: t.background.elevated,
          color: t.text.primary,
          borderWidth: 1,
          borderColor: t.border.default,
        }}
        placeholder="Ex: Padaria, Assinaturas"
        placeholderTextColor={t.text.tertiary}
        value={name}
        onChangeText={setName}
        maxLength={40}
        accessibilityLabel="Nome da categoria"
      />

      {!hasChildren && (
        <>
          <Text
            style={{
              color: t.text.secondary,
              fontSize: 13,
              fontWeight: "700",
              marginTop: spacing[4],
              marginBottom: spacing[2],
            }}
          >
            Dentro de
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ flexDirection: "row", gap: spacing[2] }}>
              {[null, ...parentOptions].map((option) => {
                const selected = (option?.id ?? null) === parentId;
                const label = option ? option.name : "Categoria principal";
                return (
                  <TouchableOpacity
                    key={option?.id ?? "root"}
                    onPress={() => {
                      setParentId(option?.id ?? null);
                      // sub de "Receitas" nascer como gasto inverteria o sinal na análise
                      if (option) setFlow(option.flow);
                    }}
                    accessibilityLabel={
                      option ? `Subcategoria de ${option.name}` : "Categoria principal"
                    }
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    activeOpacity={0.8}
                    style={{
                      height: 40,
                      paddingHorizontal: spacing[4],
                      borderRadius: radius.full,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: selected
                        ? t.accent.neonMuted
                        : t.background.elevated,
                      borderWidth: 1,
                      borderColor: selected ? t.accent.neon : t.border.subtle,
                    }}
                  >
                    <Text
                      style={{
                        color: selected ? t.accent.neon : t.text.primary,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </>
      )}

      <Text
        style={{
          color: t.text.secondary,
          fontSize: 13,
          fontWeight: "700",
          marginTop: spacing[4],
          marginBottom: spacing[1],
        }}
      >
        Cor
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {PICKABLE_COLORS.map((option, i) => {
          const selected = color === option;
          return (
            <TouchableOpacity
              key={option}
              onPress={() => setColor(option)}
              accessibilityLabel={`Cor ${i + 1} de ${PICKABLE_COLORS.length}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              activeOpacity={0.8}
              style={{
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: radius.full,
                  backgroundColor: option,
                  borderWidth: selected ? 3 : 0,
                  borderColor: t.text.primary,
                }}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      <Text
        style={{
          color: t.text.secondary,
          fontSize: 13,
          fontWeight: "700",
          marginTop: spacing[4],
          marginBottom: spacing[1],
        }}
      >
        Ícone
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {PICKABLE_ICONS.map(({ name: iconName, Icon }) => {
          const selected = icon === iconName;
          return (
            <TouchableOpacity
              key={iconName}
              onPress={() => setIcon(iconName)}
              accessibilityLabel={`Ícone ${iconName}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              activeOpacity={0.8}
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.lg,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: selected ? t.accent.neonMuted : "transparent",
              }}
            >
              <Icon
                size={20}
                color={selected ? t.accent.neon : t.text.secondary}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      <Text
        style={{
          color: t.text.secondary,
          fontSize: 13,
          fontWeight: "700",
          marginTop: spacing[4],
          marginBottom: spacing[2],
        }}
      >
        Tipo
      </Text>
      <View style={{ flexDirection: "row", gap: spacing[2] }}>
        {FLOW_OPTIONS.map((option) => {
          const selected = flow === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => setFlow(option.value)}
              accessibilityLabel={`Tipo ${option.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              activeOpacity={0.8}
              style={{
                flex: 1,
                height: 44,
                borderRadius: radius.full,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: selected
                  ? t.accent.neon
                  : t.background.elevated,
                borderWidth: 1,
                borderColor: selected ? t.accent.neon : t.border.subtle,
              }}
            >
              <Text
                style={{
                  color: selected ? t.text.inverse : t.text.primary,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View
        style={{ flexDirection: "row", gap: spacing[3], marginTop: spacing[6] }}
      >
        <TouchableOpacity
          onPress={onCancel}
          accessibilityLabel="Cancelar"
          accessibilityRole="button"
          activeOpacity={0.8}
          style={{
            flex: 1,
            height: 52,
            borderRadius: radius.full,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.background.elevated,
            borderWidth: 1,
            borderColor: t.border.subtle,
          }}
        >
          <Text style={{ color: t.text.primary, fontWeight: "700" }}>
            Cancelar
          </Text>
        </TouchableOpacity>
        <Animated.View style={[savePress.pressStyle, { flex: 1 }]}>
          <TouchableOpacity
            onPress={handleSave}
            onPressIn={savePress.onPressIn}
            onPressOut={savePress.onPressOut}
            disabled={isSaving}
            accessibilityLabel={initial ? "Salvar categoria" : "Criar categoria"}
            accessibilityRole="button"
            accessibilityState={{ disabled: isSaving }}
            activeOpacity={0.85}
            style={{
              height: 52,
              borderRadius: radius.full,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: t.accent.neon,
              opacity: isSaving ? 0.7 : 1,
            }}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={t.text.inverse} />
            ) : (
              <Text style={{ color: t.text.inverse, fontWeight: "700" }}>
                {initial ? "Salvar" : "Criar categoria"}
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </ScrollView>
  );
}
