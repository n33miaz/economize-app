import * as SecureStore from "expo-secure-store";

import {
  deviceLabel,
  forgetDeviceToken,
  readDeviceToken,
  saveDeviceToken,
} from "../deviceIdentity";

// O segredo mora no cofre do sistema (mock global em jest.setup.js). A chave
// do cofre é a antiga saneada: o SecureStore não aceita "@"
const storage = {
  getItem: SecureStore.getItemAsync as jest.Mock,
  setItem: SecureStore.setItemAsync as jest.Mock,
  removeItem: SecureStore.deleteItemAsync as jest.Mock,
};
const CHAVE = "_economize_device_token";

/**
 * O segredo que faz este aparelho ser reconhecido no login.
 *
 * <p>Os testes de falha são a maior parte de propósito: armazenamento
 * indisponível (navegação privada, "bloquear dados de sites") ESTOURA em vez de
 * devolver nulo, e uma exceção escapando daqui derrubaria o login inteiro —
 * quando a resposta certa é a mais simples possível: aparelho desconhecido,
 * pede o código.
 */
describe("deviceIdentity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("lê o segredo guardado", async () => {
    storage.getItem.mockResolvedValue("segredo-abc");

    expect(await readDeviceToken()).toBe("segredo-abc");
    expect(storage.getItem).toHaveBeenCalledWith(CHAVE);
  });

  it("aparelho novo não tem segredo — e isso não é erro", async () => {
    storage.getItem.mockResolvedValue(null);

    expect(await readDeviceToken()).toBeNull();
  });

  it("armazenamento que estoura vira 'aparelho desconhecido'", async () => {
    storage.getItem.mockRejectedValue(new Error("SecurityError"));

    expect(await readDeviceToken()).toBeNull();
  });

  it("guarda o segredo", async () => {
    storage.setItem.mockResolvedValue(undefined);

    await saveDeviceToken("segredo-abc");

    expect(storage.setItem).toHaveBeenCalledWith(CHAVE, "segredo-abc");
  });

  it("não conseguir guardar não derruba o login", async () => {
    storage.setItem.mockRejectedValue(new Error("QuotaExceeded"));

    // O preço é o próximo login pedir o código de novo, que é o caminho seguro
    await expect(saveDeviceToken("segredo-abc")).resolves.toBeUndefined();
  });

  it("esquece o segredo", async () => {
    storage.removeItem.mockResolvedValue(undefined);

    await forgetDeviceToken();

    expect(storage.removeItem).toHaveBeenCalledWith(CHAVE);
  });

  it("esquecer também não pode estourar", async () => {
    storage.removeItem.mockRejectedValue(new Error("SecurityError"));

    await expect(forgetDeviceToken()).resolves.toBeUndefined();
  });

  it("o rótulo diz o aparelho, para a pessoa reconhecer a lista", () => {
    // Rótulo é para os olhos de quem revoga — nunca prova de nada, porque
    // quem o escreve é o cliente
    expect(deviceLabel()).toContain("Economize!");
  });
});
