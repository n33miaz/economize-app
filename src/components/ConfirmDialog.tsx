import React, { useCallback, useEffect, useState } from "react";
import { Modal, Platform, Text, TouchableOpacity, View } from "react-native";

import { useConfirmStore } from "../store/confirmStore";
import { useTheme } from "../theme/ThemeProvider";
import { radius, shadow, spacing } from "../theme/ds";

// Diálogo único do app, montado no App.tsx ao lado do Toast. Substitui o
// `Alert.alert`, que no react-native-web é um no-op silencioso. Estilo vem de
// `useTheme()` (e não de classes NativeWind) para nascer certo no tema claro.
export default function ConfirmDialog() {
  const t = useTheme();
  const request = useConfirmStore((s) => s.request);
  const dismiss = useConfirmStore((s) => s.dismiss);
  const [busy, setBusy] = useState(false);

  const visible = request !== null;

  const handleCancel = useCallback(() => {
    if (busy) return;
    request?.onCancel?.();
    dismiss();
  }, [busy, request, dismiss]);

  const handleConfirm = useCallback(async () => {
    if (!request || busy) return;
    try {
      // onConfirm pode ser async (excluir categoria vai à API): trava os
      // botões até resolver para não disparar a ação duas vezes
      setBusy(true);
      await request.onConfirm();
    } finally {
      setBusy(false);
      dismiss();
    }
  }, [request, busy, dismiss]);

  // Esc cancela no navegador — no celular quem faz esse papel é o botão voltar,
  // já tratado pelo onRequestClose do Modal
  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleCancel();
      if (event.key === "Enter") handleConfirm();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [visible, handleCancel, handleConfirm]);

  useEffect(() => {
    if (!visible) setBusy(false);
  }, [visible]);

  if (!request) return null;

  // Os dois fundos (danger e accent) foram validados contra text.inverse nos
  // dois temas na tabela de contraste do design system
  const confirmColor = request.destructive ? t.semantic.danger : t.accent.neon;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          backgroundColor: t.background.overlay,
          alignItems: "center",
          justifyContent: "center",
          padding: spacing[5],
        }}
      >
        {/* Toque fora cancela, mesmo contrato do sheet */}
        <TouchableOpacity
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          activeOpacity={1}
          onPress={handleCancel}
          accessibilityLabel={request.cancelLabel ?? "Cancelar"}
        />
        <View
          accessibilityViewIsModal
          style={[
            {
              width: "100%",
              maxWidth: 420,
              backgroundColor: t.background.elevated,
              borderRadius: radius["2xl"],
              borderWidth: 1,
              borderColor: t.border.default,
              padding: spacing[6],
            },
            shadow.lg,
          ]}
        >
          <Text
            style={{
              color: t.text.primary,
              fontFamily: "Roboto_700Bold",
              fontSize: 18,
              marginBottom: request.message ? spacing[2] : spacing[5],
            }}
          >
            {request.title}
          </Text>

          {request.message ? (
            <Text
              style={{
                color: t.text.secondary,
                fontFamily: "Roboto_400Regular",
                fontSize: 14,
                lineHeight: 20,
                marginBottom: spacing[5],
              }}
            >
              {request.message}
            </Text>
          ) : null}

          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              gap: spacing[3],
            }}
          >
            <TouchableOpacity
              onPress={handleCancel}
              disabled={busy}
              activeOpacity={0.85}
              accessibilityRole="button"
              style={{
                paddingHorizontal: spacing[5],
                paddingVertical: spacing[3],
                borderRadius: radius.full,
                borderWidth: 1,
                borderColor: t.border.default,
                opacity: busy ? 0.5 : 1,
              }}
            >
              <Text
                style={{
                  color: t.text.secondary,
                  fontFamily: "Roboto_700Bold",
                  fontSize: 14,
                }}
              >
                {request.cancelLabel ?? "Cancelar"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleConfirm}
              disabled={busy}
              activeOpacity={0.85}
              accessibilityRole="button"
              style={{
                paddingHorizontal: spacing[5],
                paddingVertical: spacing[3],
                borderRadius: radius.full,
                backgroundColor: confirmColor,
                opacity: busy ? 0.6 : 1,
              }}
            >
              <Text
                style={{
                  color: t.text.inverse,
                  fontFamily: "Roboto_700Bold",
                  fontSize: 14,
                }}
              >
                {request.confirmLabel ?? "Confirmar"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
