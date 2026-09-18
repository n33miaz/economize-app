import type { Indicator } from "../../services/api";
import {
  dayRange,
  dayRangeLabel,
  formatIndicatorValue,
  positionInDayRange,
} from "../indicatorFormat";
import {
  ativoDaManchete,
  fraseDoDia,
  origemDaManchete,
} from "../marketHeadline";

const ativo = (over: Partial<Indicator> = {}): Indicator =>
  ({
    id: over.id ?? "usd",
    type: "currency",
    code: "USD",
    name: "Dólar Americano/Real",
    buy: 5.2,
    sell: 5.21,
    variation: 0,
    ...over,
  }) as Indicator;

describe("formatIndicatorValue", () => {
  /**
   * Ausência de preço é um FATO ("o catálogo não gastou cota com este ativo"),
   * não o número zero. `Number(null) || 0` apagava a diferença e o card
   * afirmava R$ 0,00 com a variação certa ao lado.
   */
  it("sem cotação, desenha traço — nunca zero", () => {
    expect(formatIndicatorValue({ value: null })).toBe("—");
    expect(formatIndicatorValue({ value: undefined })).toBe("—");
    expect(formatIndicatorValue({ value: Number.NaN })).toBe("—");
  });

  it("zero é um preço, e sai como preço", () => {
    // Diferente de ausência: se a fonte diz zero, a tela diz zero
    expect(formatIndicatorValue({ value: 0 })).toBe("R$ 0,00");
  });

  /**
   * Pelo TIPO, e não só pelo símbolo: o catálogo não passa símbolo e mostrava
   * o IBOVESPA como "R$ 179.722,48".
   */
  it("índice é pontuado, mesmo sem símbolo", () => {
    expect(formatIndicatorValue({ value: 179722.48, type: "index" })).toBe(
      "179.722 pts",
    );
    expect(formatIndicatorValue({ value: 179722.48, symbol: "pts" })).toBe(
      "179.722 pts",
    );
  });

  /**
   * Peso argentino e iene saíam "R$ 0,00" ao lado de uma variação de -0,82%.
   */
  it("abaixo de R$ 0,10 mostra quatro casas", () => {
    expect(formatIndicatorValue({ value: 0.0342 })).toBe("R$ 0,0342");
    expect(formatIndicatorValue({ value: 0.1 })).toBe("R$ 0,10");
  });

  it("respeita o símbolo de quem chama", () => {
    expect(formatIndicatorValue({ value: 1.08, symbol: "US$" })).toBe(
      "US$ 1,08",
    );
  });
});

describe("faixa do dia", () => {
  it("com os dois extremos, escreve a faixa", () => {
    expect(dayRangeLabel(42.1, 43.55)).toBe("Dia: 42,10 – 43,55");
  });

  it("faltando um extremo, não há faixa", () => {
    expect(dayRangeLabel(null, 43.55)).toBeNull();
    expect(dayRangeLabel(42.1, null)).toBeNull();
  });

  /**
   * Faixa invertida ou de largura zero não é faixa — é fonte ruim. Desenhar
   * uma barra a partir dela daria divisão por zero, e "Dia: 5,00 – 5,00" diria
   * que o papel não se moveu quando o que houve foi dado faltando.
   */
  it("faixa invertida ou plana não é faixa", () => {
    expect(dayRangeLabel(43.55, 42.1)).toBeNull();
    expect(dayRangeLabel(5, 5)).toBeNull();
    expect(dayRange(5, 5)).toBeNull();
  });

  it("zero como extremo não vira ausência", () => {
    // Um extremo do dia igual a zero é suspeito, mas 0 → 1 é uma faixa válida
    expect(dayRange(0, 1)).toEqual({ baixa: 0, alta: 1 });
  });
});

describe("positionInDayRange", () => {
  it("na mínima é 0, na máxima é 1, no meio é 0,5", () => {
    expect(positionInDayRange(10, 10, 20)).toBe(0);
    expect(positionInDayRange(20, 10, 20)).toBe(1);
    expect(positionInDayRange(15, 10, 20)).toBe(0.5);
  });

  /**
   * Cotação e extremos chegam da fonte em momentos diferentes: um preço um
   * centavo fora da faixa desenharia a marca do lado de fora da barra.
   */
  it("preço fora da faixa fica preso à borda", () => {
    expect(positionInDayRange(25, 10, 20)).toBe(1);
    expect(positionInDayRange(5, 10, 20)).toBe(0);
  });

  it("sem faixa ou sem preço, não há posição", () => {
    expect(positionInDayRange(15, null, 20)).toBeNull();
    expect(positionInDayRange(null, 10, 20)).toBeNull();
  });
});

