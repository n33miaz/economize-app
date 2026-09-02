import {
  describeLanding,
  lastLanding,
  mealVoucherAsk,
} from "../mealVoucher";

import type { IncomeSource } from "../../services/api";

const fonte = (over: Partial<IncomeSource> = {}): IncomeSource => ({
  id: "vr-1",
  kind: "MEAL_VOUCHER",
  name: "Vale-refeição",
  expectedAmount: 600,
  anchorDay: 25,
  confirmed: true,
  active: true,
  seriesId: null,
  ...over,
});

const pergunta = (over: Parameters<typeof mealVoucherAsk>[0] | null = null) =>
  mealVoucherAsk({
    sources: [fonte()],
    today: "2026-08-28",
    lastTransactionDate: "2026-08-20",
    dismissedFor: null,
    ...(over ?? {}),
  });

describe("lastLanding", () => {
  it("usa a queda deste mês quando o dia já passou", () => {
    expect(lastLanding(25, "2026-08-28")).toBe("2026-08-25");
  });

  it("antes do dia, a última queda é a do mês passado", () => {
    expect(lastLanding(25, "2026-08-03")).toBe("2026-07-25");
  });

  it("no próprio dia da queda já conta como caído", () => {
    expect(lastLanding(25, "2026-08-25")).toBe("2026-08-25");
  });

  it("mês que não tem o dia da âncora cai no último", () => {
    // Procurar o dia 31 literalmente responderia "nunca caiu" em fevereiro
    expect(lastLanding(31, "2026-02-28")).toBe("2026-02-28");
  });

  it("atravessa a virada do ano", () => {
    expect(lastLanding(25, "2026-01-10")).toBe("2025-12-25");
  });
});

describe("mealVoucherAsk", () => {
  it("pergunta quando o VR caiu e o extrato ainda não alcançou o dia", () => {
    const ask = pergunta();
    expect(ask).not.toBeNull();
    expect(ask!.landedOn).toBe("2026-08-25");
    expect(ask!.daysAgo).toBe(3);
    expect(ask!.amount).toBe(600);
  });

  it("cala quando o extrato já alcança o dia da queda", () => {
    // Não há o que pedir: o dado daquele dia já está no app
    expect(pergunta({ ...base(), lastTransactionDate: "2026-08-26" })).toBeNull();
  });

  it("servidor sem o campo não vira silêncio", () => {
    // Não saber até onde o extrato vai é diferente de saber que já chegou
    expect(
      pergunta({ ...base(), lastTransactionDate: undefined }),
    ).not.toBeNull();
  });

  it("passada a janela de dez dias, para de perguntar", () => {
    // Aviso que não é útil ensina a ignorar o próximo, que talvez fosse
    expect(pergunta({ ...base(), today: "2026-09-06" })).toBeNull();
  });

  it("dispensa vale só para aquela queda", () => {
    expect(pergunta({ ...base(), dismissedFor: "2026-08-25" })).toBeNull();
    // a do mês seguinte volta a perguntar
    const proxima = pergunta({
      ...base(),
      today: "2026-09-26",
      lastTransactionDate: "2026-09-20",
      dismissedFor: "2026-08-25",
    });
    expect(proxima!.landedOn).toBe("2026-09-25");
  });

  it("ignora salário: o salário cai na conta e vem no extrato", () => {
    expect(
      pergunta({ ...base(), sources: [fonte({ kind: "SALARY" })] }),
    ).toBeNull();
  });

  it("ignora fonte inativa e fonte sem âncora", () => {
    expect(
      pergunta({ ...base(), sources: [fonte({ active: false })] }),
    ).toBeNull();
    expect(
      pergunta({ ...base(), sources: [fonte({ anchorDay: null })] }),
    ).toBeNull();
  });

  it("fonte não confirmada pergunta, mas sem exibir valor de chute", () => {
    const ask = pergunta({
      ...base(),
      sources: [fonte({ confirmed: false })],
    });
    expect(ask).not.toBeNull();
    expect(ask!.amount).toBeNull();
  });

  it("com duas fontes na janela, pergunta pela queda mais recente", () => {
    const ask = pergunta({
      ...base(),
      today: "2026-09-03",
      lastTransactionDate: "2026-08-20",
      sources: [
        fonte({ id: "vr", anchorDay: 25, name: "Vale-refeição" }),
        fonte({
          id: "va",
          kind: "FOOD_VOUCHER",
          anchorDay: 1,
          name: "Vale-alimentação",
        }),
      ],
    });
    expect(ask!.sourceName).toBe("Vale-alimentação");
    expect(ask!.landedOn).toBe("2026-09-01");
  });
});

describe("describeLanding", () => {
  it("fala em hoje, ontem e dias", () => {
    expect(describeLanding(0)).toBe("Entrou hoje");
    expect(describeLanding(1)).toBe("Entrou ontem");
    expect(describeLanding(3)).toBe("Entrou há 3 dias");
  });
});

function base() {
  return {
    sources: [fonte()],
    today: "2026-08-28",
    lastTransactionDate: "2026-08-20" as string | null | undefined,
    dismissedFor: null as string | null,
  };
}
