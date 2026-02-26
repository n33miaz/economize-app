import React, { useEffect } from "react";
import { DimensionValue } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { cssInterop } from "nativewind";

cssInterop(Animated.View, { className: "style" });

interface SkeletonProps {
  width?: DimensionValue;
  height?: number | DimensionValue;
  borderRadius?: number;
  className?: string;
}

export default function Skeleton({
  width = "100%",
  height = 20,
  borderRadius = 8,
  className,
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
      className={`bg-gray-300 dark:bg-gray-700 ${className}`}
      style={[{ width, height, borderRadius }, animatedStyle]}
    />
  );
}
