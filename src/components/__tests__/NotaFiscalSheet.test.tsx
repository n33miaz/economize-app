import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import NotaFiscalSheet from "../NotaFiscalSheet";

// A câmera não roda em teste, e não é ela que este arquivo prova: o que se
// prova aqui é o caminho de DIGITAR a chave, que existe justamente para quando
// o QR está amassado ou a câmera não abre.
jest.mock("expo-camera", () => ({
  CameraView: () => null,
  // Negar a permissão é o caso interessante: é ele que tem de deixar o
  // caminho de digitar intacto em vez de virar beco sem saída
  useCameraPermissions: () => [
    { granted: false },
    jest.fn().mockResolvedValue({ granted: false }),
  ],
}));

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Cupom de SP, 09/2026, CNPJ 12.345.678/0001-95, nº 123456. */
const CHAVE = "35260912345678000195650010001234561123456788";

function montar(props: Partial<React.ComponentProps<typeof NotaFiscalSheet>> = {}) {
  const onConfirm = jest.fn();
  const onClose = jest.fn();
  const tela = render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <NotaFiscalSheet
        visible
        atual={null}
        onConfirm={onConfirm}
        onClose={onClose}
        {...props}
      />
    </SafeAreaProvider>,
  );
  return { tela, onConfirm, onClose };
}

describe("NotaFiscalSheet", () => {
  it("a chave digitada vira nota, com loja e número lidos dela mesma", async () => {
    const { tela, onConfirm } = montar();

    fireEvent.changeText(tela.getByLabelText("Chave da nota fiscal"), CHAVE);
    fireEvent.press(tela.getByLabelText("Usar a chave digitada"));

    // tudo isto sai dos 44 dígitos, sem consultar ninguém
    expect(await tela.findByText(/Cupom nº 123456/)).toBeTruthy();
    expect(tela.getByText(/12\.345\.678\/0001-95/)).toBeTruthy();
    // e a folha diz o que NÃO traz, em vez de deixar esperando
    expect(tela.getByText(/itens da nota não vêm no QR/i)).toBeTruthy();

    fireEvent.press(tela.getByLabelText("Anexar esta nota à compra"));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ chave: CHAVE }));
  });

  it("chave com um dígito trocado é recusada na hora, sem ir ao servidor", async () => {
    const { tela, onConfirm } = montar();
    const torta = CHAVE.slice(0, 43) + (CHAVE[43] === "9" ? "0" : "9");

    fireEvent.changeText(tela.getByLabelText("Chave da nota fiscal"), torta);
    fireEvent.press(tela.getByLabelText("Usar a chave digitada"));

    expect(await tela.findByText(/não confere/i)).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("aceita a URL inteira do QR, que é o que um leitor de fora entrega", async () => {
    const { tela } = montar();

    fireEvent.changeText(
      tela.getByLabelText("Chave da nota fiscal"),
      `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${CHAVE}|2|1|1|ABCDEF`,
    );
    fireEvent.press(tela.getByLabelText("Usar a chave digitada"));

    expect(await tela.findByText(/Nota reconhecida/)).toBeTruthy();
  });

  it("avisa que ler outra substitui a que já está anexada", async () => {
    const { tela } = montar({ atual: CHAVE });

    await waitFor(() =>
      expect(tela.getByText(/já tem uma nota anexada/i)).toBeTruthy(),
    );
  });

  it("sem permissão de câmera, o caminho de digitar continua ali", async () => {
    const { tela } = montar();

    fireEvent.press(tela.getByLabelText("Ler o QR da nota"));

    expect(await tela.findByText(/Sem permissão para usar a câmera/i)).toBeTruthy();
    expect(tela.getByLabelText("Chave da nota fiscal")).toBeTruthy();
  });
});
