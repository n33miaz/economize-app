import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import ChevronRight from "lucide-react-native/dist/esm/icons/chevron-right";
import type { LucideIcon } from "lucide-react-native";
import Animated from "react-native-reanimated";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { usePressScale } from "../theme/motionPresets";

interface ActionRowProps {
  Icon: LucideIcon;
  label: string;
  /** Linha de apoio abaixo do rótulo: valor atual ou dica do que acontece */
  description?: string;
  /** Sem onPress a linha vira moldura de um controle próprio (ex.: Switch) */
  onPress?: () => void;
  destructive?: boolean;
  /** Substitui o chevron à direita — Switch, spinner ou valor */
  right?: React.ReactNode;
  /** Esmaece e bloqueia o toque (ex.: recurso indisponível no aparelho) */
  disabled?: boolean;
}

// Linha padrão das telas de conta (Perfil, Opções avançadas): ícone em chip +
// rótulo/descrição + chevron ou controle, com o feedback de escala do design
// system. Destrutivas trocam o accent pelo token de perigo e perdem o chevron.
export default function ActionRow({
  Icon,
  label,
  description,
  onPress,
  destructive,
  right,
  disabled,
}: ActionRowProps) {
  const t = useTheme();
  const { pressStyle, onPressIn, onPressOut } = usePressScale();
  const interactive = !!onPress && !disabled;
  const color = destructive ? t.semantic.danger : t.text.primary;

  return (
    <Animated.View style={pressStyle}>
      <TouchableOpacity
        onPress={interactive ? onPress : undefined}
        onPressIn={interactive ? onPressIn : undefined}
        onPressOut={interactive ? onPressOut : undefined}
        disabled={!interactive}
        activeOpacity={interactive ? 0.7 : 1}
        accessibilityLabel={description ? `${label}. ${description}` : label}
        accessibilityRole={onPress ? "button" : undefined}
        accessibilityState={disabled ? { disabled: true } : undefined}
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: t.background.elevated,
          borderRadius: radius.xl,
          paddingVertical: spacing[3],
          paddingHorizontal: spacing[4],
          marginBottom: spacing[2],
          borderWidth: 1,
          borderColor: t.border.subtle,
          minHeight: 60,
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: radius.full,
            backgroundColor: destructive
              ? t.semantic.dangerMuted
              : t.background.surface,
            alignItems: "center",
            justifyContent: "center",
            marginRight: spacing[3],
          }}
        >
          <Icon size={17} color={color} />
        </View>
        <View style={{ flex: 1, marginRight: spacing[3] }}>
          <Text style={{ color, fontSize: 15, fontWeight: "600" }}>
            {label}
          </Text>
          {description ? (
            <Text
              style={{ color: t.text.secondary, fontSize: 12, marginTop: 2 }}
            >
              {description}
            </Text>
          ) : null}
        </View>
        {right ??
          (onPress && !destructive ? (
            <ChevronRight size={18} color={t.text.tertiary} />
          ) : null)}
      </TouchableOpacity>
    </Animated.View>
  );
}
