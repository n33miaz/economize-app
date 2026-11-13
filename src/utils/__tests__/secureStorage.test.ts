// O cofre do sistema e a migração de quem já estava logado.
//
// Os mocks do AsyncStorage e do expo-secure-store são globais, em
// jest.setup.js. O ambiente de teste é nativo (iOS); o caso do web troca o
// `Platform.OS` só no teste dele.
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import { getItem, removeItem, setItem } from "../secureStorage";

const cofre = {
  get: SecureStore.getItemAsync as jest.Mock,
  set: SecureStore.setItemAsync as jest.Mock,
  del: SecureStore.deleteItemAsync as jest.Mock,
};
const antigo = {
  get: AsyncStorage.getItem as jest.Mock,
  set: AsyncStorage.setItem as jest.Mock,
  del: AsyncStorage.removeItem as jest.Mock,
};

const CHAVE = "@auth_storage";
const CHAVE_COFRE = "_auth_storage";

describe("secureStorage", () => {
  const osOriginal = Platform.OS;
  let aviso: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    cofre.get.mockImplementation(() => Promise.resolve(null));
    cofre.set.mockImplementation(() => Promise.resolve());
    cofre.del.mockImplementation(() => Promise.resolve());
    antigo.get.mockImplementation(() => Promise.resolve(null));
    antigo.set.mockImplementation(() => Promise.resolve());
    antigo.del.mockImplementation(() => Promise.resolve());
    aviso = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    Platform.OS = osOriginal;
    aviso.mockRestore();
  });

  it("no celular grava e lê no cofre, nunca em texto claro", async () => {
    await setItem(CHAVE, "segredo");
    expect(cofre.set).toHaveBeenCalledWith(CHAVE_COFRE, "segredo");
    expect(antigo.set).not.toHaveBeenCalled();

    cofre.get.mockResolvedValue("segredo");
    expect(await getItem(CHAVE)).toBe("segredo");
    // achou no cofre: nem olha a chave antiga
    expect(antigo.get).not.toHaveBeenCalled();
  });

  it("migra a chave antiga: copia para o cofre e apaga o texto claro", async () => {
    antigo.get.mockImplementation((k: string) =>
      Promise.resolve(k === CHAVE ? "tok-antigo" : null),
    );

    expect(await getItem(CHAVE)).toBe("tok-antigo");

    expect(cofre.set).toHaveBeenCalledWith(CHAVE_COFRE, "tok-antigo");
    expect(antigo.del).toHaveBeenCalledWith(CHAVE);
    // a cópia vem ANTES de apagar: apagar primeiro perderia a sessão
    expect(cofre.set.mock.invocationCallOrder[0]).toBeLessThan(
      antigo.del.mock.invocationCallOrder[0],
    );
  });

  it("migração que não consegue copiar ainda devolve a sessão desta abertura", async () => {
    antigo.get.mockResolvedValue("tok-antigo");
    cofre.set.mockRejectedValue(new Error("Keystore"));

    expect(await getItem(CHAVE)).toBe("tok-antigo");
    // a leitura não apaga o que não conseguiu copiar; quem apaga é a escrita
    expect(antigo.del).not.toHaveBeenCalled();
  });

  it("cofre ilegível vira 'nada guardado' e não estoura", async () => {
    cofre.get.mockRejectedValue(new Error("Keystore"));
    antigo.get.mockResolvedValue("tok-antigo");

    expect(await getItem(CHAVE)).toBeNull();
    // e não volta ao texto claro, que o logout já não alcançaria
    expect(antigo.get).not.toHaveBeenCalled();
  });

  it("falha ao gravar ou apagar não estoura, e o log não leva o valor", async () => {
    cofre.set.mockRejectedValue(new Error("falhou com segredo-xyz"));
    cofre.del.mockRejectedValue(new Error("falhou"));

    await expect(setItem(CHAVE, "segredo-xyz")).resolves.toBeUndefined();
    await expect(removeItem(CHAVE)).resolves.toBeUndefined();

    expect(aviso).toHaveBeenCalled();
    expect(JSON.stringify(aviso.mock.calls)).not.toContain("segredo-xyz");
  });

  it("toda escrita apaga a cópia antiga, para nada ressuscitar a sessão", async () => {
    await setItem(CHAVE, "novo");
    expect(antigo.del).toHaveBeenCalledWith(CHAVE);

    jest.clearAllMocks();
    await removeItem(CHAVE);
    expect(cofre.del).toHaveBeenCalledWith(CHAVE_COFRE);
    expect(antigo.del).toHaveBeenCalledWith(CHAVE);
  });

  it("no web não há cofre: usa o armazenamento de sempre, na chave de sempre", async () => {
    Platform.OS = "web";

    await setItem(CHAVE, "tok");
    expect(antigo.set).toHaveBeenCalledWith(CHAVE, "tok");

    antigo.get.mockResolvedValue("tok");
    expect(await getItem(CHAVE)).toBe("tok");

    await removeItem(CHAVE);
    expect(antigo.del).toHaveBeenCalledWith(CHAVE);

    expect(cofre.set).not.toHaveBeenCalled();
    expect(cofre.get).not.toHaveBeenCalled();
    expect(cofre.del).not.toHaveBeenCalled();
  });
});
