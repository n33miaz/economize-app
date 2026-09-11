import { act, renderHook } from "@testing-library/react-native";

import {
  LOADING_DEADLINE_MS,
  useLoadingDeadline,
} from "../useLoadingDeadline";

/**
 * EC-216 — o esqueleto tem prazo.
 *
 * No concorrente, duas abas (Faturas e Limites) nunca terminavam de carregar:
 * ficavam no esqueleto animado, para sempre, sem erro e sem botão. Um
 * esqueleto é a promessa "está vindo"; passado um tempo, vira mentira — e
 * mentira animada é pior que erro, porque erro tem saída.
 */
describe("Prazo do esqueleto", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("no começo do carregamento, ninguém reclama", () => {
    const { result } = renderHook(() => useLoadingDeadline(true));

    expect(result.current).toBe(false);
  });

  it("um carregamento normal termina muito antes do prazo", () => {
    const { result, rerender } = renderHook(
      ({ carregando }) => useLoadingDeadline(carregando),
      { initialProps: { carregando: true } },
    );

    // as medidas em campo ficam abaixo de 2 s
    act(() => { jest.advanceTimersByTime(1_800); });
    rerender({ carregando: false });

    expect(result.current).toBe(false);
  });

  it("passado o prazo com o carregamento em pé, a tela para de prometer", () => {
    const { result } = renderHook(() => useLoadingDeadline(true));

    act(() => { jest.advanceTimersByTime(LOADING_DEADLINE_MS + 1); });

    expect(result.current).toBe(true);
  });

  it("na borda exata do prazo ainda não estourou", () => {
    const { result } = renderHook(() => useLoadingDeadline(true));

    act(() => { jest.advanceTimersByTime(LOADING_DEADLINE_MS - 1); });

    expect(result.current).toBe(false);
  });

  it("terminar depois do prazo apaga o aviso", () => {
    // Sem isto, um retry bem-sucedido deixaria "está demorando" na tela
    const { result, rerender } = renderHook(
      ({ carregando }) => useLoadingDeadline(carregando),
      { initialProps: { carregando: true } },
    );
    act(() => { jest.advanceTimersByTime(LOADING_DEADLINE_MS + 1); });
    expect(result.current).toBe(true);

    rerender({ carregando: false });

    expect(result.current).toBe(false);
  });

  it("o prazo recomeça a cada carregamento novo", () => {
    const { result, rerender } = renderHook(
      ({ carregando }) => useLoadingDeadline(carregando),
      { initialProps: { carregando: true } },
    );
    act(() => { jest.advanceTimersByTime(LOADING_DEADLINE_MS + 1); });
    rerender({ carregando: false });
    rerender({ carregando: true });

    // o segundo carregamento tem o prazo inteiro dele, não o resto do primeiro
    act(() => { jest.advanceTimersByTime(1_000); });
    expect(result.current).toBe(false);

    act(() => { jest.advanceTimersByTime(LOADING_DEADLINE_MS); });
    expect(result.current).toBe(true);
  });

  it("bloco pequeno pode pedir prazo mais curto", () => {
    const { result } = renderHook(() => useLoadingDeadline(true, 3_000));

    act(() => { jest.advanceTimersByTime(3_001); });

    expect(result.current).toBe(true);
  });

  it("sem carregamento nenhum, nunca estoura", () => {
    const { result } = renderHook(() => useLoadingDeadline(false));

    act(() => { jest.advanceTimersByTime(60_000); });

    expect(result.current).toBe(false);
  });
});
