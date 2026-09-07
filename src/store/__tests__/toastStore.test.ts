import { TOAST_DEDUPE_MS, useToastStore } from "../toastStore";

/**
 * O toast que não repete.
 *
 * Três telas falhando juntas no mesmo cold start mostravam três vezes a mesma
 * frase, uma por cima da outra. O que se prova aqui é que a mesma mensagem
 * não volta dentro da janela, que mensagem diferente passa, e que um toast
 * novo não é apagado pelo relógio do anterior.
 */
describe("toastStore", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-06T12:00:00Z"));
    useToastStore.getState().hideToast();
    useToastStore.setState({ lastMessage: "", lastShownAt: 0 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("mostra e some sozinho depois do tempo de leitura", () => {
    useToastStore.getState().showToast("Salvo.", "success");

    expect(useToastStore.getState()).toMatchObject({
      visible: true,
      message: "Salvo.",
      type: "success",
    });

    jest.advanceTimersByTime(4000);
    expect(useToastStore.getState().visible).toBe(false);
  });

  it("a mesma mensagem não repete dentro da janela", () => {
    useToastStore.getState().showToast("Você está offline.", "warning");
    jest.advanceTimersByTime(4000);
    expect(useToastStore.getState().visible).toBe(false);

    // Meio da janela: a repetição é engolida em silêncio
    jest.advanceTimersByTime(2000);
    useToastStore.getState().showToast("Você está offline.", "warning");
    expect(useToastStore.getState().visible).toBe(false);

    // Janela vencida: a frase pode voltar
    jest.advanceTimersByTime(TOAST_DEDUPE_MS);
    useToastStore.getState().showToast("Você está offline.", "warning");
    expect(useToastStore.getState().visible).toBe(true);
  });

  it("mensagem diferente passa na hora, mesmo dentro da janela", () => {
    useToastStore.getState().showToast("Salvo.", "success");
    jest.advanceTimersByTime(500);
    useToastStore.getState().showToast("Removido.", "success");

    expect(useToastStore.getState().message).toBe("Removido.");
    expect(useToastStore.getState().visible).toBe(true);
  });

  it("o relógio do toast anterior não apaga o novo antes da hora", () => {
    useToastStore.getState().showToast("Primeiro.", "info");
    jest.advanceTimersByTime(3000);
    useToastStore.getState().showToast("Segundo.", "info");

    // 4,5 s depois do primeiro: o relógio dele já bateu, mas o segundo tem o
    // tempo de leitura inteiro pela frente
    jest.advanceTimersByTime(1500);
    expect(useToastStore.getState().visible).toBe(true);
    expect(useToastStore.getState().message).toBe("Segundo.");

    jest.advanceTimersByTime(2600);
    expect(useToastStore.getState().visible).toBe(false);
  });

  it("hideToast fecha na hora e libera a mesma frase para depois da janela", () => {
    useToastStore.getState().showToast("Salvo.", "success");
    useToastStore.getState().hideToast();
    expect(useToastStore.getState().visible).toBe(false);

    jest.advanceTimersByTime(TOAST_DEDUPE_MS + 1);
    useToastStore.getState().showToast("Salvo.", "success");
    expect(useToastStore.getState().visible).toBe(true);
  });
});
