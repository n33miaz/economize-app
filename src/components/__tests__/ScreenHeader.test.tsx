import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import ScreenHeader from "../ScreenHeader";

// O cabeçalho decide sozinho se mostra a seta: precisa saber em que tipo de
// navegador está. O mock troca o estado por teste sem montar navegação real.
const mockNavigation = {
  getState: jest.fn(),
  canGoBack: jest.fn(),
  goBack: jest.fn(),
  navigate: jest.fn(),
};
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
}));
const navigation = mockNavigation;

describe("ScreenHeader — seta de voltar", () => {
  beforeEach(() => {
    navigation.getState.mockReset();
    navigation.canGoBack.mockReset();
    navigation.goBack.mockReset();
  });

  it("aparece numa tela empilhada com histórico e volta ao toque", () => {
    // Na web a tela empilhada cobre a barra de abas e não há botão do
    // sistema: sem a seta a pessoa fica presa na Análise
    navigation.getState.mockReturnValue({ type: "stack" });
    navigation.canGoBack.mockReturnValue(true);
    const { getByLabelText } = render(<ScreenHeader title="Análise" />);
    fireEvent.press(getByLabelText("Voltar"));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it("não aparece na raiz de uma aba", () => {
    navigation.getState.mockReturnValue({ type: "tab" });
    navigation.canGoBack.mockReturnValue(true);
    const { queryByLabelText } = render(<ScreenHeader title="Finanças" />);
    expect(queryByLabelText("Voltar")).toBeNull();
  });

  it("não aparece na primeira tela da pilha, sem histórico", () => {
    navigation.getState.mockReturnValue({ type: "stack" });
    navigation.canGoBack.mockReturnValue(false);
    const { queryByLabelText } = render(<ScreenHeader title="Início" />);
    expect(queryByLabelText("Voltar")).toBeNull();
  });

  it("a prop explícita vence a detecção automática", () => {
    navigation.getState.mockReturnValue({ type: "stack" });
    navigation.canGoBack.mockReturnValue(true);
    const { queryByLabelText } = render(
      <ScreenHeader title="Revisão" showBackButton={false} />,
    );
    expect(queryByLabelText("Voltar")).toBeNull();
  });
});
