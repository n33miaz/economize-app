import React, { useEffect } from "react";
import {
  View,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
  StyleSheet,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";

interface CustomModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function CustomModal({
  visible,
  onClose,
  children,
}: CustomModalProps) {
  const backdropOpacity = useSharedValue(0);
  const modalTranslateY = useSharedValue(500);

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const modalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: modalTranslateY.value }],
  }));

  const animateIn = () => {
    backdropOpacity.value = withTiming(1, { duration: 300 });
    modalTranslateY.value = withTiming(0, { duration: 300 });
  };

  const animateOut = (callback: () => void) => {
    backdropOpacity.value = withTiming(0, { duration: 300 });
    modalTranslateY.value = withTiming(500, { duration: 300 }, () => {
      runOnJS(callback)();
    });
  };

  useEffect(() => {
    if (visible) {
      animateIn();
    }
  }, [visible]);

  const handleClose = () => {
    animateOut(onClose);
  };

  useEffect(() => {
    const backAction = () => {
      if (visible) {
        handleClose();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction,
    );

    return () => backHandler.remove();
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} className="z-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Backdrop */}
        <Animated.View
          className="absolute inset-0 bg-slate-900/60"
          style={backdropAnimatedStyle}
        >
          <TouchableOpacity className="flex-1" onPress={handleClose} />
        </Animated.View>

        {/* Modal Content */}
        <View className="flex-1 justify-end" pointerEvents="box-none">
          <Animated.View
            className="bg-white rounded-t-[32px] max-h-[90%]"
            style={modalAnimatedStyle}
          >
            {children}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
