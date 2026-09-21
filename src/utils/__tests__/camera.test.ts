import { Platform } from "react-native";

import { detectCamera, shrinkImageForWeb } from "../camera";

const plataformaOriginal = Platform.OS;

function fingirPlataforma(os: typeof Platform.OS) {
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
}

afterEach(() => {
  fingirPlataforma(plataformaOriginal);
  delete (globalThis as { navigator?: unknown }).navigator;
});

describe("detectCamera", () => {
  it("no celular a câmera existe sem perguntar", async () => {
    fingirPlataforma("ios");
    await expect(detectCamera()).resolves.toBe(true);
  });

  it("na web sem mediaDevices não há câmera — e o botão some", async () => {
    fingirPlataforma("web");
    (globalThis as { navigator?: unknown }).navigator = {};
    await expect(detectCamera()).resolves.toBe(false);
  });

  it("na web com uma entrada de vídeo há câmera, mesmo sem rótulo", async () => {
    fingirPlataforma("web");
    (globalThis as { navigator?: unknown }).navigator = {
      mediaDevices: {
        enumerateDevices: async () => [
          { kind: "audioinput", label: "" },
          { kind: "videoinput", label: "" },
        ],
      },
    };
    await expect(detectCamera()).resolves.toBe(true);
  });

  it("só microfone não é câmera; erro da API também não", async () => {
    fingirPlataforma("web");
    (globalThis as { navigator?: unknown }).navigator = {
      mediaDevices: { enumerateDevices: async () => [{ kind: "audioinput" }] },
    };
    await expect(detectCamera()).resolves.toBe(false);
    (globalThis as { navigator?: unknown }).navigator = {
      mediaDevices: {
        enumerateDevices: async () => {
          throw new Error("bloqueado");
        },
      },
    };
    await expect(detectCamera()).resolves.toBe(false);
  });
});

describe("shrinkImageForWeb", () => {
  it("no celular devolve o caminho intacto — lá a foto é arquivo, não base64", async () => {
    fingirPlataforma("android");
    await expect(shrinkImageForWeb("file:///a.jpg")).resolves.toBe("file:///a.jpg");
  });

  it("na web só mexe em data/blob, e sem DOM devolve o original", async () => {
    fingirPlataforma("web");
    await expect(shrinkImageForWeb("https://cdn/x.jpg")).resolves.toBe("https://cdn/x.jpg");
    const doc = (globalThis as { document?: unknown }).document;
    const img = (globalThis as { Image?: unknown }).Image;
    delete (globalThis as { document?: unknown }).document;
    delete (globalThis as { Image?: unknown }).Image;
    try {
      await expect(shrinkImageForWeb("data:image/png;base64,AAAA")).resolves.toBe(
        "data:image/png;base64,AAAA",
      );
    } finally {
      if (doc !== undefined) (globalThis as { document?: unknown }).document = doc;
      if (img !== undefined) (globalThis as { Image?: unknown }).Image = img;
    }
  });
});
