import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import IndicatorCard from "../IndicatorCard";

describe("IndicatorCard Component", () => {
  const mockProps = {
    name: "Dólar Americano/Real Brasileiro",
    id: "currency_USD",
    value: 5.25,
    variation: 1.5,
    isFavorite: false,
    onPress: jest.fn(),
    onToggleFavorite: jest.fn(),
    symbol: "R$",
  };

  it("deve renderizar corretamente o nome e o valor formatado", () => {
    const { getByText } = render(<IndicatorCard {...mockProps} />);

    expect(getByText("Dólar Americano")).toBeTruthy();

    // vírgula, não ponto: o app inteiro é pt-BR e o cartão mostrava
    // "R$ 5.25" ao lado de valores formatados com vírgula
    expect(getByText("R$ 5,25")).toBeTruthy();
  });

  it("deve exibir a variação com a cor correta (verde para positivo)", () => {
    const { getByText } = render(<IndicatorCard {...mockProps} />);
    const variationText = getByText("+1,50%");

    expect(variationText).toBeTruthy();
  });

  it("deve chamar a função onPress ao clicar no card", () => {
    const { getByText } = render(<IndicatorCard {...mockProps} />);
    const cardTitle = getByText("Dólar Americano");

    fireEvent.press(cardTitle);
    expect(mockProps.onPress).toHaveBeenCalledTimes(1);
  });

  it("deve chamar onToggleFavorite ao clicar na estrela", () => {
    // O botão da estrela é localizado pelo rótulo de acessibilidade real,
    // garantindo que o toque no componente dispara o callback com o id certo
    const { getByLabelText } = render(<IndicatorCard {...mockProps} />);
    const starButton = getByLabelText(
      "Adicionar Dólar Americano aos favoritos",
    );

    fireEvent.press(starButton);
    expect(mockProps.onToggleFavorite).toHaveBeenCalledWith("currency_USD");
  });

  it("índice é pontuado pelo TIPO, mesmo sem símbolo", () => {
    // O Catálogo não passa `symbol`; o IBOVESPA saía "R$ 179.722,48"
    const { getByText } = render(
      <IndicatorCard
        {...mockProps}
        symbol={undefined}
        type="index"
        name="IBOVESPA"
        value={179722.48}
      />,
    );
    expect(getByText("179.722 pts")).toBeTruthy();
    expect(getByText("pontos")).toBeTruthy();
  });

  it("cotação abaixo de dez centavos ganha quatro casas", () => {
    // Peso argentino a R$ 0,0041 saía "R$ 0,00" ao lado de uma variação real
    const { getByText } = render(
      <IndicatorCard {...mockProps} name="Peso Argentino" value={0.0041} />,
    );
    expect(getByText("R$ 0,0041")).toBeTruthy();
  });
});
