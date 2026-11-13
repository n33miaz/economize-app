// O que o authStore grava no disco, e o que volta dele ao abrir o app.
//
// Os mocks do AsyncStorage e do cofre (expo-secure-store) são globais, em
// jest.setup.js. O ambiente de teste é nativo (iOS), então o authStore grava no
// cofre, na chave saneada "_auth_storage"
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import { useAuthStore } from "../authStore";

const CHAVE_COFRE = "_auth_storage";
const CHAVE_ANTIGA = "@auth_storage";
const mockedGetItem = SecureStore.getItemAsync as jest.Mock;
const mockedSetItem = SecureStore.setItemAsync as jest.Mock;
const legacyGetItem = AsyncStorage.getItem as jest.Mock;

/** O último JSON gravado na chave do authStore. */
function ultimoGravado(): Record<string, unknown> {
  const chamadas = mockedSetItem.mock.calls.filter(
    ([chave]) => chave === CHAVE_COFRE,
  );
  const [, valor] = chamadas[chamadas.length - 1];
  return JSON.parse(valor).state;
}

describe("authStore — persistência", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      token: null,
      userName: null,
      lastUserKey: null,
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    mockedGetItem.mockImplementation(() => Promise.resolve(null));
    legacyGetItem.mockImplementation(() => Promise.resolve(null));
  });

  it("grava só token, nome e a chave do último usuário", () => {
    useAuthStore.setState({
      token: "tok",
      userName: "Ana",
      lastUserKey: "abc123",
      isLoading: true,
      error: "Erro ao conectar com o servidor.",
    });

    expect(ultimoGravado()).toEqual({
      token: "tok",
      userName: "Ana",
      lastUserKey: "abc123",
    });
  });

  it("estado antigo salvo com isLoading=true não prende o botão ao reabrir", async () => {
    // O que uma versão anterior deixava no disco quando o app fechava no meio
    // de um login lento: o estado inteiro, "carregando" e com erro
    mockedGetItem.mockImplementation((chave: string) =>
      Promise.resolve(
        chave === CHAVE_COFRE
          ? JSON.stringify({
              state: {
                token: "tok-salvo",
                userName: "Ana",
                lastUserKey: "abc123",
                isLoading: true,
                error: "E-mail ou senha incorretos.",
                hasHydrated: true,
              },
              version: 0,
            })
          : null,
      ),
    );

    await useAuthStore.persist.rehydrate();

    const estado = useAuthStore.getState();
    expect(estado.isLoading).toBe(false);
    expect(estado.error).toBeNull();
    // e o que precisa sobreviver, sobreviveu
    expect(estado.token).toBe("tok-salvo");
    expect(estado.userName).toBe("Ana");
    expect(estado.lastUserKey).toBe("abc123");
    expect(estado.hasHydrated).toBe(true);
  });

  it("disco vazio não apaga a sessão que já está na memória", async () => {
    useAuthStore.setState({ token: "tok", userName: "Ana" });

    await useAuthStore.persist.rehydrate();

    expect(useAuthStore.getState().token).toBe("tok");
    expect(useAuthStore.getState().userName).toBe("Ana");
  });
  it("nada vai para o AsyncStorage em texto claro", () => {
    useAuthStore.setState({ token: "tok", userName: "Ana" });

    const gravadosNoTextoClaro = (
      AsyncStorage.setItem as jest.Mock
    ).mock.calls.filter(([chave]) => chave === CHAVE_ANTIGA);
    expect(gravadosNoTextoClaro).toHaveLength(0);
    expect(ultimoGravado().token).toBe("tok");
  });

  it("quem já estava logado continua logado depois da atualização", async () => {
    // A versão anterior deixou a sessão no AsyncStorage; o cofre está vazio
    const antigo = JSON.stringify({
      state: { token: "tok-antigo", userName: "Ana", lastUserKey: "abc123" },
      version: 0,
    });
    legacyGetItem.mockImplementation((chave: string) =>
      Promise.resolve(chave === CHAVE_ANTIGA ? antigo : null),
    );

    await useAuthStore.persist.rehydrate();

    // a hidratação já recebeu o valor migrado: sessão aberta
    expect(useAuthStore.getState().token).toBe("tok-antigo");
    expect(useAuthStore.getState().hasHydrated).toBe(true);
    // copiado para o cofre e apagado do texto claro
    expect(mockedSetItem).toHaveBeenCalledWith(CHAVE_COFRE, antigo);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(CHAVE_ANTIGA);
  });

  it("logout grava a sessão vazia no cofre", () => {
    useAuthStore.setState({ token: "tok", userName: "Ana" });

    useAuthStore.getState().logout();

    expect(ultimoGravado().token).toBeNull();
    expect(ultimoGravado().userName).toBeNull();
  });

  it("cofre ilegível vira sessão ausente, sem derrubar o app", async () => {
    const aviso = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockedGetItem.mockRejectedValue(new Error("Keystore indisponível"));
    useAuthStore.setState({ token: null, userName: null });

    await useAuthStore.persist.rehydrate();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().hasHydrated).toBe(true);
    aviso.mockRestore();
  });
});
