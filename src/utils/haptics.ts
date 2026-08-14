import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

// expo-haptics não tem implementação web: `requireOptionalNativeModule` devolve
// null e cada função lança UnavailabilityError. Como os toques disparam sem
// await, isso virava unhandled rejection a cada interação no navegador.
// Este módulo é o único ponto que fala com o expo-haptics; a superfície é
// idêntica, então os call sites continuam iguais.
const supported = Platform.OS === "ios" || Platform.OS === "android";

export const ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = Haptics.NotificationFeedbackType;

export async function impactAsync(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium,
): Promise<void> {
  if (!supported) return;
  // Vibração é enfeite: falha de hardware não pode derrubar a ação do usuário
  try {
    await Haptics.impactAsync(style);
  } catch {
    // silencioso de propósito
  }
}

export async function notificationAsync(
  type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType
    .Success,
): Promise<void> {
  if (!supported) return;
  try {
    await Haptics.notificationAsync(type);
  } catch {
    // silencioso de propósito
  }
}

export async function selectionAsync(): Promise<void> {
  if (!supported) return;
  try {
    await Haptics.selectionAsync();
  } catch {
    // silencioso de propósito
  }
}
