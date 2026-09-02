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
import { motion, radius, spacing } from "../theme/ds";
import { sheetSpring } from "../theme/motionPresets";
import { boxNone } from "../utils/pointerEvents";
import { useBreakpoint } from "../hooks/useBreakpoint";

// Teto do diálogo na tela larga: cabe o conteúdo de qualquer folha do app sem
// esticar a linha de leitura (mesma ordem de grandeza das colunas da grade)
const DIALOG_MAX_WIDTH = 560;

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
  const { isWide } = useBreakpoint();
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
          {/* Fora do alcance do leitor de tela de propósito: é uma área do
              tamanho da tela, e anunciá-la como botão faria o VoiceOver ler
              "botão" sobre tudo o que não é o sheet. Quem navega por leitor
              fecha pelo X do próprio sheet, que tem rótulo */}
          <TouchableOpacity
            className="flex-1"
            onPress={onClose}
            activeOpacity={1}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          />
        </Animated.View>

        {/* Modal Content */}
        {/* O vazio em volta do sheet precisa deixar o clique chegar no
            backdrop, que é quem fecha o modal */}
        <View
          className="flex-1"
          style={[
            boxNone,
            // No celular o sheet nasce colado ao rodapé. Na tela larga uma
            // folha esticada nos 1440 px lê como erro de layout: vira um
            // diálogo centralizado, com teto de largura e cantos arredondados
            // nos quatro lados.
            isWide
              ? {
                  justifyContent: "center",
                  alignItems: "center",
                  padding: spacing[6],
                }
              : { justifyContent: "flex-end" },
          ]}
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
              isWide && {
                width: "100%",
                maxWidth: DIALOG_MAX_WIDTH,
                borderRadius: radius["3xl"],
                borderWidth: 1,
                borderColor: t.border.subtle,
                paddingBottom: spacing[4],
              },
              modalAnimatedStyle,
            ]}
          >
            {/* Grabber único do sheet — o conteúdo não deve desenhar outro.
                No diálogo centralizado ele não promete nada (não há arrasto),
                então some */}
            {!isWide && (
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
            )}
            {children}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
