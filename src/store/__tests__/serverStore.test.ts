import axios from "axios";

import { healthUrlFrom, useServerStore, waitForServer } from "../serverStore";

jest.mock("axios", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const mockGet = (axios as unknown as { get: jest.Mock }).get;

/**
 * A espera pela API acordar (plano free do Render hiberna depois de ~15 min).
 *
 * <p>Sem este aviso o usuário só via o botão "Entrar" travado até estourar o
 * timeout — e o que se prova aqui é que a espera termina, que ela avisa a tela
 * enquanto dura, e que várias telas pedindo ao mesmo tempo não abrem várias
 * sondagens.
 */
describe("serverStore — acordar a API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useServerStore.setState({ isWaking: false, waitedSeconds: 0 });
  });

  it("a URL de saúde fica FORA do /api/v1 e não pede token", () => {
    expect(healthUrlFrom("https://economize-api.onrender.com/api/v1"))
      .toBe("https://economize-api.onrender.com/actuator/health");
    // com ou sem a barra final
    expect(healthUrlFrom("https://x.test/api/v1/")).toBe("https://x.test/actuator/health");
    // base que já não tem o prefixo continua válida
    expect(healthUrlFrom("http://localhost:8080")).toBe("http://localhost:8080/actuator/health");
  });

  it("respondeu de primeira: acordou, e a tela para de avisar", async () => {
    mockGet.mockResolvedValue({ status: 200 });

    await expect(waitForServer("http://x.test/actuator/health")).resolves.toBe(true);

    expect(useServerStore.getState().isWaking).toBe(false);
  });

  it("enquanto sonda, a tela sabe que está acordando", async () => {
    let liberar: (v: { status: number }) => void = () => {};
    mockGet.mockImplementationOnce(
      () => new Promise((resolve) => {
        liberar = resolve;
      }),
    );

    const espera = waitForServer("http://x.test/actuator/health");
    // a sondagem já começou: é isto que acende o aviso na tela de login
    expect(useServerStore.getState().isWaking).toBe(true);

    liberar({ status: 200 });
    await espera;
  });

  it("duas telas pedindo ao mesmo tempo compartilham UMA sondagem", async () => {
    mockGet.mockResolvedValue({ status: 200 });

    const [a, b] = await Promise.all([
      waitForServer("http://x.test/actuator/health"),
      waitForServer("http://x.test/actuator/health"),
    ]);

    expect(a).toBe(true);
    expect(b).toBe(true);
    // Várias telas disparam requisições ao mesmo tempo; cada uma abrindo a
    // própria sondagem multiplicaria o tráfego contra um servidor que já está
    // com dificuldade de subir
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("a sondagem seguinte é nova: o compartilhamento não fica preso", async () => {
    mockGet.mockResolvedValue({ status: 200 });

    await waitForServer("http://x.test/actuator/health");
    await waitForServer("http://x.test/actuator/health");

    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it("setWaking desliga o contador junto", () => {
    useServerStore.setState({ isWaking: true, waitedSeconds: 42 });

    useServerStore.getState().setWaking(false);

    expect(useServerStore.getState().isWaking).toBe(false);
    expect(useServerStore.getState().waitedSeconds).toBe(0);
  });

  it("o contador de segundos é o que a tela mostra enquanto espera", () => {
    useServerStore.getState().setWaitedSeconds(12);

    expect(useServerStore.getState().waitedSeconds).toBe(12);
  });
});
