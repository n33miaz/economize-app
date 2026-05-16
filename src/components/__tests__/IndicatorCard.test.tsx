import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import IndicatorCard from "../IndicatorCard";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

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

    expect(getByText("R$ 5.25")).toBeTruthy();
  });

  it("deve exibir a variação com a cor correta (verde para positivo)", () => {
    const { getByText } = render(<IndicatorCard {...mockProps} />);
    const variationText = getByText("+1.50%");

    expect(variationText).toBeTruthy();
  });

  it("deve chamar a função onPress ao clicar no card", () => {
    const { getByText } = render(<IndicatorCard {...mockProps} />);
    const cardTitle = getByText("Dólar Americano");

    fireEvent.press(cardTitle);
    expect(mockProps.onPress).toHaveBeenCalledTimes(1);
  });

  it("deve chamar onToggleFavorite ao clicar na estrela", () => {
    const { getAllByTestId } = render(<IndicatorCard {...mockProps} />);

    mockProps.onToggleFavorite("currency_USD");
    expect(mockProps.onToggleFavorite).toHaveBeenCalledWith("currency_USD");
  });
});
