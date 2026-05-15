import React, { useEffect, useState } from "react";
import {
  View,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
  Modal,
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
  const [showModal, setShowModal] = useState(visible);
  const backdropOpacity = useSharedValue(0);
  const modalTranslateY = useSharedValue(500);

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      requestAnimationFrame(() => {
        backdropOpacity.value = withTiming(1, { duration: 300 });
        modalTranslateY.value = withTiming(0, { duration: 300 });
      });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 300 });
      modalTranslateY.value = withTiming(500, { duration: 300 }, () => {
        runOnJS(setShowModal)(false);
      });
    }
  }, [visible]);

  useEffect(() => {
    const backAction = () => {
      if (visible) {
        onClose();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction,
    );

    return () => backHandler.remove();
  }, [visible, onClose]);

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const modalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: modalTranslateY.value }],
  }));

  if (!showModal) return null;

  return (
    <Modal
      transparent
      visible={showModal}
      onRequestClose={onClose}
      animationType="none"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Backdrop */}
        <Animated.View
          className="absolute inset-0 bg-slate-900/60"
          style={backdropAnimatedStyle}
        >
          <TouchableOpacity
            className="flex-1"
            onPress={onClose}
            activeOpacity={1}
          />
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
    </Modal>
  );
}
