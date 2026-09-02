import React from "react";
import { Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { radius } from "../theme/ds";
import { initialsOf, memberColorIndex } from "../utils/family";

interface MemberAvatarProps {
  /** Id do membro: é dele que sai a cor, para ela não mudar quando alguém sai. */
  memberId: string;
  name: string;
  /** Diâmetro do disco; a fonte acompanha (40% do tamanho). */
  size?: number;
}

/**
 * Fundo do disco a ~15% da cor da pessoa (0x26), como o disco de categoria.
 * As cores da paleta de gráfico são sempre `#RRGGBB`, então o sufixo de alfa
 * concatena sem risco de virar uma string de 11 caracteres.
 */
function discBackground(hex: string) {
  return `${hex}26`;
}

/**
 * Disco de iniciais de um membro da casa (EC-150). A cor segue a PESSOA, pela
 * mesma regra da cor de categoria: o mesmo membro veste o mesmo tom no Perfil,
 * na Análise e no Extrato, e ninguém precisa de legenda para reconhecê-lo.
 * O accent fica de fora — ele marca identidade do app e interação, não gente.
 */
export default function MemberAvatar({
  memberId,
  name,
  size = 40,
}: MemberAvatarProps) {
  const t = useTheme();
  const palette = t.chart.categorical;
  const color = palette[memberColorIndex(memberId, palette.length)];
  return (
    <View
      // O nome vai no rótulo falado do pai (linha do membro, selo); aqui só
      // as iniciais, que um leitor de tela soletraria sem sentido
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: radius.full,
        backgroundColor: discBackground(color),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color,
          fontSize: Math.round(size * 0.4),
          fontWeight: "700",
          letterSpacing: 0.5,
        }}
      >
        {initialsOf(name)}
      </Text>
    </View>
  );
}
