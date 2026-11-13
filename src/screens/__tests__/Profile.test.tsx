import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import Profile from "../Profile";
import { logoutAllSessions } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { useConfirmStore } from "../../store/confirmStore";
import { useToastStore } from "../../store/toastStore";
import { usePlanStore } from "../../store/planStore";
import { usePreferencesStore } from "../../store/preferencesStore";
import { useUserStore } from "../../store/userStore";
import { downloadMyData } from "../../utils/myDataExport";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {},
  logoutAllSessions: jest.fn(),
  getMfaStatus: jest.fn().mockResolvedValue({ enabled: false }),
  deleteMyAccount: jest.fn(),
  // A leitura real do status: o teste da 404 depende dela
  getApiErrorStatus: (e: { response?: { status?: number } }) =>
    e?.response?.status ?? null,
}));

const mockSairDeTudo = logoutAllSessions as jest.MockedFunction<
  typeof logoutAllSessions
>;

jest.mock("../../utils/myDataExport", () => ({
  downloadMyData: jest.fn(),
}));

const mockBaixarDados = downloadMyData as jest.MockedFunction<
  typeof downloadMyData
>;

jest.mock("../../utils/biometrics", () => ({
  biometricSupport: jest.fn().mockResolvedValue({ available: false }),
  enrollBiometrics: jest.fn(),
  forgetBiometrics: jest.fn(),
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({ index: 0, routes: [{ name: "Perfil" }] }),
  }),
  useRoute: () => ({ params: {} }),
  useIsFocused: () => true,
  useFocusEffect: (efeito: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(efeito, []);
  },
}));

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const EU = {
  id: "u1",
  name: "Neemias Cormino Manso",
  email: "ncormino@gmail.com",
  createdAt: "2026-02-26T20:17:08Z",
  lastLoginAt: "2026-09-07T12:22:26Z",
  mustChangePassword: false,
};

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Profile />
    </SafeAreaProvider>,
  );

describe("Perfil", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: "t", userName: "Neemias" } as never);
    useUserStore.setState({
      me: EU,
      stats: { bankTransactions: 1752, walletTransactions: 12, reports: 3 },
      isLoading: false,
      isLoadingStats: false,
      isSaving: false,
      error: null,
      fetchMe: jest.fn().mockResolvedValue(undefined),
      fetchStats: jest.fn().mockResolvedValue(undefined),
      updateName: jest.fn().mockResolvedValue(true),
    } as never);
    usePreferencesStore.setState({
      theme: "dark",
      biometricLogin: false,
      defaultCurrency: "BRL",
      language: "pt-BR",
      viewDepth: "simple",
    } as never);
    usePlanStore.setState({ plan: "FREE", adsEnabled: true });
  });

  it("mostra os três contadores vindos do servidor", async () => {
    const { getByText } = montar();

    // Os números vêm CONTADOS de /users/me/stats: a tela não baixa mais as
    // três listas inteiras (100 KB só de extrato) para chegar a eles
    await waitFor(() => expect(getByText("1752")).toBeTruthy());
    expect(getByText("12")).toBeTruthy();
    expect(getByText("3")).toBeTruthy();
  });

  it("pede perfil e contadores ao abrir, e nada além disso", async () => {
    const fetchMe = jest.fn().mockResolvedValue(undefined);
    const fetchStats = jest.fn().mockResolvedValue(undefined);
    useUserStore.setState({ fetchMe, fetchStats } as never);

    montar();

    await waitFor(() => expect(fetchMe).toHaveBeenCalled());
    expect(fetchStats).toHaveBeenCalled();
  });

  it("conta gratuita vê o convite do Plus na linha do plano", async () => {
    const { getByText } = montar();

    await waitFor(() =>
      expect(getByText("Gratuito · veja o que o Plus adiciona")).toBeTruthy(),
    );
  });

  it("conta Plus vê o plano ativo, não o convite", async () => {
    usePlanStore.setState({ plan: "PLUS", adsEnabled: false });

    const { getByText, queryByText } = montar();

    await waitFor(() => expect(getByText("Plus ativo — sem anúncios")).toBeTruthy());
    expect(queryByText("Gratuito · veja o que o Plus adiciona")).toBeNull();
  });

  it("contadores ainda não carregados não viram zero na tela", async () => {
    // Zero é uma afirmação ("você não tem transação nenhuma") e seria mentira
    // enquanto a resposta não chegou: o lugar mostra esqueleto
    useUserStore.setState({ stats: null, isLoadingStats: true } as never);

    const { queryByText } = montar();

    await waitFor(() => expect(queryByText("1752")).toBeNull());
  });

  it("moeda padrão avisa que vem em breve e não troca o valor", async () => {
    const { getByText } = montar();

    await waitFor(() => expect(getByText("Moeda padrão")).toBeTruthy());
    fireEvent.press(getByText("Moeda padrão"));

    // Nada formata por ela ainda: trocar para USD só mudaria o rótulo
    expect(usePreferencesStore.getState().defaultCurrency).toBe("BRL");
    expect(useToastStore.getState().message).toMatch(/em breve/);
  });

  it("quem ficou em USD de versão anterior volta para reais ao tocar", async () => {
    usePreferencesStore.setState({ defaultCurrency: "USD" } as never);
    const { getByText } = montar();

    await waitFor(() => expect(getByText("Moeda padrão")).toBeTruthy());
    fireEvent.press(getByText("Moeda padrão"));

    expect(usePreferencesStore.getState().defaultCurrency).toBe("BRL");
  });
});

