import axios from "axios";

import api, { getAppVersion, getPlans, registerPlanInterest } from "../api";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
import { useVersionStore } from "../../store/versionStore";
import { APP_VERSION } from "../../utils/appVersion";

// O dublê tem de ser o AXIOS, não este módulo: os interceptors e as funções
// fecham sobre a instância criada aqui dentro. O `get` solto no default é a
// consulta de versão, que vai pelo axios cru de propósito.
jest.mock("axios", () => {
  const cliente = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => cliente),
      get: jest.fn(),
      isAxiosError: jest.fn(() => false),
    },
  };
});

const cliente = api as unknown as Record<string, jest.Mock> & {
  interceptors: {
    request: { use: jest.Mock };
    response: { use: jest.Mock };
  };
};
const axiosCru = axios as unknown as { get: jest.Mock };

// Capturados AQUI, antes de qualquer `clearAllMocks`: os interceptors são
// registrados uma vez, na carga do módulo
const [onRequest] = cliente.interceptors.request.use.mock.calls[0] as [
  (config: { headers: Record<string, string> }) => { headers: Record<string, string> },
];
const [, onResponseError] = cliente.interceptors.response.use.mock.calls[0] as [
  unknown,
  (error: unknown) => Promise<never>,
];

/**
 * Versão mínima e plano — o lado do cliente HTTP.
 *
 * <p>Três contratos: todo pedido leva a versão e a plataforma; um 426 vira
 * bloqueio SEM derrubar a sessão nem mostrar toast; e a consulta de versão
 * não passa pela instância (não pode acordar servidor nem levar token).
 */
describe("api — versão e plano", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const verbo of ["get", "post", "put", "patch", "delete"]) {
      cliente[verbo].mockResolvedValue({ data: "RESPOSTA" });
    }
    axiosCru.get.mockRejectedValue(new Error("offline"));
    useVersionStore.setState({
      status: "unknown",
      info: null,
      checkedAt: null,
      refusedByServer: false,
    });
  });

  it("toda requisição leva X-App-Version e X-App-Platform", () => {
    useAuthStore.setState({ token: "tok" });

    const config = onRequest({ headers: {} });

    expect(config.headers["X-App-Version"]).toBe(APP_VERSION);
    expect(config.headers["X-App-Version"]).toMatch(/^\d+\.\d+\.\d+$/);
    expect(["android", "ios", "web"]).toContain(config.headers["X-App-Platform"]);
    // …e o token continua indo, como antes
    expect(config.headers.Authorization).toBe("Bearer tok");
  });

  it("sem sessão os cabeçalhos de versão vão do mesmo jeito", () => {
    useAuthStore.setState({ token: null });

    const config = onRequest({ headers: {} });

    expect(config.headers["X-App-Version"]).toBe(APP_VERSION);
    expect(config.headers.Authorization).toBeUndefined();
  });

  it("426 bloqueia com o ProblemDetail, sem derrubar a sessão nem toast", async () => {
    useAuthStore.setState({ token: "tok" });
    const showToast = jest
      .spyOn(useToastStore.getState(), "showToast")
      .mockImplementation(() => {});
    const erro = {
      response: {
        status: 426,
        data: {
          type: "https://economize.app/problems/upgrade-required",
          title: "Atualize o app",
          detail: "Esta versão não é mais aceita.",
          minVersion: "2.3.0",
          downloadUrl: "https://economize-web.onrender.com/baixar",
        },
      },
      config: {},
    };

    await expect(onResponseError(erro)).rejects.toBe(erro);

    const state = useVersionStore.getState();
    expect(state.status).toBe("upgrade-required");
    expect(state.info?.minVersion).toBe("2.3.0");
    expect(state.info?.downloadUrl).toBe("https://economize-web.onrender.com/baixar");
    // Um 426 não é 401: a sessão fica, quem barra é o gate
    expect(useAuthStore.getState().token).toBe("tok");
    expect(showToast).not.toHaveBeenCalled();
    // E a consulta completa foi disparada (pelo axios cru)
    expect(axiosCru.get).toHaveBeenCalledTimes(1);
    showToast.mockRestore();
  });

  it("a consulta de versão vai pelo axios cru, curta e com os cabeçalhos", async () => {
    axiosCru.get.mockResolvedValue({
      data: { minVersion: "2.3.0", latestVersion: "2.3.0", downloadUrl: "x", storeUrl: null },
    });

    const info = await getAppVersion();

    expect(info.minVersion).toBe("2.3.0");
    expect(cliente.get).not.toHaveBeenCalled();
    const [url, options] = axiosCru.get.mock.calls[0] as [
      string,
      { timeout: number; headers: Record<string, string> },
    ];
    expect(url).toMatch(/\/api\/v1\/app\/version$/);
    expect(options.timeout).toBe(8000);
    expect(options.headers["X-App-Version"]).toBe(APP_VERSION);
    expect(options.headers["X-App-Platform"]).toBeDefined();
  });

  it("planos: GET /plans desembrulhado", async () => {
    await expect(getPlans()).resolves.toBe("RESPOSTA");
    expect(cliente.get).toHaveBeenCalledWith("/plans");
  });

  it("interesse: POST /plans/interest com o plano no corpo", async () => {
    await registerPlanInterest("PLUS");
    expect(cliente.post).toHaveBeenCalledWith("/plans/interest", { plan: "PLUS" });
  });
});
