import { act, renderHook, waitFor } from "@testing-library/react-native";

import { usePullToRefresh } from "../usePullToRefresh";
import * as Haptics from "../../utils/haptics";

jest.mock("../../utils/haptics", () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: "success" },
}));

describe("Puxar para atualizar", () => {
  beforeEach(() => jest.clearAllMocks());

  it("chama o recarregamento e volta ao repouso", async () => {
    const recarregar = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePullToRefresh(recarregar));

    await act(async () => { await result.current.refresh(); });

    expect(recarregar).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.refreshing).toBe(false));
  });

  it("dedo que escorrega NÃO dispara duas requisições", async () => {
    let liberar: (() => void) | null = null;
    const recarregar = jest.fn(
      () => new Promise<void>((resolve) => { liberar = resolve; }),
    );
    const { result } = renderHook(() => usePullToRefresh(recarregar));

    act(() => { void result.current.refresh(); });
    await act(async () => { await result.current.refresh(); });

    expect(recarregar).toHaveBeenCalledTimes(1);
    await act(async () => { liberar?.(); });
  });

  it("o toque tátil vem no FIM, não no gesto", async () => {
    // Vibrar no gesto confirmaria que o dedo funcionou, coisa que o próprio
    // spinner já diz. Vibrar no fim é o que o usuário não sabe de outro jeito
    const recarregar = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePullToRefresh(recarregar));

    await act(async () => { await result.current.refresh(); });

    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });

  it("falha ao recarregar não trava o spinner nem vibra sucesso", async () => {
    const recarregar = jest.fn().mockRejectedValue(new Error("sem rede"));
    const { result } = renderHook(() => usePullToRefresh(recarregar));

    await act(async () => { await result.current.refresh(); });

    await waitFor(() => expect(result.current.refreshing).toBe(false));
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it("recarregamento síncrono também funciona", async () => {
    const recarregar = jest.fn();
    const { result } = renderHook(() => usePullToRefresh(recarregar));

    await act(async () => { await result.current.refresh(); });

    expect(recarregar).toHaveBeenCalled();
  });
});
