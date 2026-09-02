import React from "react";
import { Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import MemberAvatar from "./MemberAvatar";

interface MemberBadgeProps {
  memberId: string;
  name: string;
  /** Marca a linha do próprio chamador: "você", e não o nome dele. */
  isMe?: boolean;
  /** Teto de largura do rótulo — a lista é mais apertada que a folha. */
  maxLabelWidth?: number;
}

/**
 * De quem é o lançamento, na linha do extrato da casa (EC-150). Fica ao lado
 * do `OriginBadge` e veste a mesma pílula neutra dele: é procedência, não
 * julgamento — a cor da pessoa aparece só no disco de iniciais, que é o que
 * identifica de longe.
 */
export default function MemberBadge({
  memberId,
  name,
  isMe = false,
  maxLabelWidth = 118,
}: MemberBadgeProps) {
  const t = useTheme();
  const label = isMe ? "você" : name;
  return (
    <View
      // Nó acessível único, como o selo de origem: o disco e o texto são uma
      // informação só ("de Ana"), não dois elementos soltos na linha
      accessible
      accessibilityLabel={isMe ? "Lançamento seu" : `Lançamento de ${name}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        minHeight: 24,
        borderRadius: radius.full,
        paddingLeft: 2,
        paddingRight: spacing[2],
        paddingVertical: 2,
        backgroundColor: t.background.elevated,
        borderWidth: 1,
        borderColor: t.border.subtle,
      }}
    >
      <MemberAvatar memberId={memberId} name={name} size={18} />
      <Text
        numberOfLines={1}
        style={{
          color: t.text.secondary,
          fontSize: 11,
          fontWeight: "600",
          marginLeft: spacing[1],
          maxWidth: maxLabelWidth,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
