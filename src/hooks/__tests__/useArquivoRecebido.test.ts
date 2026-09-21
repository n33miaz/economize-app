import { act, renderHook } from "@testing-library/react-native";
import { Linking, Platform } from "react-native";

import { useArquivoRecebido } from "../useArquivoRecebido";
import { useBankStore } from "../../store/bankStore";

jest.mock("../../services/api", () => ({
  getBankTransactions: jest.fn(),
  uploadBankStatement: jest.fn(),
}));
jest.mock("../../services/arquivoLocal", () => ({
  BYTES_PARA_RECONHECER: 512,
  copiarParaCache: jest.fn(),
  lerInicioEmBase64: jest.fn(),
}));

/** Guarda o ouvinte registrado para poder disparar um `url` no meio do teste. */
let ouvinteDeUrl: ((evento: { url: string }) => void) | null = null;
const removerOuvinte = jest.fn();

function prepararLinking(urlInicial: string | null) {
  jest
    .spyOn(Linking, "getInitialURL")
    .mockImplementation(() => Promise.resolve(urlInicial));
  jest
    .spyOn(Linking, "addEventListener")
    .mockImplementation(((_evento: string, ouvinte: never) => {
      ouvinteDeUrl = ouvinte as unknown as (e: { url: string }) => void;
      return { remove: removerOuvinte } as never;
    }) as never);
}

describe("useArquivoRecebido", () => {
  const navegador = { navigate: jest.fn(), isReady: () => true };

  beforeEach(() => {
    jest.clearAllMocks();
    ouvinteDeUrl = null;
    Platform.OS = "android";
    useBankStore.setState({ arquivoRecebido: null });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("parqueia o arquivo que veio na abertura do app", async () => {
    prepararLinking("content://baixados/42");

    renderHook(() => useArquivoRecebido(navegador, true));
    await act(async () => {});

    expect(useBankStore.getState().arquivoRecebido).toBe(
      "content://baixados/42",
    );
  });

  it("parqueia o arquivo que chega com o app já aberto", async () => {
    prepararLinking(null);
    renderHook(() => useArquivoRecebido(navegador, true));
    await act(async () => {});

    // A atividade é singleTask: com o app vivo o arquivo vem pelo evento, e a
    // URL inicial continuaria sendo a da abertura anterior
    await act(async () => {
      ouvinteDeUrl?.({ url: "file:///sdcard/extrato.ofx" });
    });

    expect(useBankStore.getState().arquivoRecebido).toBe(
      "file:///sdcard/extrato.ofx",
    );
  });

  it("ignora a volta do conector, que usa o MESMO evento", async () => {
    prepararLinking("economize://conectar#item=abc");

    renderHook(() => useArquivoRecebido(navegador, true));
    await act(async () => {});

    expect(useBankStore.getState().arquivoRecebido).toBeNull();
    expect(navegador.navigate).not.toHaveBeenCalled();
  });

  it("leva ao Extrato quando há sessão", async () => {
    prepararLinking("content://baixados/42");

    renderHook(() => useArquivoRecebido(navegador, true));
    await act(async () => {});

    expect(navegador.navigate).toHaveBeenCalledWith("Main", {
      screen: "Finanças",
      params: { screen: "Extrato" },
    });
  });

  it("espera a sessão antes de navegar, e vai assim que ela chega", async () => {
    prepararLinking("content://baixados/42");

    const { rerender } = renderHook(
      ({ logado }: { logado: boolean }) =>
        useArquivoRecebido(navegador, logado),
      { initialProps: { logado: false } },
    );
    await act(async () => {});

    // O arquivo pode chegar com o app trancado: perdê-lo seria pior do que
    // esperar, porque quem compartilhou não repete o gesto
    expect(useBankStore.getState().arquivoRecebido).toBe(
      "content://baixados/42",
    );
    expect(navegador.navigate).not.toHaveBeenCalled();

    await act(async () => {
      rerender({ logado: true });
    });

    expect(navegador.navigate).toHaveBeenCalled();
  });

  it("não navega antes de o container estar pronto", async () => {
    prepararLinking("content://baixados/42");
    const cru = { navigate: jest.fn(), isReady: () => false };

    renderHook(() => useArquivoRecebido(cru, true));
    await act(async () => {});

    expect(cru.navigate).not.toHaveBeenCalled();
  });

  it("no navegador não escuta nada", async () => {
    Platform.OS = "web";
    prepararLinking("content://baixados/42");

    renderHook(() => useArquivoRecebido(navegador, true));
    await act(async () => {});

    // "Abrir com" não existe na web: a URL inicial ali é a da própria página
    expect(Linking.addEventListener).not.toHaveBeenCalled();
    expect(useBankStore.getState().arquivoRecebido).toBeNull();
  });

  it("solta o ouvinte ao desmontar", async () => {
    prepararLinking(null);
    const { unmount } = renderHook(() => useArquivoRecebido(navegador, true));
    await act(async () => {});

    unmount();

    expect(removerOuvinte).toHaveBeenCalled();
  });
});
