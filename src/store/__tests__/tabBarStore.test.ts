import {
  LIMITE_ROLAGEM,
  ZONA_DE_TOPO,
  useTabBarStore,
} from "../tabBarStore";

/**
 * A barra que se esconde ao rolar.
 *
 * <p>O que estes casos protegem não é a animação — é o <b>tremor</b>. Sem zona
 * morta, cada quadro de rolagem inverteria o estado e a barra piscaria; sem a
 * zona de topo, ela ficaria escondida justamente onde a pessoa troca de aba.
 * As duas regras são invisíveis no código e óbvias na mão de quem usa, que é
 * exatamente o tipo de coisa que some numa refatoração sem teste.
 */
describe("ilha da barra de abas", () => {
  beforeEach(() => {
    useTabBarStore.setState({ escondida: false, ultimoY: 0 });
  });

  const rolar = (y: number) => useTabBarStore.getState().aoRolar(y);
  const escondida = () => useTabBarStore.getState().escondida;

  it("rolar para baixo o suficiente esconde a barra", () => {
    rolar(400);

    expect(escondida()).toBe(true);
  });

  it("voltar para cima traz a barra de volta", () => {
    rolar(400);
    rolar(300);

    expect(escondida()).toBe(false);
  });

  /** O tremor: micro-oscilação não pode inverter o estado. */
  it("movimento menor que o limite não muda nada", () => {
    rolar(400);
    const antes = escondida();

    rolar(400 + LIMITE_ROLAGEM - 1);

    expect(escondida()).toBe(antes);
  });

  it("no topo da lista a barra sempre aparece", () => {
    rolar(600);
    expect(escondida()).toBe(true);

    rolar(ZONA_DE_TOPO - 1);

    expect(escondida()).toBe(false);
  });

  /** Rubber-band do iOS devolve deslocamento negativo. */
  it("deslocamento negativo conta como topo, não como rolagem para cima", () => {
    rolar(500);

    rolar(-80);

    expect(escondida()).toBe(false);
    expect(useTabBarStore.getState().ultimoY).toBe(0);
  });

  it("revelar traz a barra de volta sem depender de rolagem", () => {
    rolar(500);
    expect(escondida()).toBe(true);

    useTabBarStore.getState().revelar();

    expect(escondida()).toBe(false);
  });

  it("revelar com a barra já visível não mexe no estado", () => {
    const antes = useTabBarStore.getState();

    useTabBarStore.getState().revelar();

    expect(useTabBarStore.getState()).toBe(antes);
  });

  /**
   * A borda exata do limite: 12 px muda, 11 não. Fica escrito porque o número
   * é decisão de produto — foi o menor valor em que a barra parou de tremer.
   */
  it("a fronteira é o limite de rolagem", () => {
    rolar(100);
    useTabBarStore.setState({ escondida: false, ultimoY: 100 });

    rolar(100 + LIMITE_ROLAGEM);

    expect(escondida()).toBe(true);
  });
});
