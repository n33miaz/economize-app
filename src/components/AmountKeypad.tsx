import React from "react";
import { Pressable, Text, View } from "react-native";
import ChevronDown from "lucide-react-native/dist/esm/icons/chevron-down";
import Delete from "lucide-react-native/dist/esm/icons/delete";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import * as Haptics from "../utils/haptics";
import { LINHAS, type Tecla, digitar, rotuloDaTecla } from "../utils/keypad";

interface AmountKeypadProps {
  /** O valor como está escrito no campo agora ("12,90"). */
  value: string;
  onChange: (proximo: string) => void;
  /** O botão grande embaixo das teclas; é ele que encerra o item. */
  actionLabel: string;
  onAction: () => void;
  /** Esconde o teclado e devolve a folha inteira para leitura. */
  onDismiss: () => void;
  /** Uma linha acima das teclas dizendo o que está sendo digitado. */
  hint?: string | null;
  disabled?: boolean;
}

const ALTURA_TECLA = 52;

/**
 * O teclado de números do app.
 *
 * <p><b>O pedido (21/09/2026), depois de uma compra inteira digitando:</b>
 * <i>"principalmente na digitação está uma merda"</i>.
 *
 * <p>O teclado do sistema encolhe a janela do Android. Cada troca entre o
 * campo do nome (letras) e o do preço (números) remontava a folha, e o botão
 * de adicionar ia parar atrás das teclas. Este teclado é desenhado DENTRO da
 * folha: nada encolhe, nada se remonta, e o botão que encerra o item fica
 * colado embaixo das teclas — o polegar sai do "9" e cai nele.
 *
 * <p>As teclas têm 52 px de altura e ocupam um terço da largura cada. É
 * maior que o teclado do sistema de propósito: quem digita aqui está de pé,
 * com o carrinho na outra mão.
 */
export default function AmountKeypad({
  value,
  onChange,
  actionLabel,
  onAction,
  onDismiss,
  hint,
  disabled,
}: AmountKeypadProps) {
  const t = useTheme();

  const tocar = (tecla: Tecla) => {
    Haptics.selectionAsync();
    onChange(digitar(value, tecla));
  };

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: t.border.subtle,
        backgroundColor: t.background.surface,
        paddingHorizontal: spacing[4],
        paddingTop: spacing[2],
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: 28,
          marginBottom: spacing[1],
        }}
      >
        <Text
          numberOfLines={1}
          style={{ flex: 1, color: t.text.tertiary, fontSize: 12 }}
        >
          {hint ?? ""}
        </Text>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Esconder o teclado de números"
          hitSlop={12}
          style={{ paddingHorizontal: spacing[2] }}
        >
          <ChevronDown size={20} color={t.text.secondary} />
        </Pressable>
      </View>

      {LINHAS.map((linha, indice) => (
        <View
          key={`linha-${indice}`}
          style={{ flexDirection: "row", gap: spacing[2], marginBottom: spacing[2] }}
        >
          {linha.map((tecla) => (
            <Pressable
              key={tecla}
              onPress={() => tocar(tecla)}
              onLongPress={
                tecla === "apagar" ? () => onChange(digitar(value, "limpar")) : undefined
              }
              accessibilityRole="button"
              accessibilityLabel={rotuloDaTecla(tecla)}
              style={({ pressed }) => ({
                flex: 1,
                height: ALTURA_TECLA,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radius.lg,
                backgroundColor: pressed
                  ? t.background.elevated
                  : t.background.base,
                borderWidth: 1,
                borderColor: t.border.subtle,
              })}
            >
              {tecla === "apagar" ? (
                <Delete size={22} color={t.text.primary} />
              ) : (
                <Text
                  style={{
                    color: t.text.primary,
                    fontSize: 22,
                    fontWeight: "700",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {tecla}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      ))}

      <Pressable
        onPress={onAction}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        accessibilityState={{ disabled: Boolean(disabled) }}
        style={{
          height: 52,
          borderRadius: radius.xl,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: t.accent.neon,
          opacity: disabled ? 0.6 : 1,
          marginBottom: spacing[2],
        }}
      >
        <Text style={{ color: t.text.inverse, fontWeight: "700", fontSize: 16 }}>
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}
