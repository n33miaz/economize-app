import { act, renderHook } from "@testing-library/react-native";

import { usePremiumOffer } from "../usePremiumOffer";
import { usePlanStore } from "../../store/planStore";
import { usePreferencesStore } from "../../store/preferencesStore";
import { useUserStore } from "../../store/userStore";
import { APP_ROUTES, MAIN_TAB_ROUTES } from "../../routes/routeNames";

jest.mock("../../services/api", () => ({
  getPlans: jest.fn(),
  registerPlanInterest: jest.fn(),
  getUserMe: jest.fn(),
  updateUserMe: jest.fn(),
}));

let mockRota: string = MAIN_TAB_ROUTES.principal;
jest.mock("@react-navigation/native", () => ({
  useRoute: () => ({ name: mockRota, params: {} }),
}));

const PERFIL = {
  id: "u1",
  name: "Alice",
  email: "alice@example.com",
  createdAt: "2026-01-10T10:00:00Z",
  lastLoginAt: null,
};

/**
 * O hook que as telas de destino chamam. As regras estão em
 * `utils/premiumOffer`; aqui o que se prova é o encaixe: espera o perfil,
 * respeita o respiro, marca a exibição e se recusa em tela de tarefa.
 */
describe("usePremiumOffer", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockRota = MAIN_TAB_ROUTES.principal;
    usePreferencesStore.getState().reset();
    usePreferencesStore.setState({ hasHydrated: true, sessionCount: 5 });
    usePlanStore.getState().reset();
    useUserStore.setState({ me: PERFIL } as never);
  });

  afterEach(() => jest.useRealTimers());

  it("sobe depois do respiro, e marca a exibição", () => {
    const { result } = renderHook(() => usePremiumOffer());

    expect(result.current.visible).toBe(false);
    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(result.current.visible).toBe(true);
    expect(usePreferencesStore.getState().plusOfferLastShownAt).not.toBeNull();
  });

  it("fechar não reabre na mesma sessão", () => {
    const { result } = renderHook(() => usePremiumOffer());
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(result.current.visible).toBe(true);

    act(() => result.current.close());
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(result.current.visible).toBe(false);
  });

  it("espera o perfil chegar", () => {
    useUserStore.setState({ me: null } as never);
    const { result } = renderHook(() => usePremiumOffer());

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.current.visible).toBe(false);

    act(() => {
      useUserStore.setState({ me: PERFIL } as never);
    });
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(result.current.visible).toBe(true);
  });

  it("nas duas primeiras sessões, nada", () => {
    usePreferencesStore.setState({ sessionCount: 2 });
    const { result } = renderHook(() => usePremiumOffer());

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(result.current.visible).toBe(false);
  });

  it("em tela de tarefa se recusa sozinho", () => {
    mockRota = APP_ROUTES.revisao;
    const { result } = renderHook(() => usePremiumOffer());

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(result.current.visible).toBe(false);
  });

  it("para o Plus, nunca", () => {
    usePlanStore.setState({ plan: "PLUS", adsEnabled: false });
    const { result } = renderHook(() => usePremiumOffer());

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(result.current.visible).toBe(false);
  });
});
