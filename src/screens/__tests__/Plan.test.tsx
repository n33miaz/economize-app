import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import Plan from "../Plan";
import { getPlans, registerPlanInterest } from "../../services/api";
import { usePlanStore } from "../../store/planStore";
import { usePreferencesStore } from "../../store/preferencesStore";
import { useToastStore } from "../../store/toastStore";

import type { PlansResponse } from "../../services/api";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {},
  getPlans: jest.fn(),
  registerPlanInterest: jest.fn(),
}));

// O PageContainer e o ScreenHeader consultam a navegação; sem estas portas o
// componente estoura antes de qualquer asserção
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({ index: 1, routes: [{ name: "Profile" }, { name: "Plano" }] }),
  }),
  useRoute: () => ({ params: {} }),
  useIsFocused: () => true,
  useFocusEffect: (efeito: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(efeito, []);
  },
}));

const mockPlans = getPlans as jest.MockedFunction<typeof getPlans>;
const mockInterest = registerPlanInterest as jest.MockedFunction<
  typeof registerPlanInterest
>;

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Plan />
    </SafeAreaProvider>,
  );

const CATALOGO: PlansResponse = {
  current: "FREE",
  plans: [
    { id: "FREE", name: "Gratuito", priceMonthly: 0, features: ["Extrato e análise"] },
    { id: "PLUS", name: "Plus", priceMonthly: 9.9, features: ["Sem anúncios"] },
  ],
  checkoutAvailable: false,
  interestRegistered: false,
  // Conta gratuita: sem prazo e sem cancelamento (EC-208)
  activeUntil: null,
  cancelledAt: null,
};

/**
 * A tela do plano: qual é o meu, o que o Plus dá a mais, e a frase honesta
 * de que ainda não se paga por ele.
 */
describe("Plan", () => {
  let showToastSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    usePlanStore.getState().reset();
    usePreferencesStore.getState().reset();
    showToastSpy = jest
      .spyOn(useToastStore.getState(), "showToast")
      .mockImplementation(() => {});
  });

  afterEach(() => showToastSpy.mockRestore());

  it("mostra o plano atual, a comparação e a nota honesta", async () => {
    mockPlans.mockResolvedValue(CATALOGO);

    const { getByText, getAllByText, getByLabelText } = montar();

    await waitFor(() => expect(getByText("Sem anúncios")).toBeTruthy());
    expect(getByText("Plano")).toBeTruthy();
    expect(getByText("Seu plano")).toBeTruthy();
    expect(getAllByText("Gratuito").length).toBeGreaterThan(0);
    expect(getByText("Extrato e análise")).toBeTruthy();
    expect(getByText(/9,90\/mês/)).toBeTruthy();
    expect(getByLabelText("Tenho interesse")).toBeTruthy();
    expect(
      getByText("Pagamento ainda não disponível — estamos medindo o interesse."),
    ).toBeTruthy();
  });

  it("'Tenho interesse' registra e vira 'Interesse registrado'", async () => {
    mockPlans.mockResolvedValue(CATALOGO);
    mockInterest.mockResolvedValue();

    const { getByLabelText } = montar();
    await waitFor(() => expect(getByLabelText("Tenho interesse")).toBeTruthy());

    fireEvent.press(getByLabelText("Tenho interesse"));

    await waitFor(() => expect(getByLabelText("Interesse registrado")).toBeTruthy());
    expect(mockInterest).toHaveBeenCalledWith("PLUS");
    expect(usePreferencesStore.getState().plusInterestAt).not.toBeNull();
    expect(showToastSpy).toHaveBeenCalledWith(expect.stringMatching(/Avisaremos/), "success");
  });

  it("servidor sem a rota de planos: a tela ainda compara, com a promessa padrão", async () => {
    mockPlans.mockRejectedValue(new Error("404"));

    const { getByText, getByLabelText } = montar();

    await waitFor(() => expect(getByLabelText("Tenho interesse")).toBeTruthy());
    expect(getByText("Tudo do gratuito")).toBeTruthy();
  });

  it("quem é Plus não recebe convite — vê que está sem anúncios", async () => {
    mockPlans.mockResolvedValue({ ...CATALOGO, current: "PLUS" });
    usePlanStore.setState({
      plan: "PLUS",
      planUntil: "2026-12-31T00:00:00Z",
      adsEnabled: false,
    });

    const { getByText, queryByLabelText } = montar();

    await waitFor(() => expect(getByText(/válido até/)).toBeTruthy());
    expect(queryByLabelText("Tenho interesse")).toBeNull();
    expect(getByText("SEU PLANO")).toBeTruthy();
  });
});
