import React, { useEffect, useState } from "react";
import {
  View,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";

import { useTheme } from "../theme/ThemeProvider";
import { motion, radius } from "../theme/ds";
import { sheetSpring } from "../theme/motionPresets";

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
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [showModal, setShowModal] = useState(visible);
  const backdropOpacity = useSharedValue(0);
  const modalTranslateY = useSharedValue(500);

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      requestAnimationFrame(() => {
        backdropOpacity.value = withTiming(1, {
          duration: motion.duration.base,
        });
        // Sheet sobe em spring de damping alto: assenta sem quicar. Com
        // movimento reduzido, entra só no fade do backdrop, sem deslocamento
        modalTranslateY.value = reducedMotion
          ? withTiming(0, { duration: 0 })
          : withSpring(0, sheetSpring);
      });
    } else {
      backdropOpacity.value = withTiming(0, { duration: motion.duration.base });
      modalTranslateY.value = withTiming(
        reducedMotion ? 0 : 500,
        { duration: motion.duration.base },
        () => {
          runOnJS(setShowModal)(false);
        },
      );
    }
  }, [visible, reducedMotion]);

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
      // Sem isso o backdrop para embaixo da status bar no Android
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Backdrop */}
        <Animated.View
          className="absolute inset-0"
          style={[
            { backgroundColor: t.background.overlay },
            backdropAnimatedStyle,
          ]}
        >
          <TouchableOpacity
            className="flex-1"
            onPress={onClose}
            activeOpacity={1}
          />
        </Animated.View>

        {/* Modal Content */}
        {/* `pointerEvents` no estilo: a prop está depreciada e avisa no
            console da web */}
        <View
          className="flex-1 justify-end"
          style={{ pointerEvents: "box-none" }}
        >
          <Animated.View
            style={[
              {
                backgroundColor: t.background.surface,
                borderTopLeftRadius: radius["3xl"],
                borderTopRightRadius: radius["3xl"],
                maxHeight: "90%",
                paddingBottom: insets.bottom,
                borderTopWidth: 1,
                borderTopColor: t.border.subtle,
              },
              modalAnimatedStyle,
            ]}
          >
            {/* Grabber único do sheet — o conteúdo não deve desenhar outro */}
            <View
              style={{
                alignSelf: "center",
                width: 40,
                height: 4,
                borderRadius: radius.full,
                backgroundColor: t.border.default,
                marginTop: 12,
                marginBottom: 4,
              }}
            />
            {children}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
