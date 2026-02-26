import React, { useEffect } from "react";
import { View, ViewStyle, StyleProp } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from "react-native-reanimated";

interface PageContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function PageContainer({ children, style }: PageContainerProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 500 });
    translateY.value = withSpring(0, {
      damping: 20,
      stiffness: 90,
      mass: 1,
    });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View className="flex-1 bg-background-light overflow-hidden">
      <Animated.View
        className="flex-1 bg-background-light"
        style={[style, animatedStyle]}
      >
        {children}
      </Animated.View>
    </View>
  );
}
