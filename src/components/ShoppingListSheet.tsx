import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Check from "lucide-react-native/dist/esm/icons/check";
import X from "lucide-react-native/dist/esm/icons/x";

import { useTheme } from "../theme/ThemeProvider";
import { SHEET_PADDING, SHEET_TITLE, radius, spacing } from "../theme/ds";
import * as Haptics from "../utils/haptics";
import {
  LIST_PASTE_LIMIT,
  type ShoppingItem,
  parseListNames,
} from "../utils/shopping";
import CustomModal from "./CustomModal";

interface ShoppingListSheetProps {
  visible: boolean;
  /** O que já está na lista, para não escrever duas vezes a mesma coisa. */
  pending: ShoppingItem[];
  /** Devolve quantos nomes entraram de fato. */
  onAdd: (names: string[]) => number;
  onClose: () => void;
}

/**
 * Escrever a lista antes de ir — ou no meio do corredor, quando lembrou.
 *
 * <p><b>O pedido do dono (21/09/2026):</b> <i>"quero também conseguir fazer
 * uma lista de compras"</i>, para a lista ir dando check enquanto ele anota as
 * compras <i>"e eu não esquecer de nada"</i>.
 *
 * <p>Esta folha é deliberadamente mais pobre que a de item: aqui só entra o
 * NOME. Quem escreve a lista está no sofá e não sabe o preço; pedir quantidade
 * e preço nessa hora transformaria dez segundos de escrita em dois minutos de
 * formulário, e a pessoa desistiria de usar a lista — que era o ponto.
 *
 * <p>Três decisões que fazem a escrita ser rápida:
 *
 * <p><b>O campo não fecha a folha ao confirmar.</b> Enter adiciona e mantém o
 * foco, então a lista sai numa sequência só, sem tocar na tela entre um item e
 * outro.
 *
 * <p><b>Colar a lista inteira funciona.</b> Quem já tem a lista no bloco de
 * notas ou numa mensagem cola tudo de uma vez: uma por linha, por vírgula ou
 * por ponto e vírgula, e a numeração do texto ("1.", "-") é descartada porque
 * é marca do texto, não nome de produto.
 *
 * <p><b>O que já está na lista aparece aqui embaixo.</b> Sem isso a pessoa não
 * tem como saber se já escreveu "café" — e escreveria de novo.
 */
export default function ShoppingListSheet({
  visible,
  pending,
  onAdd,
  onClose,
}: ShoppingListSheetProps) {
  const t = useTheme();
  const campoRef = useRef<TextInput>(null);
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setTexto("");
    setAviso(null);
    // Depois da animação da folha: focar antes de ela existir não abre o teclado
    const foco = setTimeout(() => campoRef.current?.focus(), 350);
    return () => clearTimeout(foco);
  }, [visible]);

  const adicionar = () => {
    const nomes = parseListNames(texto);
    if (nomes.length === 0) {
      setAviso("Escreva o que não pode faltar.");
      return;
    }
    const entraram = onAdd(nomes);
    setTexto("");
    if (entraram === 0) {
      // Dizer "já está na lista" é mais útil que um silêncio que parece falha
      setAviso(
        nomes.length === 1
          ? "Esse já está na lista."
          : "Todos esses já estavam na lista.",
      );
      return;
    }
    Haptics.selectionAsync();
    const ignorados = nomes.length - entraram;
    setAviso(
      entraram === 1
        ? "1 item na lista."
        : `${entraram} itens na lista.` +
            (ignorados > 0 ? ` ${ignorados} já estavam.` : ""),
    );
    campoRef.current?.focus();
  };

  const rotuloCampo = {
    color: t.text.tertiary,
    fontSize: 11,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  };

  return (
    <CustomModal visible={visible} onClose={onClose}>
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
          <Text style={{ flex: 1, color: t.text.primary, ...SHEET_TITLE }}>
            Lista de compras
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            hitSlop={8}
          >
            <X size={20} color={t.text.tertiary} />
          </Pressable>
        </View>

        <Text style={{ color: t.text.secondary, fontSize: 13, marginBottom: spacing[3] }}>
          Escreva o que não pode faltar. Conforme você for anotando as compras
          no mercado, cada um desses vai sendo marcado sozinho.
        </Text>

        <Text style={rotuloCampo}>O que não pode faltar</Text>
        <TextInput
          ref={campoRef}
          value={texto}
          onChangeText={(valor) => {
            setTexto(valor);
            if (aviso) setAviso(null);
          }}
          accessibilityLabel="Item da lista"
          accessibilityHint="Um por linha, ou separados por vírgula. Confirmar adiciona sem fechar."
          placeholder={"arroz\nfeijão\ncafé"}
          placeholderTextColor={t.text.tertiary}
          autoCapitalize="sentences"
          autoCorrect={false}
          multiline
          returnKeyType="done"
          blurOnSubmit={false}
          onSubmitEditing={adicionar}
          style={{
            color: t.text.primary,
            fontSize: 16,
            borderWidth: 1,
            borderColor: t.border.subtle,
            borderRadius: radius.lg,
            backgroundColor: t.background.elevated,
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[3],
            minHeight: 96,
            textAlignVertical: "top",
            marginTop: spacing[2],
          }}
        />
        <Text
          style={{
            color: t.text.tertiary,
            fontSize: 12,
            marginTop: spacing[2],
          }}
        >
          Um por linha, ou separados por vírgula. Dá para colar a lista inteira
          de uma vez (até {LIST_PASTE_LIMIT}).
        </Text>

        {aviso ? (
          <Text
            style={{
              color: t.text.secondary,
              fontSize: 13,
              marginTop: spacing[2],
            }}
          >
            {aviso}
          </Text>
        ) : null}

        <Pressable
          onPress={adicionar}
          accessibilityRole="button"
          accessibilityLabel="Adicionar à lista"
          style={{
            backgroundColor: t.accent.neon,
            borderRadius: radius.full,
            minHeight: 48,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: spacing[2],
            marginTop: spacing[4],
          }}
        >
          <Check size={18} color={t.background.base} />
          <Text
            style={{
              color: t.background.base,
              fontSize: 15,
              fontWeight: "700",
            }}
          >
            Adicionar à lista
          </Text>
        </Pressable>

        {pending.length > 0 ? (
          <View style={{ marginTop: spacing[5] }}>
            <Text style={rotuloCampo}>
              Já na lista ({pending.length})
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing[2],
                marginTop: spacing[2],
              }}
            >
              {pending.map((item) => (
                <View
                  key={item.clientId}
                  style={{
                    borderWidth: 1,
                    borderColor: t.border.subtle,
                    borderRadius: radius.full,
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[1],
                    backgroundColor: t.background.elevated,
                  }}
                >
                  <Text style={{ color: t.text.secondary, fontSize: 13 }}>
                    {item.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </CustomModal>
  );
}
