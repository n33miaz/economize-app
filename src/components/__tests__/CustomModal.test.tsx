import React from "react";
import { Keyboard, Text } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import CustomModal from "../CustomModal";
import { useKeyboardVisible } from "../../hooks/useKeyboardVisible";

jest.mock("../../hooks/useKeyboardVisible", () => ({
  useKeyboardVisible: jest.fn(() => false),
}));

const tecladoAberto = (aberto: boolean) =>
  (useKeyboardVisible as jest.Mock).mockReturnValue(aberto);

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * O fundo escuro nasce em `opacity: 0` (a entrada é animada) e é marcado
 * como invisível ao leitor de tela de propósito — os dois fazem a busca
 * padrão do testing-library pular por cima dele.
 */
const fundo = (tela: ReturnType<typeof render>) =>
  tela.getByTestId("modal-backdrop", { includeHiddenElements: true });

const comArea = (no: React.ReactNode) => (
  <SafeAreaProvider initialMetrics={METRICAS}>{no}</SafeAreaProvider>
);

function montar() {
  const onClose = jest.fn();
  const tela = render(
    comArea(
      <CustomModal visible onClose={onClose}>
        <Text>conteúdo da folha</Text>
      </CustomModal>,
    ),
  );
  return { tela, onClose };
}

describe("CustomModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tecladoAberto(false);
  });

  it("desenha o conteúdo de quem a abriu", () => {
    const { tela } = montar();
    expect(tela.getByText("conteúdo da folha")).toBeTruthy();
  });

  it("sem teclado, o toque no fundo fecha a folha", () => {
    const { tela, onClose } = montar();
    fireEvent.press(fundo(tela));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("COM teclado, o toque no fundo fecha só o teclado — o rascunho fica", () => {
    // O toque que custava o item inteiro: com o teclado aberto sobra pouco
    // fundo, e é nele que o dedo cai para "ver a lista"
    const dismiss = jest.spyOn(Keyboard, "dismiss").mockImplementation(() => {});
    tecladoAberto(true);

    const { tela, onClose } = montar();
    fireEvent.press(fundo(tela));

    expect(dismiss).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(tela.getByText("conteúdo da folha")).toBeTruthy();
    dismiss.mockRestore();
  });

  it("a alça diz que arrasta — ela deixou de ser enfeite", () => {
    const { tela } = montar();
    expect(tela.getByLabelText("Puxe para baixo para fechar")).toBeTruthy();
  });

  it("fechada, não desenha nada", () => {
    const tela = render(
      comArea(
        <CustomModal visible={false} onClose={jest.fn()}>
          <Text>conteúdo da folha</Text>
        </CustomModal>,
      ),
    );
    expect(tela.queryByText("conteúdo da folha")).toBeNull();
  });
});
