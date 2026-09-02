import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import ConfirmDialog from "../ConfirmDialog";
import { askConfirm, useConfirmStore } from "../../store/confirmStore";

/**
 * O diálogo de confirmação (EC-101).
 *
 * <p>Existe porque o `Alert.alert` do react-native-web é um no-op silencioso:
 * no navegador, sair da conta, excluir categoria e remover transação
 * simplesmente não faziam nada. É o último anteparo antes de toda ação
 * destrutiva do app, e a regra mais importante dele é não disparar a ação duas
 * vezes.
 */
describe("ConfirmDialog", () => {
  beforeEach(() => {
    useConfirmStore.setState({ request: null });
  });

  it("sem pedido, não desenha nada", () => {
    const { toJSON } = render(<ConfirmDialog />);

    expect(toJSON()).toBeNull();
  });

  it("mostra título, mensagem e os dois rótulos", () => {
    const { getByText } = render(<ConfirmDialog />);

    act(() => {
      askConfirm({
        title: "Excluir este relatório?",
        message: "Não dá para desfazer.",
        confirmLabel: "Excluir",
        cancelLabel: "Manter",
        onConfirm: jest.fn(),
      });
    });

    expect(getByText("Excluir este relatório?")).toBeTruthy();
    expect(getByText("Não dá para desfazer.")).toBeTruthy();
    expect(getByText("Excluir")).toBeTruthy();
    expect(getByText("Manter")).toBeTruthy();
  });

  it("confirmar dispara a ação e fecha", async () => {
    const onConfirm = jest.fn();
    const { getByText } = render(<ConfirmDialog />);
    act(() => {
      askConfirm({ title: "Confirma?", confirmLabel: "Sim", onConfirm });
    });

    fireEvent.press(getByText("Sim"));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(useConfirmStore.getState().request).toBeNull());
  });

  it("cancelar NÃO dispara a ação, e avisa quem quer saber da recusa", () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const { getByText } = render(<ConfirmDialog />);
    act(() => {
      askConfirm({
        title: "Confirma?",
        cancelLabel: "Não",
        onConfirm,
        onCancel,
      });
    });

    fireEvent.press(getByText("Não"));

    expect(onConfirm).not.toHaveBeenCalled();
    // Recusar É resposta em fluxos como o da biometria
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(useConfirmStore.getState().request).toBeNull();
  });

  it("dois toques seguidos no confirmar disparam a ação UMA vez", async () => {
    // A ação pode ir à API: disparar duas vezes excluiria duas coisas
    let resolver: () => void = () => {};
    const onConfirm = jest.fn(
      () => new Promise<void>((resolve) => {
        resolver = resolve;
      }),
    );
    const { getByText } = render(<ConfirmDialog />);
    act(() => {
      askConfirm({ title: "Confirma?", confirmLabel: "Sim", onConfirm });
    });

    fireEvent.press(getByText("Sim"));
    fireEvent.press(getByText("Sim"));
    await act(async () => {
      resolver();
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("um segundo pedido substitui o primeiro e avisa a recusa dele", () => {
    const primeiroCancel = jest.fn();
    render(<ConfirmDialog />);

    act(() => {
      askConfirm({ title: "Primeiro", onConfirm: jest.fn(), onCancel: primeiroCancel });
      askConfirm({ title: "Segundo", onConfirm: jest.fn() });
    });

    // Substituir em silêncio engoliria o onCancel do pedido anterior
    expect(primeiroCancel).toHaveBeenCalledTimes(1);
    expect(useConfirmStore.getState().request?.title).toBe("Segundo");
  });

  it("ação que falha ainda fecha o diálogo", async () => {
    const onConfirm = jest.fn().mockRejectedValue(new Error("offline"));
    const { getByText } = render(<ConfirmDialog />);
    act(() => {
      askConfirm({ title: "Confirma?", confirmLabel: "Sim", onConfirm });
    });

    fireEvent.press(getByText("Sim"));

    // Deixar o diálogo travado na tela depois de um erro prenderia o usuário
    await waitFor(() => expect(useConfirmStore.getState().request).toBeNull());
  });
});
