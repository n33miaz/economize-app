import React, { useEffect, useId, useMemo, useState } from "react";
import {
  View,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
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
import { useWebKeyboardInset } from "../hooks/useWebKeyboardInset";
import { useOverlayStore } from "../store/overlayStore";

// Teto do diálogo na tela larga: cabe o conteúdo de qualquer folha do app sem
// esticar a linha de leitura (mesma ordem de grandeza das colunas da grade)
const DIALOG_MAX_WIDTH = 560;

interface CustomModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * A folha de baixo do app — e a correção do defeito que a deixava inerte.
 *
 * <p><b>O que o dono via.</b> Tocar no pote não abria nada. Confirmar "Sair"
 * desenhava uns cacos no canto superior esquerdo. Abrir os detalhes de um
 * lançamento, o mesmo. Três sintomas, uma causa só — e nenhuma das duas
 * hipóteses anteriores (a `elevation` do toast, o pin de dependência) era
 * ela. As duas foram testadas e DESCARTADAS; ficam registradas para ninguém
 * repetir.
 *
 * <p><b>A causa está no `Modal` do Android na nova arquitetura</b>, e a
 * história completa — com tudo o que foi testado e não resolveu — mora em
 * `store/overlayStore.ts`. Em uma linha: a janela do modal nasce sem tamanho
 * e o conteúdo não recebe toque. Por isso a folha aqui deixou de ser janela
 * do sistema e virou camada do app, entregue ao `OverlayHost`.
 *
 * <p><b>Sem host na árvore, desenha no lugar.</b> É o caminho dos testes de
 * unidade, que montam um componente sozinho e esperam ler o texto dele.
 */
export default function CustomModal({
  visible,
  onClose,
  children,
}: CustomModalProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { isWide } = useBreakpoint();
  // Teclado do NAVEGADOR: o `KeyboardAvoidingView` abaixo é no-op na web, e a
  // folha de nova transação ficava com o campo em foco atrás das teclas no
  // iPhone. O inset só é diferente de zero enquanto o teclado está aberto —
  // ou seja, enquanto há um campo em foco — e vai para o `paddingBottom` da
  // folha, que é exatamente o que o KAV faria no iOS. No nativo o hook
  // devolve zero e nada muda.
  const keyboardInset = useWebKeyboardInset();
  const [showModal, setShowModal] = useState(visible);
  const backdropOpacity = useSharedValue(0);
  const modalTranslateY = useSharedValue(500);

  const hostMounted = useOverlayStore((s) => s.hostMounted);
  const mountLayer = useOverlayStore((s) => s.mount);
  const unmountLayer = useOverlayStore((s) => s.unmount);
  const layerId = useId();

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
    // Os dois valores compartilhados são estáveis (useSharedValue); estão na
    // lista pelo lint, e não redisparam a coreografia
  }, [visible, reducedMotion, backdropOpacity, modalTranslateY]);

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

  // `useMemo` e não uma expressão solta: a camada é reenviada ao host por um
  // efeito, e uma árvore recriada a cada render faria o efeito disparar
  // sempre. Com a lista de dependências certa, só re-envia quando algo do
  // conteúdo muda de verdade — inclusive `children`, que é a razão de a folha
  // conseguir mostrar dado novo sem fechar.
  const conteudo = useMemo(
    () =>
      showModal ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          {/* Backdrop */}
          <Animated.View
            style={[
              {
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: t.background.overlay,
              },
              backdropAnimatedStyle,
            ]}
          >
            {/* Fora do alcance do leitor de tela de propósito: é uma área do
              tamanho da tela, e anunciá-la como botão faria o VoiceOver ler
              "botão" sobre tudo o que não é o sheet. Quem navega por leitor
              fecha pelo X do próprio sheet, que tem rótulo */}
            <TouchableOpacity
              style={{ flex: 1 }}
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
            style={[
              { flex: 1 },
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
              testID="custom-modal-sheet"
              style={[
                {
                  backgroundColor: t.background.surface,
                  borderTopLeftRadius: radius["3xl"],
                  borderTopRightRadius: radius["3xl"],
                  maxHeight: "90%",
                  paddingBottom: insets.bottom + keyboardInset,
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
      ) : null,
    [
      showModal,
      children,
      isWide,
      onClose,
      insets.bottom,
      keyboardInset,
      t,
      backdropAnimatedStyle,
      modalAnimatedStyle,
    ],
  );

  // Com host: a folha vira camada do app, desenhada acima da barra de abas.
  // A camada é reenviada a cada render porque o conteúdo é JSX de quem chamou
  // — é o preço de o React Native não ter portal de verdade
  useEffect(() => {
    if (!hostMounted) return;
    if (conteudo) mountLayer(layerId, conteudo);
    else unmountLayer(layerId);
  }, [hostMounted, conteudo, layerId, mountLayer, unmountLayer]);

  // Tela desmontada com a folha aberta (navegar embora, sair da conta) não
  // pode deixar a camada órfã pairando sobre o app
  useEffect(() => () => unmountLayer(layerId), [layerId, unmountLayer]);

  if (hostMounted) return null;
  if (!conteudo) return null;

  return (
    <View
      style={[
        { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
        boxNone,
      ]}
    >
      {conteudo}
    </View>
  );
}