describe("ativoDaManchete", () => {
  /**
   * "O ativo que você mais olha" não existe como dado: o app não conta
   * aberturas. O sinal que JÁ existe é mais forte que uma contagem — favoritar
   * é a pessoa dizendo com o dedo qual ativo importa.
   */
  it("o primeiro favorito ganha da curadoria", () => {
    const favorito = ativo({ id: "fav", code: "BTC" });
    const destaque = ativo({ id: "dest", code: "IBOV" });

    expect(ativoDaManchete([favorito], [destaque])?.id).toBe("fav");
    expect(origemDaManchete([favorito])).toBe("favorito");
  });

  it("sem favorito, vale o primeiro destaque", () => {
    const destaque = ativo({ id: "dest" });
    expect(ativoDaManchete([], [destaque])?.id).toBe("dest");
    expect(origemDaManchete([])).toBe("destaque");
  });

  it("sem nenhum dos dois, não há manchete", () => {
    // A tela começa direto pela grade, em vez de reservar espaço para um card
    // vazio
    expect(ativoDaManchete([], [])).toBeNull();
  });
});

describe("fraseDoDia", () => {
  it("sem cotação, diz isso e para", () => {
    expect(fraseDoDia(ativo({ buy: null as never, points: null }))).toBe(
      "Sem cotação agora.",
    );
  });

  it("sem faixa do dia, fala só do movimento", () => {
    expect(fraseDoDia(ativo({ variation: 1.23 }))).toBe("Subiu 1,23% hoje.");
    expect(fraseDoDia(ativo({ variation: -0.8 }))).toBe("Caiu 0,80% hoje.");
    expect(fraseDoDia(ativo({ variation: 0 }))).toBe("Sem variação hoje.");
  });

  /**
   * É o que a porcentagem do dia não dá: "subiu 1,2%" e "está a um centavo da
   * máxima" são fatos diferentes, e o segundo é o que responde "ainda vale a
   * pena esperar?".
   */
  it("perto da máxima e perto da mínima, a frase diz onde está", () => {
    const naMaxima = ativo({
      variation: 1.2,
      buy: 5.29,
      dayLow: 5.1,
      dayHigh: 5.3,
    });
    expect(fraseDoDia(naMaxima)).toBe(
      "Subiu 1,20% hoje, e está perto da máxima do dia.",
    );

    const naMinima = ativo({
      variation: -1.2,
      buy: 5.11,
      dayLow: 5.1,
      dayHigh: 5.3,
    });
    expect(fraseDoDia(naMinima)).toBe(
      "Caiu 1,20% hoje, e está perto da mínima do dia.",
    );
  });

  it("no meio da faixa, a frase entrega os dois extremos", () => {
    const meio = ativo({
      variation: 0.3,
      buy: 5.2,
      dayLow: 5.1,
      dayHigh: 5.3,
    });
    expect(fraseDoDia(meio)).toBe(
      "Subiu 0,30% hoje; o dia foi de 5,10 a 5,30.",
    );
  });

  it("índice usa pontos, não o preço de compra", () => {
    const indice = ativo({
      type: "index",
      points: 179722,
      buy: 0,
      variation: 0.5,
    });
    // Sem cair no "sem cotação" por causa do `buy` zerado
    expect(fraseDoDia(indice)).toBe("Subiu 0,50% hoje.");
  });

  /**
   * O app sabe que o número subiu, não POR QUE subiu. Nenhuma frase aqui pode
   * afirmar causa — é o mesmo cuidado do extrato ao não separar estorno de
   * pagamento de fatura.
   */
  it("nenhuma frase promete causa", () => {
    const frases = [
      fraseDoDia(ativo({ variation: 2 })),
      fraseDoDia(ativo({ variation: -2, dayLow: 1, dayHigh: 2, buy: 1.05 })),
      fraseDoDia(ativo({ variation: 0 })),
    ];
    frases.forEach((frase) => {
      expect(frase).not.toMatch(/por causa|porque|devido|com o dólar|puxad/i);
    });
  });
});
