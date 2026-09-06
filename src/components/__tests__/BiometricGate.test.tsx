import React from "react";
import { Text } from "react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import * as LocalAuthentication from "expo-local-authentication";

import BiometricGate from "../BiometricGate";
import { useAuthStore } from "../../store/authStore";
import { usePreferencesStore } from "../../store/preferencesStore";

jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

const mocked = LocalAuthentication as jest.Mocked<typeof LocalAuthentication>;

const SEGREDO = "Saldo: R$ 4.312,00";

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <BiometricGate>
        <Text>{SEGREDO}</Text>
      </BiometricGate>
    </SafeAreaProvider>,
  );

/**
 * A tranca do app.
 *
 * <p>Duas garantias sustentam tudo o mais aqui e são a razão dos dois primeiros
 * testes: <b>nenhum quadro do conteúdo vaza antes do desbloqueio</b>, e o
 * conteúdo trancado também some do LEITOR DE TELA — um overlay opaco esconde
 * dos olhos, não do TalkBack, e sem isso os dados financeiros seriam lidos em
 * voz alta por trás do bloqueio.
 */
describe("BiometricGate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePreferencesStore.getState().reset();
    usePreferencesStore.setState({ hasHydrated: true });
    useAuthStore.setState({ token: null, userName: null, hasHydrated: true });
  });

  it("sem sessão, não tranca nada", async () => {
    usePreferencesStore.setState({ biometricLogin: true });

    const { getByText, queryByLabelText } = montar();

    await waitFor(() => expect(getByText(SEGREDO)).toBeTruthy());
    expect(queryByLabelText("OK")).toBeNull();
    expect(mocked.authenticateAsync).not.toHaveBeenCalled();
  });

  it("com sessão e preferência desligada, entra direto", async () => {
    useAuthStore.setState({ token: "tok" });

    const { getByText, queryByLabelText } = montar();

    await waitFor(() => expect(getByText(SEGREDO)).toBeTruthy());
    expect(queryByLabelText("OK")).toBeNull();
  });

  it("com a tranca armada, o conteúdo fica escondido até o desbloqueio", async () => {
    useAuthStore.setState({ token: "tok" });
    usePreferencesStore.setState({ biometricLogin: true });
    mocked.hasHardwareAsync.mockResolvedValue(true);
    mocked.isEnrolledAsync.mockResolvedValue(true);
    mocked.authenticateAsync.mockResolvedValue({ success: false } as never);

    const { getByLabelText } = montar();

    await waitFor(() => expect(getByLabelText("OK")).toBeTruthy());
  });

  it("o conteúdo trancado some também do leitor de tela", async () => {
    useAuthStore.setState({ token: "tok" });
    usePreferencesStore.setState({ biometricLogin: true });
    mocked.hasHardwareAsync.mockResolvedValue(true);
    mocked.isEnrolledAsync.mockResolvedValue(true);
    mocked.authenticateAsync.mockResolvedValue({ success: false } as never);

    const { getByLabelText, queryByText } = montar();
    await waitFor(() => expect(getByLabelText("OK")).toBeTruthy());

    // O overlay é opaco para os olhos; sem `accessibilityElementsHidden` +
    // `no-hide-descendants` o TalkBack navegaria os números por trás dele.
    // A consulta padrão do RNTL ignora o que está fora da árvore de
    // acessibilidade — é exatamente esse sumiço que se afirma aqui
    expect(queryByText(SEGREDO)).toBeNull();
    // e o nó continua montado: o teste não está vendo desmontagem
    expect(
      queryByText(SEGREDO, { includeHiddenElements: true }),
    ).not.toBeNull();
  });

  it("biometria confirmada libera o conteúdo", async () => {
    useAuthStore.setState({ token: "tok" });
    usePreferencesStore.setState({ biometricLogin: true });
    mocked.hasHardwareAsync.mockResolvedValue(true);
    mocked.isEnrolledAsync.mockResolvedValue(true);
    mocked.authenticateAsync.mockResolvedValue({ success: true } as never);

    const { getByText, queryByLabelText } = montar();

    await waitFor(() => expect(queryByLabelText("OK")).toBeNull());
    expect(getByText(SEGREDO)).toBeTruthy();
  });

  it("aparelho sem biometria desarma a preferência em vez de trancar para sempre", async () => {
    useAuthStore.setState({ token: "tok" });
    usePreferencesStore.setState({ biometricLogin: true });
    mocked.hasHardwareAsync.mockResolvedValue(false);

    const { getByText } = montar();

    // Trocar de aparelho não pode virar "nunca mais abro o app"
    await waitFor(() =>
      expect(usePreferencesStore.getState().biometricLogin).toBe(false),
    );
    expect(getByText(SEGREDO)).toBeTruthy();
  });

  it("falhar não derruba a sessão: o OK pede a biometria de novo", async () => {
    useAuthStore.setState({ token: "tok", userName: "Ana" });
    usePreferencesStore.setState({ biometricLogin: true });
    mocked.hasHardwareAsync.mockResolvedValue(true);
    mocked.isEnrolledAsync.mockResolvedValue(true);
    mocked.authenticateAsync.mockResolvedValue({ success: false } as never);

    const { getByLabelText, getByText } = montar();
    await waitFor(() =>
      expect(
        getByText("Não deu certo. Toque em OK para tentar de novo."),
      ).toBeTruthy(),
    );

    fireEvent.press(getByLabelText("OK"));

    // Dedo molhado e cancelamento acidental não podem custar a sessão — quem
    // tenta adivinhar biometria esbarra primeiro no bloqueio do sistema
    await waitFor(() =>
      expect(mocked.authenticateAsync).toHaveBeenCalledTimes(2),
    );
    expect(useAuthStore.getState().token).toBe("tok");
  });

  it("o botão discreto de senha é a saída, e leva ao login", async () => {
    useAuthStore.setState({ token: "tok", userName: "Ana" });
    usePreferencesStore.setState({ biometricLogin: true });
    mocked.hasHardwareAsync.mockResolvedValue(true);
    mocked.isEnrolledAsync.mockResolvedValue(true);
    mocked.authenticateAsync.mockResolvedValue({ success: false } as never);

    const { getByLabelText } = montar();
    await waitFor(() => expect(getByLabelText("Entrar com senha")).toBeTruthy());

    fireEvent.press(getByLabelText("Entrar com senha"));

    // A senha é justamente o que o app não guarda: voltar a pedi-la é voltar
    // ao login
    await waitFor(() => expect(useAuthStore.getState().token).toBeNull());
  });

  it("a tela de bloqueio diz por que existe, em uma linha", async () => {
    useAuthStore.setState({ token: "tok" });
    usePreferencesStore.setState({ biometricLogin: true });
    mocked.hasHardwareAsync.mockResolvedValue(true);
    mocked.isEnrolledAsync.mockResolvedValue(true);
    mocked.authenticateAsync.mockResolvedValue({ success: false } as never);

    const { getByText } = montar();

    await waitFor(() =>
      expect(getByText("Economize! está trancado")).toBeTruthy(),
    );
  });

  it("antes da hidratação não decide nada — nem libera, nem tranca", () => {
    usePreferencesStore.setState({ hasHydrated: false });
    useAuthStore.setState({ token: "tok", hasHydrated: true });

    const { queryByText, queryByLabelText } = montar();

    // Liberar aqui seria abrir o app inteiro num cold start; trancar seria
    // pedir biometria a quem nunca ligou a preferência
    expect(queryByText(SEGREDO)).toBeNull();
    expect(queryByLabelText("OK")).toBeNull();
  });
});
