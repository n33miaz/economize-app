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
    <Modal
      transparent
      visible={showModal}
      onRequestClose={handleClose}
      animationType="none"
    >
      <Animated.View
        className="absolute inset-0 bg-slate-900/60"
        style={backdropStyle}
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
          className="bg-white rounded-t-[32px] px-6 pt-3 pb-10 max-h-[90%]"
          style={modalStyle}
        >
          <View className="w-14 h-1.5 bg-slate-200 rounded-full self-center mb-6 mt-2" />
          <View className="items-center justify-center mb-6 border-b border-slate-100 pb-4">
            <Text className="text-2xl font-bold text-slate-800 text-center">
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
              <View className="mt-6 bg-slate-50 p-5 rounded-3xl border border-slate-200">
                <Text className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-widest">
                  Simulador de Conversão
                </Text>
                <View className="flex-row items-center bg-white rounded-2xl border border-slate-200 px-4 h-16 mb-4">
                  <Text className="text-base font-bold text-slate-400 mr-3 pr-3 border-r border-slate-100">
                    BRL
                  </Text>
                  <TextInput
                    className="flex-1 text-xl text-slate-800 font-bold h-full"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor={colors.inactive}
                  />
                </View>
                <TouchableOpacity
                  className="bg-primary rounded-2xl h-16 justify-center items-center active:bg-primaryDark"
                  onPress={handleConvert}
                  disabled={loadingConversion}
                >
                  {loadingConversion ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text className="text-white text-lg font-bold">
                      Converter Agora
                    </Text>
                  )}
                </TouchableOpacity>
                {conversionResult !== null && (
                  <View className="mt-5 items-center p-5 bg-green-50 rounded-2xl border border-green-100">
                    <Text className="text-xs text-green-600 mb-1 font-medium uppercase tracking-widest">
                      Valor Aproximado
                    </Text>
                    <Text className="text-3xl font-bold text-green-700">
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
