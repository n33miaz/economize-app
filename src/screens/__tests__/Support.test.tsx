import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import Support from "../Support";
import {
  type SupportTicket,
  closeSupportTicket,
  getSupportTickets,
  openSupportTicket,
} from "../../services/api";
import { useConfirmStore } from "../../store/confirmStore";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {},
  getSupportTickets: jest.fn(),
  openSupportTicket: jest.fn(),
  closeSupportTicket: jest.fn(),
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({ type: "stack", index: 1, routes: [{ name: "Suporte" }] }),
  }),
  useRoute: () => ({ params: {} }),
  useIsFocused: () => true,
  useFocusEffect: (efeito: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(efeito, []);
  },
}));

const listar = getSupportTickets as jest.MockedFunction<typeof getSupportTickets>;
const abrir = openSupportTicket as jest.MockedFunction<typeof openSupportTicket>;
const encerrar = closeSupportTicket as jest.MockedFunction<typeof closeSupportTicket>;

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const chamado = (patch: Partial<SupportTicket> = {}): SupportTicket => ({
  id: "t1",
  subject: "NUMERO_ERRADO",
  message: "A soma de setembro não bate",
  status: "OPEN",
  respondBy: "2026-09-15T12:00:00Z",
  answer: null,
  answeredAt: null,
  overdue: false,
  createdAt: "2026-09-11T12:00:00Z",
  ...patch,
});

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Support />
    </SafeAreaProvider>,
  );

/**
 * EC-209 na tela.
 *
 * O que se prova aqui é o que separa este suporte de um chat que some: o
 * prazo aparece, o atraso aparece, e o histórico é do servidor.
 */
describe("Suporte", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useConfirmStore.setState({ request: null } as never);
    listar.mockResolvedValue([]);
  });

  it("sem chamado, diz isso em vez de mostrar lista vazia", async () => {
    const { getByText } = montar();

    await waitFor(() =>
      expect(getByText("Você ainda não abriu nenhum chamado.")).toBeTruthy(),
    );
  });

  it("o prazo aparece no card, e não numa promessa solta de interface", async () => {
    listar.mockResolvedValue([chamado()]);

    const { getByText } = montar();

    await waitFor(() => expect(getByText("até 15/09")).toBeTruthy());
  });

  it("prazo vencido aparece como atrasado", async () => {
    listar.mockResolvedValue([chamado({ overdue: true })]);

    const { getByText } = montar();

    // Esconder o atraso seria fingir que está tudo no rumo para quem espera
    await waitFor(() => expect(getByText("atrasado")).toBeTruthy());
  });

  it("respondido mostra a resposta, e some o botão de encerrar? não — ele fica", async () => {
    listar.mockResolvedValue([
      chamado({ status: "ANSWERED", answer: "Era duplicata; já corrigimos." }),
    ]);

    const { getByText } = montar();

    await waitFor(() => expect(getByText("Era duplicata; já corrigimos.")).toBeTruthy());
    expect(getByText("respondido")).toBeTruthy();
    expect(getByText("Já resolvi — encerrar")).toBeTruthy();
  });

  it("encerrado não oferece encerrar de novo", async () => {
    listar.mockResolvedValue([chamado({ status: "CLOSED" })]);

    const { getByText, queryByText } = montar();

    await waitFor(() => expect(getByText("encerrado")).toBeTruthy());
    expect(queryByText("Já resolvi — encerrar")).toBeNull();
  });

  it("mensagem vazia é recusada na tela, sem ida ao servidor", async () => {
    const { getByLabelText, findByText } = montar();

    fireEvent.press(await waitFor(() => getByLabelText("Abrir o chamado")));

    expect(await findByText(/Conte o que aconteceu/)).toBeTruthy();
    expect(abrir).not.toHaveBeenCalled();
  });

  it("abrir manda assunto, texto e a VERSÃO do app", async () => {
    abrir.mockResolvedValue(chamado());
    const { getByLabelText } = montar();

    fireEvent.changeText(
      await waitFor(() => getByLabelText("O que aconteceu")),
      "  o extrato não importou  ",
    );
    fireEvent.press(getByLabelText("Abrir o chamado"));

    await waitFor(() => expect(abrir).toHaveBeenCalled());
    const enviado = abrir.mock.calls[0][0];
    // O texto vai aparado: espaço à toa na ponta não é conteúdo
    expect(enviado.message).toBe("o extrato não importou");
    expect(enviado.subject).toBe("NUMERO_ERRADO");
    // Sem a versão e a tela, o primeiro retorno é sempre "qual versão você
    // usa?", e essa ida e volta custa um dia
    expect(enviado.screen).toBe("Suporte");
    expect(enviado).toHaveProperty("appVersion");
  });

  it("trocar o assunto muda o que é enviado", async () => {
    abrir.mockResolvedValue(chamado());
    const { getByLabelText } = montar();

    fireEvent.press(await waitFor(() => getByLabelText("Conexão com o banco")));
    fireEvent.changeText(getByLabelText("O que aconteceu"), "o banco caiu");
    fireEvent.press(getByLabelText("Abrir o chamado"));

    await waitFor(() =>
      expect(abrir).toHaveBeenCalledWith(expect.objectContaining({ subject: "CONEXAO" })),
    );
  });

  it("a recusa do servidor chega inteira — ela diz por que não abriu", async () => {
    abrir.mockRejectedValue({
      response: { data: { detail: "Você já tem 3 chamados aguardando resposta." } },
    });
    const { getByLabelText, findByText } = montar();

    fireEvent.changeText(await waitFor(() => getByLabelText("O que aconteceu")), "de novo");
    fireEvent.press(getByLabelText("Abrir o chamado"));

    expect(await findByText(/já tem 3 chamados/)).toBeTruthy();
  });

  it("encerrar pede confirmação e diz que nada é apagado", async () => {
    listar.mockResolvedValue([chamado()]);
    encerrar.mockResolvedValue(chamado({ status: "CLOSED" }));

    const { findByText } = montar();
    fireEvent.press(await findByText("Já resolvi — encerrar"));

    await waitFor(() => expect(useConfirmStore.getState().request).not.toBeNull());
    expect(useConfirmStore.getState().request?.message).toContain("continua no seu histórico");

    await act(async () => {
      await useConfirmStore.getState().request!.onConfirm();
    });
    expect(encerrar).toHaveBeenCalledWith("t1");
  });

  it("falha ao listar se explica e oferece tentar de novo", async () => {
    listar.mockRejectedValue(new Error("sem rede"));

    const { getByText } = montar();

    await waitFor(() =>
      expect(getByText(/Não consegui carregar seus chamados agora/)).toBeTruthy(),
    );
  });
});
