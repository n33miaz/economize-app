import React from "react";
import { StyleSheet } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";

import AdSlot from "../AdSlot";
import { usePlanStore } from "../../store/planStore";
import { HOUSE_ADS, resetHouseAdRotation } from "../../utils/ads";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

/**
 * O espaço de anúncio.
 *
 * <p>Três garantias, e são as que fazem o anúncio ser aceitável: some por
 * completo para quem não tem anúncios (nem o espaço fica), está sempre
 * rotulado como publicidade e tem altura fixa — nada pula quando ele entra.
 */
describe("AdSlot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetHouseAdRotation();
    usePlanStore.getState().reset();
  });

  it("some por completo quando a conta não tem anúncios", () => {
    usePlanStore.setState({ plan: "PLUS", adsEnabled: false });

    const { toJSON } = render(<AdSlot />);

    // `null`, e não um espaço vazio: o Plus não paga para ver um buraco
    expect(toJSON()).toBeNull();
  });

  it("aparece para o gratuito, rotulado como publicidade", () => {
    usePlanStore.setState({ plan: "FREE", adsEnabled: true });

    const { getByText, getByRole } = render(<AdSlot />);

    expect(getByText("Publicidade")).toBeTruthy();
    expect(getByText(HOUSE_ADS[0].title)).toBeTruthy();
    expect(getByRole("button")).toBeTruthy();
  });

  it("tem altura fixa por variante — o conteúdo debaixo não pula", () => {
    const banner = render(<AdSlot />);
    expect(StyleSheet.flatten(banner.getByRole("button").props.style).height).toBe(64);

    const card = render(<AdSlot variant="card" />);
    expect(StyleSheet.flatten(card.getByRole("button").props.style).height).toBe(120);
  });

  it("cada montagem mostra o próximo cartão; o que está na tela não troca", () => {
    const primeiro = render(<AdSlot />);
    const segundo = render(<AdSlot />);

    expect(primeiro.getByText(HOUSE_ADS[0].title)).toBeTruthy();
    expect(segundo.getByText(HOUSE_ADS[1].title)).toBeTruthy();

    primeiro.rerender(<AdSlot />);
    expect(primeiro.getByText(HOUSE_ADS[0].title)).toBeTruthy();
  });

  it("o toque leva para onde o cartão promete", () => {
    const { getByRole } = render(<AdSlot />);

    fireEvent.press(getByRole("button"));

    expect(mockNavigate).toHaveBeenCalledWith({
      name: HOUSE_ADS[0].route.name,
      params: HOUSE_ADS[0].route.params,
    });
  });

  it("os cartões da casa só apontam para dentro do app", () => {
    // Nenhum deles é link externo: anúncio da casa é atalho para o produto
    HOUSE_ADS.forEach((ad) => {
      expect(ad.route.name).not.toMatch(/^https?:/);
      expect(ad.title.length).toBeGreaterThan(0);
      expect(ad.cta.length).toBeGreaterThan(0);
    });
    expect(new Set(HOUSE_ADS.map((ad) => ad.id)).size).toBe(HOUSE_ADS.length);
  });
});
