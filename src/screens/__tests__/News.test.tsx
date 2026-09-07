import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import News from "../News";
import { useNewsStore } from "../../store/newsStore";
import { usePlanStore } from "../../store/planStore";
import api from "../../services/api";

import type { NewsArticle } from "../../services/api";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

// O PageContainer e o ScreenHeader consultam a navegação; sem estas portas o
// componente estoura antes de qualquer asserção
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({ index: 0, routes: [{ name: "Noticias" }] }),
  }),
  useRoute: () => ({ params: {} }),
  useIsFocused: () => true,
  useFocusEffect: (efeito: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(efeito, []);
  },
}));

const mockApi = api as unknown as { get: jest.Mock };

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const artigo = (titulo: string): NewsArticle => ({
  source: { id: "infomoney", name: "InfoMoney" },
  author: null,
  title: titulo,
  description: "Resumo da manchete",
  url: `https://exemplo.test/${encodeURIComponent(titulo)}`,
  urlToImage: null,
  publishedAt: "2026-09-07T10:00:00Z",
  content: null,
});

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <News />
    </SafeAreaProvider>,
  );

describe("Notícias", () => {
  beforeEach(() => {
    // `mockReset` e nao `clearAllMocks`: o segundo nao drena a fila dos
    // `...Once`, e uma rejeicao sobrando de um teste derrubava o seguinte
    mockApi.get.mockReset();
    useNewsStore.getState().reset();
    // conta gratuita: o slot de anúncio aparece, e é o estado da maioria
    usePlanStore.setState({ plan: "FREE", adsEnabled: true });
  });

  it("mostra as manchetes que o servidor devolveu", async () => {
    mockApi.get.mockResolvedValue({
      data: { articles: [artigo("Selic sobe"), artigo("Dólar recua")] },
    });

    const { getByText } = montar();

    await waitFor(() => expect(getByText("Selic sobe")).toBeTruthy());
    expect(getByText("Dólar recua")).toBeTruthy();
  });

  it("busca uma vez só, mesmo com o store já quente", async () => {
    mockApi.get.mockResolvedValue({ data: { articles: [artigo("Selic sobe")] } });

    const primeira = montar();
    await waitFor(() => expect(primeira.getByText("Selic sobe")).toBeTruthy());
    primeira.unmount();

    // Segunda visita dentro do TTL: a tela pinta do que já está guardado.
    // É o ponto do store compartilhado — a Home pedia estas mesmas manchetes
    const segunda = montar();
    await waitFor(() => expect(segunda.getByText("Selic sobe")).toBeTruthy());

    expect(mockApi.get).toHaveBeenCalledTimes(1);
  });

  it("falha na busca mostra a saída para tentar de novo", async () => {
    mockApi.get.mockRejectedValue(new Error("offline"));

    const { getByText } = montar();

    await waitFor(() => expect(getByText("Tentar de novo")).toBeTruthy());
  });

  it("o botão de atualizar ignora a janela de cache", async () => {
    mockApi.get.mockRejectedValueOnce(new Error("offline"));
    mockApi.get.mockResolvedValueOnce({
      data: { articles: [artigo("Chegou depois")] },
    });

    const { getByText } = montar();
    await waitFor(() => expect(getByText("Tentar de novo")).toBeTruthy());

    fireEvent.press(getByText("Tentar de novo"));

    await waitFor(() => expect(getByText("Chegou depois")).toBeTruthy());
    expect(mockApi.get).toHaveBeenCalledTimes(2);
  });

  it("no plano Plus o espaço de anúncio some por completo", async () => {
    mockApi.get.mockResolvedValue({ data: { articles: [artigo("Selic sobe")] } });
    usePlanStore.setState({ plan: "PLUS", adsEnabled: false });

    const { queryByText, getByText } = montar();

    await waitFor(() => expect(getByText("Selic sobe")).toBeTruthy());
    // não é só esconder: o slot devolve null e nem reserva altura
    expect(queryByText("Publicidade")).toBeNull();
  });
});
