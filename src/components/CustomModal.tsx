import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  TouchableOpacity,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
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
import { useKeyboardVisible } from "../hooks/useKeyboardVisible";
import { useWebKeyboardInset } from "../hooks/useWebKeyboardInset";
import { useOverlayStore } from "../store/overlayStore";

// Teto do diálogo na tela larga: cabe o conteúdo de qualquer folha do app sem
// esticar a linha de leitura (mesma ordem de grandeza das colunas da grade)
const DIALOG_MAX_WIDTH = 560;

// Quanto a folha precisa descer, ou com que pressa, para o arrasto virar
// fechamento. 96 px e um gesto deliberado numa tela de 390; abaixo disso o
// polegar que rola a lista fecharia a folha sem querer.
const DRAG_CLOSE_DISTANCE = 96;
const DRAG_CLOSE_VELOCITY = 900;

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
  // Teclado NATIVO. Não move nada sozinho: serve para a folha decidir o que
  // um toque no fundo significa, e para ela ganhar altura enquanto o teclado
  // come metade da tela.
  const tecladoAberto = useKeyboardVisible();
  const [showModal, setShowModal] = useState(visible);
  const backdropOpacity = useSharedValue(0);
  const modalTranslateY = useSharedValue(500);
  // O que `visible` diz AGORA. A animação de fechar dura 300 ms, e o
  // callback dela chegava depois de a folha ter sido REABERTA nesse
  // intervalo — e a escondia. Visto na folha do carrinho de compras, que se
  // abre um toque depois de a tela montar: aparecia e sumia sozinha
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const jaMontou = useRef(false);

  const hostMounted = useOverlayStore((s) => s.hostMounted);
  const mountLayer = useOverlayStore((s) => s.mount);
  const unmountLayer = useOverlayStore((s) => s.unmount);
  const layerId = useId();

  // Só esconde se ninguém pediu para abrir enquanto a saída animava
  const esconderSeAindaFechada = useCallback(() => {
    if (!visibleRef.current) setShowModal(false);
  }, []);

  /**
   * O toque no fundo escuro — e o rascunho que ele custava.
   *
   * <p>Com o teclado aberto sobra pouco fundo, e é exatamente nessa hora que
   * a pessoa toca nele: para fechar o teclado e ver o que está por baixo. O
   * comportamento antigo fechava a folha inteira e jogava fora o item que
   * estava sendo digitado. Agora o primeiro toque fecha só o teclado; a
   * folha continua aberta com tudo no lugar, e o segundo toque fecha.
   */
  const tocarNoFundo = useCallback(() => {
    if (tecladoAberto) {
      Keyboard.dismiss();
      return;
    }
    onClose();
  }, [tecladoAberto, onClose]);

  // O gesto lê `onClose` por referência: sem isto, cada render do pai
  // recriaria o gesto, e recriar o gesto no meio do arrasto o cancela
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const fecharPeloArrasto = useCallback(() => {
    Keyboard.dismiss();
    onCloseRef.current();
  }, []);

  /**
   * Puxar a folha para baixo fecha — o que a alça sempre prometeu.
   *
   * <p>A alça no topo da folha existe desde o começo e não arrastava nada:
   * quem puxava ficava com a folha parada na mão. O gesto vive SÓ na faixa
   * da alça, e não na folha inteira, porque a folha inteira disputaria cada
   * rolagem da lista lá dentro com o dedo que quer rolar.
   *
   * <p>No diálogo centralizado da tela larga não há para onde arrastar, e o
   * gesto fica desligado.
   */
  const arrasto = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!isWide)
        .onUpdate((evento) => {
          // Só desce: puxar para cima não estica a folha
          modalTranslateY.value = Math.max(0, evento.translationY);
        })
        .onEnd((evento) => {
          const longe = evento.translationY > DRAG_CLOSE_DISTANCE;
          const rapido = evento.velocityY > DRAG_CLOSE_VELOCITY;
          if (longe || rapido) {
            runOnJS(fecharPeloArrasto)();
            return;
          }
          modalTranslateY.value = withSpring(0, sheetSpring);
        }),
    [isWide, modalTranslateY, fecharPeloArrasto],
  );

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
    } else if (jaMontou.current) {
      // Nascer fechada não é fechar: a saída animada só existe para uma
      // folha que estava aberta. Na montagem ela começava mesmo assim, e o
      // callback dela derrubava a folha aberta logo em seguida
      backdropOpacity.value = withTiming(0, { duration: motion.duration.base });
      modalTranslateY.value = withTiming(
        reducedMotion ? 0 : 500,
        { duration: motion.duration.base },
        () => {
          runOnJS(esconderSeAindaFechada)();
        },
      );
    }
    jaMontou.current = true;
    // Os dois valores compartilhados são estáveis (useSharedValue); estão na
    // lista pelo lint, e não redisparam a coreografia
  }, [
    visible,
    reducedMotion,
    backdropOpacity,
    modalTranslateY,
    esconderSeAindaFechada,
  ]);

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
          // No Android o `behavior="height"` descontava o teclado uma SEGUNDA
          // vez: a janela do app já encolhe sozinha (`adjustResize`), e a
          // camada da folha, que é absoluta de topo a rodapé, já nasce acima
          // do teclado. O desconto em dobro era o pulo que fazia o campo
          // fugir do dedo a cada tecla. Sem `behavior` o componente vira uma
          // `View` comum, que é o certo aqui.
          behavior={Platform.OS === "ios" ? "padding" : undefined}
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
              testID="modal-backdrop"
              style={{ flex: 1 }}
              onPress={tocarNoFundo}
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
                  // Com o teclado aberto o espaço disponível já caiu pela
                  // metade; guardar mais 10% dele para o fundo escuro era o
                  // que empurrava o botão de salvar para fora da tela
                  maxHeight: tecladoAberto ? "100%" : "90%",
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
                <GestureDetector gesture={arrasto}>
                  {/* A faixa inteira arrasta, não só os 4 px pintados: a alça
                    é um alvo de 40x4 e ninguém acerta isso com o polegar */}
                  <View
                    accessibilityRole="adjustable"
                    accessibilityLabel="Puxe para baixo para fechar"
                    style={{
                      paddingTop: 12,
                      paddingBottom: 8,
                      alignItems: "center",
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 4,
                        borderRadius: radius.full,
                        backgroundColor: t.border.default,
                      }}
                    />
                  </View>
                </GestureDetector>
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
      arrasto,
      tecladoAberto,
      tocarNoFundo,
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
