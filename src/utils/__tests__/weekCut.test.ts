import { currentWeek, weekComparison } from "../weekCut";
import type { DailyTotal } from "../../services/api";

const dia = (date: string, spent: number, earned = 0): DailyTotal => ({
  date,
  spent,
  earned,
  count: 1,
});

/**
 * EC-234 — a semana na primeira tela.
 *
 * 10/09/2026 é uma quinta-feira; a semana dela abre no domingo 06/09.
 */
const QUINTA = new Date(2026, 8, 10);

describe("Recorte da semana", () => {
  it("a semana abre no domingo, como o calendário desenhado logo abaixo", () => {
    const semana = currentWeek([], QUINTA);

    expect(semana.start).toBe("2026-09-06");
    expect(semana.today).toBe("2026-09-10");
    // domingo a quinta: cinco dias corridos
    expect(semana.daysElapsed).toBe(5);
  });

  it("soma só os dias DESTA semana até hoje", () => {
    const semana = currentWeek(
      [
        dia("2026-09-05", 999), // sexta anterior: fora
        dia("2026-09-06", 50),
        dia("2026-09-08", 188.54, 52.72),
        dia("2026-09-12", 777), // sábado à frente: fora
      ],
      QUINTA,
    );

    expect(semana.spent).toBeCloseTo(238.54);
    expect(semana.earned).toBeCloseTo(52.72);
  });

  it("a semana anterior INTEIRA fica separada, para comparar", () => {
    const semana = currentWeek(
      [
        dia("2026-08-30", 10), // domingo da semana anterior
        dia("2026-09-05", 90), // sábado da semana anterior
        dia("2026-09-06", 50), // esta semana
      ],
      QUINTA,
    );

    expect(semana.previousSpent).toBeCloseTo(100);
    expect(semana.spent).toBeCloseTo(50);
  });

  it("dia de duas semanas atrás não entra em nenhuma das duas", () => {
    const semana = currentWeek([dia("2026-08-20", 500)], QUINTA);

    expect(semana.spent).toBe(0);
    expect(semana.previousSpent).toBe(0);
  });

  it("no domingo, a semana tem um dia só", () => {
    const domingo = new Date(2026, 8, 6);
    const semana = currentWeek([dia("2026-09-06", 50)], domingo);

    expect(semana.start).toBe("2026-09-06");
    expect(semana.daysElapsed).toBe(1);
    expect(semana.spent).toBe(50);
  });
});

/**
 * A comparação é o que mais engana num app de finanças: uma terça-feira
 * contra uma semana inteira faz o app parecer otimista na segunda e alarmista
 * no sábado.
 */
describe("Comparação com a semana passada", () => {
  const semana = (spent: number, previousSpent: number, daysElapsed = 5) => ({
    start: "2026-09-06",
    today: "2026-09-10",
    spent,
    earned: 0,
    previousSpent,
    daysElapsed,
  });

  it("compara PROPORCIONAL aos dias já corridos", () => {
    // 700 na semana passada inteira; cinco dias corridos = 500 de referência.
    // Gastar 500 é o MESMO ritmo, não 29% a menos
    expect(weekComparison(semana(500, 700))).toBe("no mesmo ritmo da semana passada");
  });

  it("acima do ritmo diz quanto", () => {
    // referência 500; gastou 750 = 50% acima
    expect(weekComparison(semana(750, 700))).toBe("50% acima do ritmo da semana passada");
  });

  it("abaixo do ritmo diz quanto", () => {
    // referência 500; gastou 250 = 50% abaixo
    expect(weekComparison(semana(250, 700))).toBe("50% abaixo do ritmo da semana passada");
  });

  it("diferença menor que 5% é ruído da semana, não notícia", () => {
    expect(weekComparison(semana(510, 700))).toBe("no mesmo ritmo da semana passada");
  });

  it("sem semana anterior, NÃO inventa comparação", () => {
    // "0% a mais" contra nada é a mentira mais fácil de escrever
    expect(weekComparison(semana(500, 0))).toBeNull();
  });
});
