import React from "react";
import { Platform, Share } from "react-native";
import * as FileSystem from "expo-file-system";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import AdvancedOptions from "../AdvancedOptions";
import { useAuthStore } from "../../store/authStore";
import { useBankStore } from "../../store/bankStore";
import { useCategoriesStore } from "../../store/categoriesStore";
import { usePreferencesStore } from "../../store/preferencesStore";
import { useUserStore } from "../../store/userStore";
import { useWalletStore } from "../../store/walletStore";
import { useToastStore } from "../../store/toastStore";
import { tidyStatement } from "../../services/api";

const faxina = tidyStatement as jest.MockedFunction<typeof tidyStatement>;

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {},
  tidyStatement: jest.fn(),
}));

jest.mock("expo-file-system", () => ({
  cacheDirectory: "file:///cache/",
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(),
    createFileAsync: jest.fn(),
  },
}));

const fs = FileSystem as jest.Mocked<typeof FileSystem>;
const saf = FileSystem.StorageAccessFramework as jest.Mocked<
  typeof FileSystem.StorageAccessFramework
>;

/** Troca a plataforma só durante o teste: o Platform do jest é um objeto comum. */
const comPlataforma = (os: string) => {
  const original = Platform.OS;
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
  return () =>
    Object.defineProperty(Platform, "OS", { value: original, configurable: true });
};

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({
      index: 1,
      routes: [{ name: "Main" }, { name: "OpcoesAvancadas" }],
    }),
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

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <AdvancedOptions />
    </SafeAreaProvider>,
  );

