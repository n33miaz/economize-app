import { act, renderHook } from "@testing-library/react-native";

import { useWaitingLine } from "../useWaitingLine";
import { LOADING_DEADLINE_MS } from "../useLoadingDeadline";
import { WAITING_STEP_MS, waitingLines } from "../../utils/waitingLines";

/**
 * EC-224 + EC-216 juntos: a legenda tem voz E tem prazo.
 */
describe("Legenda que troca sozinha", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("sem trabalho em andamento, não diz nada", () => {
    const { result } = renderHook(() => useWaitingLine("import", false));

    expect(result.current).toBeNull();
  });

  it("começa na primeira frase da sequência", () => {
    const { result } = renderHook(() => useWaitingLine("import", true));

    expect(result.current).toBe(waitingLines("import")[0]);
  });

  it("troca de frase sozinha, na ordem do trabalho", () => {
    const { result } = renderHook(() => useWaitingLine("import", true));

    act(() => { jest.advanceTimersByTime(WAITING_STEP_MS + 50); });

    expect(result.current).toBe(waitingLines("import")[1]);
  });

  it("passado o prazo, para de prometer", () => {
    const { result } = renderHook(() => useWaitingLine("import", true));

    act(() => { jest.advanceTimersByTime(LOADING_DEADLINE_MS + WAITING_STEP_MS); });

    expect(result.current).toBe("está demorando mais do que deveria");
  });

  it("terminar zera tudo, e o próximo trabalho começa do início", () => {
    const { result, rerender } = renderHook(
      ({ ativo }) => useWaitingLine("sync", ativo),
      { initialProps: { ativo: true } },
    );
    act(() => { jest.advanceTimersByTime(WAITING_STEP_MS * 3); });
    rerender({ ativo: false });
    expect(result.current).toBeNull();

    rerender({ ativo: true });

    expect(result.current).toBe(waitingLines("sync")[0]);
  });

  it("cada trabalho tem a sua sequência", () => {
    const { result } = renderHook(() => useWaitingLine("assistant", true));

    expect(result.current).toBe(waitingLines("assistant")[0]);
  });
});
