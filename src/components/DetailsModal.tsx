import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { motion } from "../theme/ds";
import { sheetSpring } from "../theme/motionPresets";
import { convertCurrency } from "../services/api";

interface DetailsModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  currencyCode?: string;
  children: React.ReactNode;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function DetailsModal({
  visible,
  onClose,
  title,
  currencyCode,
  children,
}: DetailsModalProps) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const [amount, setAmount] = useState("100");
  const [conversionResult, setConversionResult] = useState<number | null>(null);
  const [loadingConversion, setLoadingConversion] = useState(false);
  const [showModal, setShowModal] = useState(visible);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      setConversionResult(null);
      setAmount("100");
      requestAnimationFrame(() => {
        // Sheet em spring de damping alto (assenta sem quicar); com movimento
        // reduzido entra só no fade, sem deslocamento
        translateY.value = reducedMotion
          ? withTiming(0, { duration: 0 })
          : withSpring(0, sheetSpring);
        opacity.value = withTiming(1, { duration: motion.duration.base });
      });
    } else {
      translateY.value = withTiming(
        reducedMotion ? 0 : SCREEN_HEIGHT,
        { duration: motion.duration.base },
        () => {
          runOnJS(setShowModal)(false);
        },
      );
      opacity.value = withTiming(0, { duration: motion.duration.base });
    }
  }, [visible, reducedMotion]);

  const handleConvert = async () => {
    if (!currencyCode || !amount) return;
    setLoadingConversion(true);
    const numericAmount = parseFloat(amount.replace(",", "."));
    if (isNaN(numericAmount)) {
      setLoadingConversion(false);
      return;
    }
    const result = await convertCurrency(currencyCode, numericAmount);
    if (result) setConversionResult(result.result);
    setLoadingConversion(false);
  };

  const handleClose = () => {
    onClose();
  };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const modalStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!showModal) return null;

  return (
    <Modal
      transparent
      visible={showModal}
      onRequestClose={handleClose}
      animationType="none"
    >
      <Animated.View
        className="absolute inset-0"
        style={[{ backgroundColor: t.background.overlay }, backdropStyle]}
      >
        <TouchableOpacity
          className="flex-1"
          activeOpacity={1}
          onPress={handleClose}
        />
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 justify-end"
        pointerEvents="box-none"
      >
        <Animated.View
          className="bg-surface border-t border-border rounded-t-3xl px-6 pt-3 pb-10 max-h-[90%]"
          style={modalStyle}
        >
          <View className="w-14 h-1.5 bg-border rounded-full self-center mb-6 mt-2" />
          <View className="items-center justify-center mb-6 border-b border-border pb-4">
            <Text className="text-2xl font-bold text-textPrimary text-center">
              {title}
            </Text>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerClassName="pb-8"
            keyboardShouldPersistTaps="handled"
          >
            {children}
            {currencyCode && (
              <View className="mt-6 bg-elevated p-5 rounded-3xl border border-border">
                <Text className="text-xs font-bold text-textSecondary mb-4 uppercase tracking-widest">
                  Simulador de Conversão
                </Text>
                <View className="flex-row items-center bg-surface rounded-2xl border border-border px-4 h-16 mb-4">
                  <Text className="text-base font-bold text-textTertiary mr-3 pr-3 border-r border-border">
                    BRL
                  </Text>
                  <TextInput
                    className="flex-1 text-xl text-textPrimary font-bold h-full"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor={t.text.tertiary}
                    accessibilityLabel="Valor em reais para converter"
                  />
                </View>
                <TouchableOpacity
                  className="bg-primary rounded-2xl h-16 justify-center items-center active:bg-accentPressed"
                  onPress={handleConvert}
                  disabled={loadingConversion}
                  accessibilityLabel="Converter agora"
                  accessibilityRole="button"
                >
                  {loadingConversion ? (
                    <ActivityIndicator color={t.text.inverse} />
                  ) : (
                    <Text className="text-primaryDark text-lg font-bold">
                      Converter Agora
                    </Text>
                  )}
                </TouchableOpacity>
                {conversionResult !== null && (
                  <View className="mt-5 items-center p-5 bg-success/15 rounded-2xl border border-success/30">
                    <Text className="text-xs text-success mb-1 font-medium uppercase tracking-widest">
                      Valor Aproximado
                    </Text>
                    <Text className="text-3xl font-bold text-success">
                      $ {conversionResult.toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
