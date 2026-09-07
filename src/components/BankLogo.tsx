import React from "react";
import { Image, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import type { LucideIcon } from "lucide-react-native";

import { useTheme } from "../theme/ThemeProvider";
import { radius } from "../theme/ds";
import { BANK_LOGOS, bankKeyFor, bankMonogram } from "../utils/bankBrand";

interface BankLogoProps {
  /**
   * A instituição como veio do provedor. É ela que escolhe o logo e que vira
   * o rótulo falado — o leitor de tela diz "Nubank", não "imagem".
   */
  institution: string | null | undefined;
  /** Lado do quadrado, em pontos. */
  size?: number;
  /** Margens e posicionamento do chamador; o tamanho é sempre daqui. */
  style?: StyleProp<ViewStyle>;
  /** Ícone para quando não há instituição nenhuma a nomear. */
  Fallback?: LucideIcon;
}

/**
 * O logo do banco, com a degradação honesta embutida.
 *
 * Três saídas, na ordem em que se tenta: o PNG da marca quando o nome casa
 * com um banco conhecido; um monograma com as iniciais quando há nome mas não
 * há logo; e o ícone de apoio quando não há nem nome. Em todas a moldura é a
 * mesma — quadrado com `radius.md` sobre `elevated` — para uma lista mista de
 * bancos com e sem logo não parecer desalinhada.
 *
 * Cor de marca fica DENTRO do PNG: o monograma e a moldura usam só tokens,
 * porque aqui a cor não é decisão nossa nem estado do dado.
 */
export default function BankLogo({
  institution,
  size = 28,
  style,
  Fallback,
}: BankLogoProps) {
  const t = useTheme();
  const key = bankKeyFor(institution);
  const label = institution?.trim() ?? "";
  const frame = {
    width: size,
    height: size,
    borderRadius: radius.md,
    backgroundColor: t.background.elevated,
    // Contorno sutil: a moldura precisa existir também sobre `elevated`, onde
    // o fundo dela sumiria e o monograma ficaria solto
    borderWidth: 1,
    borderColor: t.border.subtle,
    overflow: "hidden" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  if (key) {
    return (
      // A moldura é uma View e a imagem preenche: é a View que recorta o canto
      // arredondado nas três plataformas, e é nela que o chamador põe margem
      <View
        accessible
        accessibilityLabel={label}
        accessibilityRole="image"
        style={[frame, style]}
      >
        <Image
          source={BANK_LOGOS[key]}
          resizeMode="cover"
          // Largura e altura no style: `className` de tamanho não alcança <Image>
          style={{ width: size, height: size }}
        />
      </View>
    );
  }

  const initials = bankMonogram(label);
  return (
    <View
      accessible={label.length > 0}
      accessibilityLabel={label.length > 0 ? label : undefined}
      accessibilityRole={label.length > 0 ? "image" : undefined}
      style={[frame, style]}
    >
      {initials ? (
        <Text
          style={{
            color: t.text.secondary,
            fontSize: Math.max(10, Math.round(size * 0.38)),
            fontWeight: "700",
            letterSpacing: 0.5,
          }}
        >
          {initials}
        </Text>
      ) : Fallback ? (
        <Fallback size={Math.round(size * 0.55)} color={t.text.tertiary} />
      ) : null}
    </View>
  );
}
