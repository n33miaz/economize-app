import * as FileSystem from "expo-file-system";

import {
  BYTES_PARA_RECONHECER,
  copiarParaCache,
  lerInicioEmBase64,
} from "../arquivoLocal";

/** Mutável porque um dos casos precisa tirar a pasta de cache do ambiente. */
const mockAmbiente: { cacheDirectory: string | null } = {
  cacheDirectory: "file:///cache/",
};

jest.mock("expo-file-system", () => ({
  get cacheDirectory() {
    return mockAmbiente.cacheDirectory;
  },
  copyAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  EncodingType: { Base64: "base64" },
}));

const mockCopy = FileSystem.copyAsync as jest.MockedFunction<
  typeof FileSystem.copyAsync
>;
const mockRead = FileSystem.readAsStringAsync as jest.MockedFunction<
  typeof FileSystem.readAsStringAsync
>;

describe("arquivoLocal", () => {
  beforeEach(() => jest.clearAllMocks());

  it("copia o arquivo do provedor para a pasta do app", async () => {
    mockCopy.mockResolvedValue(undefined);

    const destino = await copiarParaCache("content://baixados/42");

    // A permissão sobre uma URI de provedor morre com quem a cedeu; o upload
    // pode esperar minutos pela rede, então o arquivo precisa ser nosso antes
    expect(destino).toMatch(/^file:\/\/\/cache\/extrato-recebido-\d+$/);
    expect(mockCopy).toHaveBeenCalledWith({
      from: "content://baixados/42",
      to: destino,
    });
  });

  it("diz claramente quando não há pasta de cache", async () => {
    mockAmbiente.cacheDirectory = null;

    await expect(copiarParaCache("content://x")).rejects.toThrow(/cache/i);

    mockAmbiente.cacheDirectory = "file:///cache/";
  });

  it("lê só o começo do arquivo, em base64", async () => {
    mockRead.mockResolvedValue("T0ZYSEVBREVS");

    const inicio = await lerInicioEmBase64("file:///cache/copia");

    expect(inicio).toBe("T0ZYSEVBREVS");
    // Ler o arquivo inteiro para olhar a assinatura custaria um megabyte num
    // extrato de ano fechado; `position` e `length` só existem em base64
    expect(mockRead).toHaveBeenCalledWith("file:///cache/copia", {
      encoding: "base64",
      position: 0,
      length: BYTES_PARA_RECONHECER,
    });
  });
});
