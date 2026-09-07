import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import PremiumOfferSheet from "../PremiumOfferSheet";
import { registerPlanInterest } from "../../services/api";
import { DEFAULT_PLANS, usePlanStore } from "../../store/planStore";
import { usePreferencesStore } from "../../store/preferencesStore";
import { useToastStore } from "../../store/toastStore";

jest.mock("../../services/api", () => ({
  getPlans: jest.fn(),
  registerPlanInterest: jest.fn(),
}));

const mockInterest = registerPlanInterest as jest.MockedFunction<
  typeof registerPlanInterest
>;

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** A folha vive dentro do CustomModal, que lê os insets da área segura. */
const montar = (props: { visible: boolean; onClose: () => void }) =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <PremiumOfferSheet {...props} />
    </SafeAreaProvider>,
  );

/**
 * A oferta do Plus.
 *
 * <p>O que os testes travam: cada botão tem uma consequência no silêncio da
 * oferta ("agora não" = 7 dias, "tenho interesse" = 30), e a folha nunca
 * finge que há pagamento.
 */
describe("PremiumOfferSheet", () => {
  let showToastSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    usePlanStore.getState().reset();
    usePlanStore.setState({ hasLoadedPlans: true, fetchPlans: jest.fn() } as never);
    usePreferencesStore.getState().reset();
    showToastSpy = jest
      .spyOn(useToastStore.getState(), "showToast")
      .mockImplementation(() => {});
  });

  afterEach(() => showToastSpy.mockRestore());

  it("fechada, não desenha nada", () => {
    const { queryByLabelText } = montar({ visible: false, onClose: jest.fn() });

    expect(queryByLabelText("Tenho interesse")).toBeNull();
  });

  it("aberta, diz o que o Plus dá, quanto custa e que ainda não se paga", () => {
    const { getByText } = montar({ visible: true, onClose: jest.fn() });

    expect(getByText("Economize! Plus")).toBeTruthy();
    const plus = DEFAULT_PLANS.find((p) => p.id === "PLUS")!;
    plus.features.forEach((feature) => expect(getByText(feature)).toBeTruthy());
    expect(getByText(/9,90\/mês/)).toBeTruthy();
    // A frase honesta: o que se pede é interesse, não cartão
    expect(
      getByText("Pagamento ainda não disponível — estamos medindo o interesse."),
    ).toBeTruthy();
  });

  it("busca o catálogo uma vez quando ainda não veio", () => {
    const fetchPlans = jest.fn();
    usePlanStore.setState({ hasLoadedPlans: false, fetchPlans } as never);

    montar({ visible: true, onClose: jest.fn() });

    expect(fetchPlans).toHaveBeenCalledTimes(1);
  });

  it("'Agora não' fecha e marca a exibição — sete dias de silêncio", () => {
    const onClose = jest.fn();
    const { getByLabelText } = montar({ visible: true, onClose });

    fireEvent.press(getByLabelText("Agora não"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(usePreferencesStore.getState().plusOfferLastShownAt).not.toBeNull();
    expect(usePreferencesStore.getState().plusInterestAt).toBeNull();
  });

  it("o X vale como 'agora não'", () => {
    const onClose = jest.fn();
    const { getByLabelText } = montar({ visible: true, onClose });

    fireEvent.press(getByLabelText("Fechar"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(usePreferencesStore.getState().plusOfferLastShownAt).not.toBeNull();
  });

  it("'Tenho interesse' registra no servidor, agradece e cala por 30 dias", async () => {
    mockInterest.mockResolvedValue();
    const onClose = jest.fn();
    const { getByLabelText } = montar({ visible: true, onClose });

    fireEvent.press(getByLabelText("Tenho interesse"));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mockInterest).toHaveBeenCalledWith("PLUS");
    expect(usePlanStore.getState().interestRegistered).toBe(true);
    expect(usePreferencesStore.getState().plusInterestAt).not.toBeNull();
    expect(showToastSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Avisaremos você/),
      "success",
    );
  });

  it("falha ao registrar avisa e NÃO fecha — a pessoa pode tentar de novo", async () => {
    mockInterest.mockRejectedValue(new Error("offline"));
    const onClose = jest.fn();
    const { getByLabelText } = montar({ visible: true, onClose });

    fireEvent.press(getByLabelText("Tenho interesse"));

    await waitFor(() =>
      expect(showToastSpy).toHaveBeenCalledWith(expect.any(String), "error"),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(usePreferencesStore.getState().plusInterestAt).toBeNull();
  });

  it("quem já registrou vê isso no botão, desligado", () => {
    usePlanStore.setState({ interestRegistered: true });

    const { getByLabelText, queryByLabelText } = montar({
      visible: true,
      onClose: jest.fn(),
    });

    expect(queryByLabelText("Tenho interesse")).toBeNull();
    expect(
      getByLabelText("Interesse registrado").props.accessibilityState?.disabled,
    ).toBe(true);
  });
});
