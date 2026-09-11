import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import AssistantFAB, { ASSISTANT_FAB_HEIGHT } from "../AssistantFAB";

// O prefixo "mock" e exigencia do Jest: so nomes assim podem ser lidos de
// dentro da fabrica do jest.mock, que sobe para o topo do arquivo
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = (props?: React.ComponentProps<typeof AssistantFAB>) =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <AssistantFAB {...props} />
    </SafeAreaProvider>,
  );

/**
 * O botão do assistente.
 *
 * <p>Ele tinha um halo girando em laço infinito. Movimento sem fim na borda da
 * tela puxa o olho a cada relance e não informa nada — o botão não está
 * carregando coisa alguma. O halo ficou; a rotação saiu, e é isso que o
 * primeiro teste trava para ela não voltar sem querer.
 */
describe("AssistantFAB", () => {
  beforeEach(() => jest.clearAllMocks());

  it("o halo NÃO gira: nenhuma transformação de rotação no gradiente", () => {
    const { UNSAFE_root } = montar();

    const comRotacao = UNSAFE_root
      .findAll(() => true)
      .filter((node) => {
        const estilo = node.props?.style;
        const lista = Array.isArray(estilo) ? estilo.flat() : [estilo];
        return lista.some(
          (item: { transform?: { rotate?: string }[] }) =>
            item?.transform?.some((tr) => tr?.rotate !== undefined),
        );
      });

    expect(comRotacao).toHaveLength(0);
  });

  it("leva ao assistente quando tocado", () => {
    const { getByLabelText } = montar();

    fireEvent.press(getByLabelText("Fale com o Nino"));

    // Sem origem declarada, nenhum parametro viaja junto (EC-201)
    expect(mockNavigate).toHaveBeenCalledWith("IA Assist", undefined);
  });

  it("leva a origem junto quando a tela declara de onde a porta abre", () => {
    const { getByLabelText } = montar({ origin: "fatura" });

    // O rotulo tambem muda: dizer sobre O QUE se vai falar e o que
    // transforma um botao numa porta
    fireEvent.press(getByLabelText("Pergunte sobre a fatura"));

    expect(mockNavigate).toHaveBeenCalledWith("IA Assist", { origin: "fatura" });
  });

  it("o rótulo pode mudar, e é ele que o leitor de tela anuncia", () => {
    const { getByLabelText } = montar({ label: "Perguntar ao Nino" });

    expect(getByLabelText("Perguntar ao Nino")).toBeTruthy();
  });

  it("a altura exportada é a real, para as listas reservarem rodapé", () => {
    // ícone 18 + 12 de padding em cima e embaixo + as duas bordas de 2
    expect(ASSISTANT_FAB_HEIGHT).toBe(52);
  });
});