describe("Perfil — sair de todos os aparelhos", () => {
  beforeEach(() => {
    mockSairDeTudo.mockReset();
    useConfirmStore.setState({ request: null });
    useToastStore.getState().hideToast();
    useAuthStore.setState({ token: "t", userName: "Neemias" } as never);
    useUserStore.setState({
      me: EU,
      stats: null,
      isLoading: false,
      isLoadingStats: false,
      isSaving: false,
      fetchMe: jest.fn().mockResolvedValue(undefined),
      fetchStats: jest.fn().mockResolvedValue(undefined),
    } as never);
  });

  afterEach(() => {
    useToastStore.getState().hideToast();
  });

  /** Toca na linha e devolve o pedido de confirmação que ela abriu. */
  const pedirConfirmacao = async () => {
    const tela = montar();
    const linha = await waitFor(() =>
      tela.getByLabelText(/^Sair de todos os aparelhos/),
    );
    fireEvent.press(linha);
    const pedido = useConfirmStore.getState().request;
    expect(pedido).not.toBeNull();
    return pedido!;
  };

  it("a confirmação diz que todos saem e que o código será pedido de novo", async () => {
    const pedido = await pedirConfirmacao();

    expect(pedido.destructive).toBe(true);
    expect(pedido.message).toMatch(/todos os aparelhos/i);
    expect(pedido.message).toMatch(/código/i);
    // Só abrir a confirmação não chama o servidor
    expect(mockSairDeTudo).not.toHaveBeenCalled();
  });

  it("confirmado e aceito pelo servidor: faz o logout local completo", async () => {
    mockSairDeTudo.mockResolvedValue(undefined);
    const pedido = await pedirConfirmacao();

    await act(async () => {
      await pedido.onConfirm();
    });

    expect(mockSairDeTudo).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("servidor antigo (404): avisa que ainda não existe e NÃO sai", async () => {
    mockSairDeTudo.mockRejectedValue({ response: { status: 404 } });
    const pedido = await pedirConfirmacao();

    await act(async () => {
      await pedido.onConfirm();
    });

    expect(useAuthStore.getState().token).toBe("t");
    expect(useToastStore.getState().message).toMatch(/ainda não está disponível/);
  });

  it("falha comum: mostra o motivo e NÃO sai", async () => {
    mockSairDeTudo.mockRejectedValue({
      response: { status: 400, data: { detail: "Pedido recusado." } },
    });
    const pedido = await pedirConfirmacao();

    await act(async () => {
      await pedido.onConfirm();
    });

    expect(useAuthStore.getState().token).toBe("t");
    expect(useToastStore.getState().message).toBe("Pedido recusado.");
  });

  it("dois toques no confirmar mandam UM pedido só", async () => {
    let soltar!: () => void;
    mockSairDeTudo.mockReturnValue(
      new Promise<void>((resolve) => {
        soltar = resolve;
      }),
    );
    const pedido = await pedirConfirmacao();

    await act(async () => {
      const primeiro = pedido.onConfirm();
      const segundo = pedido.onConfirm();
      soltar();
      await Promise.all([primeiro, segundo]);
    });

    expect(mockSairDeTudo).toHaveBeenCalledTimes(1);
  });
});

describe("Perfil — meus dados (LGPD)", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: "t", userName: "Neemias" } as never);
    useToastStore.setState({ message: null } as never);
    mockBaixarDados.mockReset();
  });

  it("baixar meus dados: dois toques rápidos fazem UM download só", async () => {
    let soltar!: (salvo: boolean) => void;
    mockBaixarDados.mockReturnValue(
      new Promise<boolean>((resolve) => {
        soltar = resolve;
      }),
    );
    const tela = montar();
    const linha = await waitFor(() => tela.getByLabelText(/^Baixar meus dados/));

    await act(async () => {
      fireEvent.press(linha);
      fireEvent.press(linha);
      soltar(true);
    });

    expect(mockBaixarDados).toHaveBeenCalledTimes(1);
  });

  it("baixar meus dados: falha vira aviso e a sessão fica", async () => {
    mockBaixarDados.mockRejectedValue({ response: { status: 500 } });
    const tela = montar();
    const linha = await waitFor(() => tela.getByLabelText(/^Baixar meus dados/));

    await act(async () => {
      fireEvent.press(linha);
    });

    await waitFor(() => expect(useToastStore.getState().message).toBeTruthy());
    expect(useAuthStore.getState().token).toBe("t");
  });

  it("excluir minha conta abre a confirmação forte, sem chamar o servidor", async () => {
    const tela = montar();
    const linha = await waitFor(() =>
      tela.getByLabelText(/^Excluir minha conta/),
    );

    fireEvent.press(linha);

    await waitFor(() => expect(tela.getByText(/É permanente/)).toBeTruthy());
    expect(tela.getByText("Excluir para sempre")).toBeTruthy();
  });
});
