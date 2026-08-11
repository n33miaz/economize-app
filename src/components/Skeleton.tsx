import React, { useEffect } from "react";
import { DimensionValue } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { radius } from "../theme/ds";

interface SkeletonProps {
  width?: DimensionValue;
  height?: number | DimensionValue;
  borderRadius?: number;
  className?: string;
}

export default function Skeleton({
  width = "100%",
  height = 20,
  // Piso de raio dos contêineres visíveis (12): o skeleton imita o conteúdo
  borderRadius = radius.lg,
  className = "",
}: SkeletonProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800 }),
        withTiming(0.3, { duration: 800 }),
      ),
      -1,
      true,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      className={`bg-border ${className}`}
      style={[{ width, height, borderRadius }, animatedStyle]}
    />
  );
}
