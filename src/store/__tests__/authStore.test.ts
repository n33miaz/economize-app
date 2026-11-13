// O que o authStore grava no disco, e o que volta dele ao abrir o app.
//
// O mock do AsyncStorage é global, em jest.setup.js
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuthStore } from "../authStore";

const mockedGetItem = AsyncStorage.getItem as jest.Mock;
const mockedSetItem = AsyncStorage.setItem as jest.Mock;

/** O último JSON gravado na chave do authStore. */
function ultimoGravado(): Record<string, unknown> {
  const chamadas = mockedSetItem.mock.calls.filter(
    ([chave]) => chave === "@auth_storage",
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
        chave === "@auth_storage"
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
});
