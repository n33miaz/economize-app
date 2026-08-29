import React from "react";
import { StyleSheet } from "react-native";
import { fireEvent, render as rtlRender } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import SideRail from "../SideRail";
import { RAIL_DESTINATIONS } from "../railDestinations";

// O trilho lê o inset direto (é irmão do stack, nenhum cabeçalho desconta por
// ele). No app o provider vem do App.tsx; aqui ele entra com métricas de
// desktop — janela cheia, inset zero.
const METRICAS_DESKTOP: Metrics = {
  frame: { x: 0, y: 0, width: 1440, height: 900 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function render(ui: React.ReactElement) {
  return rtlRender(
    <SafeAreaProvider initialMetrics={METRICAS_DESKTOP}>{ui}</SafeAreaProvider>,
  );
}

// O trilho só aparece em tela autenticada, e a prova visual dele ficou
// reservada para a validação com o dono (EC-112). Este teste segura a
// ESTRUTURA no lugar até lá: todo destino presente, alcançável e anunciado.
describe("SideRail", () => {
  it("mostra os doze destinos com rótulo acessível", () => {
    const { getByLabelText } = render(<SideRail onNavigate={jest.fn()} />);

    RAIL_DESTINATIONS.forEach((destino) => {
      expect(getByLabelText(destino.label)).toBeTruthy();
    });
  });

  it("é um landmark de navegação, não uma barra de ferramentas", () => {
    // `role="navigation"` vira um <nav> de verdade no react-native-web — é o
    // que deixa o leitor de tela pular direto para a navegação. O papel
    // "toolbar" que estava aqui não é landmark e prometia troca por setas,
    // que o trilho não implementa.
    const { getByLabelText } = render(<SideRail onNavigate={jest.fn()} />);
    expect(getByLabelText("Navegação principal").props.role).toBe("navigation");
  });

  it("devolve o destino inteiro ao toque, não só o rótulo", () => {
    // Quem navega precisa do `route` e do `inMainTabs` — aba do container de
    // baixo exige navegação aninhada, tela de pilha não
    const onNavigate = jest.fn();
    const { getByLabelText } = render(<SideRail onNavigate={onNavigate} />);

    fireEvent.press(getByLabelText("Análise"));

    expect(onNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ route: "Análise", inMainTabs: false }),
    );
  });

  it("navega para aba de container avisando que ela é aninhada", () => {
    const onNavigate = jest.fn();
    const { getByLabelText } = render(<SideRail onNavigate={onNavigate} />);

    fireEvent.press(getByLabelText("Finanças"));

    expect(onNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ route: "Finanças", inMainTabs: true }),
    );
  });

  it("diz no NOME qual destino é o atual — e só nele", () => {
    // O `accessibilityState.selected` funciona no celular, mas o
    // react-native-web 0.19 não o repassa ao DOM: no desktop, que é onde o
    // trilho existe, a seleção falava só por cor. Quem prova a correção é o
    // nome acessível, que atravessa as três plataformas.
    const { queryAllByLabelText, getByLabelText } = render(
      <SideRail activeKey="relatorios" onNavigate={jest.fn()} />,
    );

    expect(queryAllByLabelText(/página atual/)).toHaveLength(1);
    expect(getByLabelText("Relatórios, página atual")).toBeTruthy();
    // O rótulo cru do ativo deixa de existir; o dos outros continua intacto
    expect(getByLabelText("Início")).toBeTruthy();
  });

  it("mantém o estado nativo de seleção junto do nome", () => {
    // Sufixo no nome é a defesa da web; no iOS/Android quem fala é o estado
    const { getByLabelText } = render(
      <SideRail activeKey="relatorios" onNavigate={jest.fn()} />,
    );

    expect(
      getByLabelText("Relatórios, página atual").props.accessibilityState,
    ).toMatchObject({ selected: true });
    expect(getByLabelText("Início").props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it("sem destino ativo, ninguém se diz página atual", () => {
    // É o estado de uma tela fora do mapa: melhor nada aceso do que a pílula
    // parada no item errado
    const { queryAllByLabelText } = render(
      <SideRail onNavigate={jest.fn()} />,
    );

    expect(queryAllByLabelText(/página atual/)).toHaveLength(0);
  });

  it("dá aos itens o alvo de toque mínimo de 44", () => {
    const { getByLabelText } = render(<SideRail onNavigate={jest.fn()} />);

    RAIL_DESTINATIONS.forEach((destino) => {
      // `flatten` para a asserção sobreviver ao estilo virar array ou token:
      // o que se cobra é a altura resolvida, não o formato do objeto
      const estilo = StyleSheet.flatten(
        getByLabelText(destino.label).props.style,
      );
      expect(estilo.height).toBeGreaterThanOrEqual(44);
    });
  });
});
