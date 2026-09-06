import { Platform } from "react-native";

import { copyToClipboard } from "../clipboard";

/**
 * Copiar sem biblioteca.
 *
 * <p>O retorno é o que importa: `false` significa "copiar não aconteceu", e a
 * tela precisa dizer isso em vez de anunciar um sucesso que não houve — foi o
 * caso do convite da casa, que exibia "copiado" no celular sem ter copiado.
 */
describe("copyToClipboard", () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, "OS", { value: originalPlatform });
    delete (globalThis as { navigator?: unknown }).navigator;
  });

  const comPlataforma = (os: string) =>
    Object.defineProperty(Platform, "OS", { value: os, configurable: true });

  it("na web, escreve na área de transferência", async () => {
    comPlataforma("web");
    const writeText = jest.fn().mockResolvedValue(undefined);
    (globalThis as any).navigator = { clipboard: { writeText } };

    expect(await copyToClipboard("NX7QXKS5")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("NX7QXKS5");
  });

  it("no celular devolve falso — não há área de transferência aqui", async () => {
    comPlataforma("android");
    const writeText = jest.fn();
    (globalThis as any).navigator = { clipboard: { writeText } };

    expect(await copyToClipboard("NX7QXKS5")).toBe(false);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("navegador sem a API devolve falso", async () => {
    comPlataforma("web");
    (globalThis as any).navigator = {};

    expect(await copyToClipboard("NX7QXKS5")).toBe(false);
  });

  it("permissão negada devolve falso, e não derruba a tela", async () => {
    comPlataforma("web");
    (globalThis as any).navigator = {
      clipboard: {
        writeText: jest.fn().mockRejectedValue(new Error("NotAllowedError")),
      },
    };

    expect(await copyToClipboard("NX7QXKS5")).toBe(false);
  });
});
