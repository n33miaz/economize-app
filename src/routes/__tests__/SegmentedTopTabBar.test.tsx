import fs from "fs";
import path from "path";

import React from "react";
import { StyleSheet } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
import type { MaterialTopTabBarProps } from "@react-navigation/material-top-tabs";
import { useReducedMotion, withTiming } from "react-native-reanimated";

import SegmentedTopTabBar, { faixasDaMarca } from "../SegmentedTopTabBar";
import { useTabBarStore } from "../../store/tabBarStore";

jest.mock("react-native-reanimated", () => {
  const real = jest.requireActual("react-native-reanimated");
  return {
    ...real,
    __esModule: true,
    default: real.default,
    useReducedMotion: jest.fn(() => false),
    withTiming: jest.fn((valor: number) => valor),
  };
});

const mockReducedMotion = useReducedMotion as jest.MockedFunction<
  typeof useReducedMotion
>;
const mockTiming = withTiming as jest.MockedFunction<typeof withTiming>;

// Espelham o componente. Literais de propósito: se a altura da pílula mudar
// sem querer, é ESTE teste que avisa — importar as constantes faria o teste
// concordar com qualquer valor. 38 é a escolha 7 do dono.
const ALTURA = 38;
const RESPIRO = 3;

const ABAS = ["Carteira", "Extrato", "Recorrências", "Investimentos"];

function props(
  index: number,
  emit = jest.fn(() => ({ defaultPrevented: false })),
) {
  const routes = ABAS.map((name) => ({ key: name, name }));
  return {
    props: {
      state: { index, routes },
      descriptors: Object.fromEntries(
        routes.map((r) => [r.key, { options: {} }]),
      ),
      navigation: { emit, navigate: jest.fn() },
    } as unknown as MaterialTopTabBarProps,
    emit,
  };
}

/** Monta e entrega as medidas de layout — sem elas a marca não existe. */
function montarMedido(index = 0) {
  const { props: p, emit } = props(index);
  const resultado = render(<SegmentedTopTabBar {...p} />);
  const segmentos = resultado.getAllByRole("tab");
  act(() => {
    segmentos.forEach((segmento, i) => {
      segmento.props.onLayout({
        nativeEvent: { layout: { x: i * 85, y: 0, width: 85, height: 32 } },
      });
    });
  });
  return { resultado, emit, navigate: (p.navigation as any).navigate };
}

/**
 * A marca deslizante: raiz → `ScrollView` → contêiner do conteúdo → primeiro
 * filho. É o primeiro de propósito — ordem de irmãos é o que a põe ATRÁS dos
 * rótulos, e o teste acompanha essa decisão.
 */
function marca(resultado: ReturnType<typeof render>) {
  return (resultado.toJSON() as any).children[0].children[0].children[0];
}

/** A pílula é a `ScrollView`, onde vivem a altura e a borda. */
function pilula(resultado: ReturnType<typeof render>) {
  return (resultado.toJSON() as any).children[0];
}

/**
 * <b>O que este arquivo NÃO tenta provar, e por quê.</b> O estilo que sai de um
 * `useAnimatedStyle` só é recalculado na thread de UI, que o ambiente de teste
 * não executa: lê-lo aqui devolve o primeiro valor e passaria a mentir no dia
 * em que o mapeamento mudasse. Então o colapso e o deslize são provados pelos
 * ARGUMENTOS do `withTiming` (o trajeto pedido), como nas suítes vizinhas, e a
 * geometria da marca pela função pura que a decide.
 */

beforeEach(() => {
  jest.clearAllMocks();
  mockReducedMotion.mockReturnValue(false);
  useTabBarStore.setState({ escondida: false, ultimoY: 0 });
});

