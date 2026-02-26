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
  TouchableWithoutFeedback,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { colors } from "../theme/colors";
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
      translateY.value = withSpring(0, { damping: 20, stiffness: 90 });
      opacity.value = withTiming(1, { duration: 300 });
    } else {
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 }, () => {
        runOnJS(setShowModal)(false);
      });
      opacity.value = withTiming(0, { duration: 300 });
    }
  }, [visible]);

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
    <Modal transparent visible={showModal} onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-end"
      >
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View
            className="absolute inset-0 bg-black/60"
            style={backdropStyle}
          />
        </TouchableWithoutFeedback>

        <Animated.View
          className="bg-white dark:bg-slate-900 rounded-t-3xl px-6 pt-3 pb-8 max-h-[85%] shadow-2xl"
          style={modalStyle}
        >
          <View className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full self-center mb-5 mt-2" />

          <View className="items-center justify-center mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
            <Text className="text-xl font-bold text-slate-800 dark:text-white text-center">
              {title}
            </Text>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerClassName="pb-5"
          >
            {children}

            {currencyCode && (
              <View className="mt-6 bg-gray-50 dark:bg-slate-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700">
                <Text className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider">
                  Simulador de Conversão
                </Text>

                <View className="flex-row items-center bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-gray-700 px-4 h-14 mb-4">
                  <Text className="text-base font-bold text-gray-500 mr-3 pr-3 border-r border-gray-200">
                    BRL
                  </Text>
                  <TextInput
                    className="flex-1 text-lg text-slate-800 dark:text-white font-regular"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor={colors.inactive}
                  />
                </View>

                <TouchableOpacity
                  className="bg-primary rounded-xl h-14 justify-center items-center shadow-md shadow-blue-500/20 active:bg-primaryDark"
                  onPress={handleConvert}
                  disabled={loadingConversion}
                  activeOpacity={0.8}
                >
                  {loadingConversion ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text className="text-white text-base font-bold">
                      Converter Agora
                    </Text>
                  )}
                </TouchableOpacity>

                {conversionResult !== null && (
                  <View className="mt-4 items-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-900">
                    <Text className="text-xs text-gray-500 dark:text-gray-300 mb-1">
                      Valor Aproximado
                    </Text>
                    <Text className="text-2xl font-bold text-green-600 dark:text-green-400">
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
