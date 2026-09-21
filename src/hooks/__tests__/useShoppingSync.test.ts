import { AppState } from "react-native";
import { act, renderHook } from "@testing-library/react-native";

import { useShoppingSync } from "../useShoppingSync";
import { useShoppingStore } from "../../store/shoppingStore";

jest.mock("../../services/api", () => ({ __esModule: true, default: {} }));

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (efeito: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(efeito, []);
  },
}));

describe("useShoppingSync", () => {
  let syncAll: jest.Mock;
  let ouvinte: ((estado: string) => void) | null;
  let remover: jest.Mock;

  beforeEach(() => {
    syncAll = jest.fn().mockResolvedValue(true);
    ouvinte = null;
    remover = jest.fn();
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation(((_evento: string, cb: (estado: string) => void) => {
        ouvinte = cb;
        return { remove: remover };
      }) as never);
    useShoppingStore.setState({ syncAll, hasHydrated: true } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sincroniza ao entrar em foco e ao hidratar", () => {
    renderHook(() => useShoppingSync());

    // Uma pelo foco (dublê roda na montagem) e uma pela hidratação
    expect(syncAll).toHaveBeenCalledTimes(2);
  });

  it("antes de hidratar só o foco dispara — e depois a hidratação também", () => {
    useShoppingStore.setState({ hasHydrated: false } as never);
    renderHook(() => useShoppingSync());
    expect(syncAll).toHaveBeenCalledTimes(1);

    act(() => {
      useShoppingStore.setState({ hasHydrated: true } as never);
    });
    expect(syncAll).toHaveBeenCalledTimes(2);
  });

  it("voltar do segundo plano sincroniza; ir para o fundo não", () => {
    renderHook(() => useShoppingSync());
    syncAll.mockClear();

    act(() => ouvinte?.("background"));
    expect(syncAll).not.toHaveBeenCalled();

    act(() => ouvinte?.("active"));
    expect(syncAll).toHaveBeenCalledTimes(1);
  });

  it("desmontar solta o ouvinte do AppState", () => {
    const { unmount } = renderHook(() => useShoppingSync());
    unmount();
    expect(remover).toHaveBeenCalled();
  });
});