describe("SegmentedTopTabBar", () => {
  it("desenha um segmento por aba e marca a ativa como selecionada", () => {
    const { resultado } = montarMedido(1);

    const segmentos = resultado.getAllByRole("tab");
    expect(segmentos.map((s) => s.props.accessibilityLabel)).toEqual(ABAS);
    expect(segmentos.map((s) => s.props.accessibilityState.selected)).toEqual([
      false,
      true,
      false,
      false,
    ]);
  });

  /**
   * O defeito que este teste fecha por construção.
   *
   * <p>A régua anterior encolhia os itens para caber, e a 390 px
   * "Investimentos" perdia letras ou quebrava em duas linhas — rótulo que
   * quebra empurra o indicador e desalinha a régua inteira por causa de uma
   * palavra. Foi por isso que a fonte tinha caído para 11 px.
   *
   * <p>`flexGrow: 1` com `flexShrink: 0` é o par que resolve: o segmento CRESCE
   * para ocupar a sobra quando cabe, e mantém a largura natural quando não
   * cabe — e aí a `ScrollView` assume. Tirar o `flexShrink` devolve o corte.
   */
  it("nenhum segmento pode encolher — é o que impede o rótulo de perder letras", () => {
    const { resultado } = montarMedido();

    resultado.getAllByRole("tab").forEach((segmento) => {
      const estilo = StyleSheet.flatten(segmento.props.style);
      expect(estilo.flexShrink).toBe(0);
      expect(estilo.flexGrow).toBe(1);
    });
  });

  it("a pílula tem os 38 px que o dono escolheu", () => {
    const { resultado } = montarMedido();

    expect(StyleSheet.flatten(pilula(resultado).props.style).height).toBe(
      ALTURA,
    );
    const segmento = StyleSheet.flatten(
      resultado.getAllByRole("tab")[0].props.style,
    );
    expect(segmento.height).toBe(ALTURA - RESPIRO * 2);
  });

  it("a marca existe no desenho, atrás dos rótulos", () => {
    const { resultado } = montarMedido();
    // Primeiro filho do conteúdo: ordem de irmãos é o que a põe atrás
    expect(marca(resultado)).toBeTruthy();
    expect(resultado.getAllByRole("tab")).toHaveLength(ABAS.length);
  });

  describe("faixasDaMarca — onde a marca pode estar", () => {
    const medida = (x: number) => ({ x, largura: 85 });

    it("sem medida nenhuma não há onde desenhar", () => {
      expect(faixasDaMarca([], 4)).toBeNull();
    });

    /**
     * O `onLayout` chega um segmento por vez: no quadro do meio o array tem
     * buracos. Interpolar sobre um buraco põe a marca em `NaN` — ela
     * desaparece ou vai para o canto, e só no aparelho alguém veria.
     */
    it("com a lista furada também não", () => {
      const furada = [medida(0), undefined, medida(170), medida(255)];
      expect(faixasDaMarca(furada, 4)).toBeNull();
    });

    it("medida a menos: espera, em vez de desenhar torto", () => {
      expect(faixasDaMarca([medida(0), medida(85)], 4)).toBeNull();
    });

    it("completa, entrega uma faixa por aba", () => {
      const todas = [medida(0), medida(85), medida(170), medida(255)];
      expect(faixasDaMarca(todas, 4)).toEqual({
        entrada: [0, 1, 2, 3],
        x: [0, 85, 170, 255],
        largura: [85, 85, 85, 85],
      });
    });

    it("larguras diferentes por rótulo — é o caso real", () => {
      // "Extrato" é mais curto que "Investimentos": a marca precisa MUDAR de
      // largura no caminho, não só deslizar
      const naturais = [
        { x: 0, largura: 72 },
        { x: 74, largura: 64 },
        { x: 140, largura: 96 },
        { x: 238, largura: 104 },
      ];
      expect(faixasDaMarca(naturais, 4)?.largura).toEqual([72, 64, 96, 104]);
    });

    it("sem aba nenhuma não estoura", () => {
      expect(faixasDaMarca([], 0)).toBeNull();
    });
  });

  it("a primeira montagem não desliza: a marca já nasce sobre a aba ativa", () => {
    montarMedido(3);
    expect(mockTiming).not.toHaveBeenCalled();
  });

  it("trocar de aba desliza a marca", () => {
    const { resultado } = montarMedido(0);
    jest.clearAllMocks();

    resultado.rerender(<SegmentedTopTabBar {...props(2).props} />);

    expect(mockTiming).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ duration: 250 }),
    );
  });

  it("tocar num segmento navega, e no ativo não faz nada", () => {
    const { resultado, navigate } = montarMedido(0);

    fireEvent.press(resultado.getAllByRole("tab")[2]);
    expect(navigate).toHaveBeenCalledWith("Recorrências");

    navigate.mockClear();
    fireEvent.press(resultado.getAllByRole("tab")[0]);
    expect(navigate).not.toHaveBeenCalled();
  });

  /**
   * `tabPress` cancelável é contrato do navigator: uma tela pode barrar a
   * saída (um formulário com alterações não salvas). Emitir o evento e ignorar
   * a resposta tiraria esse direito dela sem ninguém perceber.
   */
  it("respeita uma tela que barra a troca de aba", () => {
    const emit = jest.fn(() => ({ defaultPrevented: true }));
    const { props: p } = props(0, emit);
    const resultado = render(<SegmentedTopTabBar {...p} />);

    fireEvent.press(resultado.getAllByRole("tab")[1]);

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "tabPress", canPreventDefault: true }),
    );
    expect((p.navigation as any).navigate).not.toHaveBeenCalled();
  });

  /**
   * Escolha 7: *"some ao rolar junto com o header"*. O ponto é devolver os
   * 38 px à lista — por isso ALTURA, e não o `translateY` da ilha de baixo:
   * uma pílula que sobe mas continua reservando a altura não esconde nada.
   */
  it("some ao rolar, e volta quando a lista volta ao topo", () => {
    montarMedido();
    // A montagem não anima: a pílula apenas ESTÁ onde tem de estar
    expect(mockTiming).not.toHaveBeenCalled();

    act(() => {
      useTabBarStore.setState({ escondida: true });
    });
    expect(mockTiming).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ duration: 250 }),
    );

    jest.clearAllMocks();
    act(() => {
      useTabBarStore.setState({ escondida: false });
    });
    expect(mockTiming).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ duration: 250 }),
    );
  });

  /**
   * O colapso mede ALTURA, e não o `translateY` da ilha de baixo: o ponto da
   * escolha 7 é devolver os 38 px à lista, e uma pílula que sobe mas continua
   * reservando a altura não teria escondido nada. O respiro de baixo vai
   * junto — senão sobrariam 8 px de nada entre o header e o conteúdo.
   */
  it("o colapso é de altura, não de deslocamento", () => {
    const fonte = fs.readFileSync(
      path.join(__dirname, "..", "SegmentedTopTabBar.tsx"),
      "utf8",
    );
    const colapso = fonte.slice(
      fonte.indexOf("const estiloColapso"),
      fonte.indexOf("const faixas"),
    );
    expect(colapso).toMatch(/height: interpolate/);
    expect(colapso).toMatch(/marginBottom: interpolate/);
    expect(colapso).not.toMatch(/translate/);
  });

  it("com movimento reduzido o colapso é seco", () => {
    mockReducedMotion.mockReturnValue(true);
    montarMedido();
    jest.clearAllMocks();

    act(() => {
      useTabBarStore.setState({ escondida: true });
    });

    expect(mockTiming).not.toHaveBeenCalled();
  });
});