describe("Opções avançadas", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: "t", userName: "Neemias" } as never);
    useUserStore.setState({ me: null, stats: null } as never);
    useBankStore.setState({ transactions: [] } as never);
    useWalletStore.setState({ transactions: [] } as never);
    useCategoriesStore.setState({ items: [] } as never);
    usePreferencesStore.setState({ notificationsEnabled: true } as never);
    faxina.mockReset();
    fs.writeAsStringAsync.mockClear();
    saf.requestDirectoryPermissionsAsync.mockReset();
    saf.createFileAsync.mockReset();
  });

  it("abre com o título e o subtítulo da tela", async () => {
    const { getByText } = montar();

    await waitFor(() => expect(getByText("Opções avançadas")).toBeTruthy());
    expect(getByText("Dados, notificações e suporte")).toBeTruthy();
  });

  it("monta mesmo sem nenhum dado carregado", async () => {
    // É a primeira abertura de quem acabou de se cadastrar: nenhuma conta,
    // nenhum extrato, nenhuma categoria própria
    const { getByText } = montar();

    await waitFor(() => expect(getByText("Opções avançadas")).toBeTruthy());
  });

  it("reprocessar o extrato conta o que cada varredura mexeu", async () => {
    faxina.mockResolvedValue({
      internalMarked: 197,
      investmentMarked: 350,
      familyMarked: 68,
      duplicatesMarked: 20,
      refundsMarked: 8,
      seriesCreated: 3,
      seriesUpdated: 12,
    });
    const buscar = jest.fn().mockResolvedValue(undefined);
    useBankStore.setState({ transactions: [], fetchTransactions: buscar } as never);

    const { getByText } = montar();
    fireEvent.press(await waitFor(() => getByText("Reprocessar o extrato")));

    await waitFor(() => expect(faxina).toHaveBeenCalled());
    // N\u00famero por n\u00famero: a faxina mexe em SEIS coisas diferentes, e "pronto"
    // n\u00e3o diz em qual delas ela mexeu
    await waitFor(() =>
      expect(useToastStore.getState().message).toContain("20 duplicata(s)"),
    );
    // Os dois vigias novos (EC-214 e EC-194) entram na conta: a frase ficou
    // para tr\u00e1s quando eles nasceram na API
    expect(useToastStore.getState().message).toContain("350 de investimento");
    expect(useToastStore.getState().message).toContain("8 estorno(s)");
    // sem recarregar, a An\u00e1lise mostraria o n\u00famero de antes
    await waitFor(() => expect(buscar).toHaveBeenCalledWith(true));
  });

  it("extrato j\u00e1 limpo n\u00e3o vira lista de zeros", async () => {
    faxina.mockResolvedValue({
      internalMarked: 0,
      investmentMarked: 0,
      familyMarked: 0,
      duplicatesMarked: 0,
      refundsMarked: 0,
      seriesCreated: 0,
      seriesUpdated: 0,
    });
    useBankStore.setState({
      transactions: [],
      fetchTransactions: jest.fn().mockResolvedValue(undefined),
    } as never);

    const { getByText } = montar();
    fireEvent.press(await waitFor(() => getByText("Reprocessar o extrato")));

    await waitFor(() =>
      expect(useToastStore.getState().message).toContain("j\u00e1 estava limpo"),
    );
  });

  it("vigia que n\u00e3o achou nada n\u00e3o ocupa a frase de quem achou", async () => {
    faxina.mockResolvedValue({
      internalMarked: 0,
      investmentMarked: 0,
      familyMarked: 0,
      duplicatesMarked: 2,
      refundsMarked: 0,
      seriesCreated: 0,
      seriesUpdated: 0,
    });
    useBankStore.setState({
      transactions: [],
      fetchTransactions: jest.fn().mockResolvedValue(undefined),
    } as never);

    const { getByText } = montar();
    fireEvent.press(await waitFor(() => getByText("Reprocessar o extrato")));

    await waitFor(() =>
      expect(useToastStore.getState().message).toBe("2 duplicata(s)."),
    );
  });

  it("falha ao reprocessar avisa em vez de fingir que deu certo", async () => {
    faxina.mockRejectedValue(new Error("boom"));

    const { getByText } = montar();
    fireEvent.press(await waitFor(() => getByText("Reprocessar o extrato")));

    await waitFor(() =>
      expect(useToastStore.getState().message).toContain("N\u00e3o consegui reprocessar"),
    );
  });

  describe("exportar meus dados", () => {
    // As outras tr\u00eas fontes respondem na hora: aqui interessa o extrato
    const prepararFontes = (historicoInteiro: boolean) => {
      useUserStore.setState({
        me: null,
        fetchMe: jest.fn().mockResolvedValue(undefined),
      } as never);
      useWalletStore.setState({
        transactions: [],
        fetchTransactions: jest.fn().mockResolvedValue(undefined),
      } as never);
      useCategoriesStore.setState({
        items: [],
        fetch: jest.fn().mockResolvedValue(undefined),
      } as never);
      const garantir = jest.fn().mockResolvedValue(historicoInteiro);
      useBankStore.setState({
        transactions: [],
        ensureHistory: garantir,
      } as never);
      return garantir;
    };

    it("espera o hist\u00f3rico inteiro do extrato antes de gerar o arquivo", async () => {
      const compartilhar = jest
        .spyOn(Share, "share")
        .mockResolvedValue({ action: "sharedAction" } as never);
      const garantir = prepararFontes(true);

      const { getByText } = montar();
      fireEvent.press(await waitFor(() => getByText("Exportar meus dados")));

      await waitFor(() => expect(compartilhar).toHaveBeenCalled());
      expect(garantir).toHaveBeenCalled();
      compartilhar.mockRestore();
    });

    it("sem o hist\u00f3rico inteiro, n\u00e3o gera arquivo pela metade", async () => {
      const compartilhar = jest.spyOn(Share, "share");
      prepararFontes(false);

      const { getByText } = montar();
      fireEvent.press(await waitFor(() => getByText("Exportar meus dados")));

      await waitFor(() =>
        expect(useToastStore.getState().message).toMatch(/extrato inteiro/),
      );
      expect(compartilhar).not.toHaveBeenCalled();
      compartilhar.mockRestore();
    });

    it("no iOS compartilha o ARQUIVO, não o JSON como texto", async () => {
      const compartilhar = jest
        .spyOn(Share, "share")
        .mockResolvedValue({ action: "sharedAction" } as never);
      prepararFontes(true);

      const { getByText } = montar();
      fireEvent.press(await waitFor(() => getByText("Exportar meus dados")));

      await waitFor(() => expect(compartilhar).toHaveBeenCalled());
      const [conteudo] = compartilhar.mock.calls[0];
      expect(conteudo).toMatchObject({
        url: expect.stringMatching(/^file:\/\/\/cache\/economize-dados-.*\.json$/),
      });
      // O texto do extrato inteiro pelo share sheet é o que estoura o Binder
      expect(conteudo).not.toHaveProperty("message");
      expect(fs.writeAsStringAsync).toHaveBeenCalledWith(
        (conteudo as { url: string }).url,
        expect.any(String),
      );
      compartilhar.mockRestore();
    });

    it("no Android grava pelo SAF na pasta escolhida, sem Share", async () => {
      const restaurar = comPlataforma("android");
      const compartilhar = jest.spyOn(Share, "share");
      saf.requestDirectoryPermissionsAsync.mockResolvedValue({
        granted: true,
        directoryUri: "content://pasta",
      });
      saf.createFileAsync.mockResolvedValue("content://pasta/arquivo");
      prepararFontes(true);

      try {
        const { getByText } = montar();
        fireEvent.press(await waitFor(() => getByText("Exportar meus dados")));

        await waitFor(() =>
          expect(fs.writeAsStringAsync).toHaveBeenCalledWith(
            "content://pasta/arquivo",
            expect.any(String),
          ),
        );
        // O SAF põe a extensão pelo tipo: o nome vai sem ".json"
        expect(saf.createFileAsync).toHaveBeenCalledWith(
          "content://pasta",
          expect.not.stringMatching(/\.json$/),
          "application/json",
        );
        expect(compartilhar).not.toHaveBeenCalled();
        expect(useToastStore.getState().message).toMatch(/pasta escolhida/);
      } finally {
        restaurar();
        compartilhar.mockRestore();
      }
    });

    it("no Android, desistir da pasta não grava nem acusa erro", async () => {
      const restaurar = comPlataforma("android");
      saf.requestDirectoryPermissionsAsync.mockResolvedValue({ granted: false });
      useToastStore.setState({ message: "", lastMessage: "" } as never);
      prepararFontes(true);

      try {
        const { getByText } = montar();
        fireEvent.press(await waitFor(() => getByText("Exportar meus dados")));

        await waitFor(() =>
          expect(saf.requestDirectoryPermissionsAsync).toHaveBeenCalled(),
        );
        expect(fs.writeAsStringAsync).not.toHaveBeenCalled();
        expect(useToastStore.getState().message).toBe("");
      } finally {
        restaurar();
      }
    });

    it("na web revoga a URL do blob só depois, para o Safari baixar", async () => {
      const restaurar = comPlataforma("web");
      const criar = jest.fn().mockReturnValue("blob:x");
      const revogar = jest.fn();
      const urlOriginal = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
      URL.createObjectURL = criar;
      URL.revokeObjectURL = revogar;
      const docOriginal = (global as { document?: unknown }).document;
      const ancora = { click: jest.fn(), remove: jest.fn() } as Record<string, unknown>;
      (global as { document?: unknown }).document = {
        createElement: () => ancora,
        body: { appendChild: jest.fn() },
      };
      prepararFontes(true);

      try {
        const { getByText } = montar();
        fireEvent.press(await waitFor(() => getByText("Exportar meus dados")));

        await waitFor(() => expect(ancora.click).toHaveBeenCalled());
        expect(revogar).not.toHaveBeenCalled();
        await waitFor(() => expect(revogar).toHaveBeenCalledWith("blob:x"), {
          timeout: 2500,
        });
      } finally {
        restaurar();
        URL.createObjectURL = urlOriginal.create;
        URL.revokeObjectURL = urlOriginal.revoke;
        (global as { document?: unknown }).document = docOriginal;
      }
    });
  });
});
