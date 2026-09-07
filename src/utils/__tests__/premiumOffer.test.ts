import { APP_ROUTES, MAIN_TAB_ROUTES } from "../../routes/routeNames";
import {
  DAY_MS,
  INTEREST_COOLDOWN_DAYS,
  MIN_SESSIONS_BEFORE_OFFER,
  OFFER_COOLDOWN_DAYS,
  decidePremiumOffer,
  isSameLocalDay,
  isTaskScreen,
  type PremiumOfferContext,
} from "../premiumOffer";

// Meio-dia local, para a regra do "mesmo dia" não depender do fuso da máquina
const AGORA = new Date(2026, 8, 6, 12, 0, 0).getTime();

const base = (over: Partial<PremiumOfferContext> = {}): PremiumOfferContext => ({
  now: AGORA,
  plan: "FREE",
  sessionCount: 5,
  sessionStartedAt: AGORA - 60_000,
  registeredAt: new Date(2026, 0, 10, 10, 0, 0).toISOString(),
  lastShownAt: null,
  interestAt: null,
  interestRegistered: false,
  routeName: MAIN_TAB_ROUTES.principal,
  ...over,
});

/**
 * Quando a oferta do Plus pode aparecer.
 *
 * <p>Cada regra tem um teste com o MOTIVO, porque o risco aqui é de tom: uma
 * oferta na hora errada ensina a fechar tudo que se parece com ela.
 */
describe("decidePremiumOffer", () => {
  it("no caso comum, mostra", () => {
    expect(decidePremiumOffer(base())).toBe("show");
  });

  it("jamais para quem já é Plus", () => {
    expect(decidePremiumOffer(base({ plan: "PLUS" }))).toBe("plus");
  });

  it("nunca nas duas primeiras sessões — ninguém viu valor ainda", () => {
    expect(decidePremiumOffer(base({ sessionCount: 1 }))).toBe("first-sessions");
    expect(decidePremiumOffer(base({ sessionCount: 2 }))).toBe("first-sessions");
    expect(decidePremiumOffer(base({ sessionCount: MIN_SESSIONS_BEFORE_OFFER + 1 }))).toBe(
      "show",
    );
  });

  it("nunca no mesmo dia do cadastro", () => {
    const hojeCedo = new Date(2026, 8, 6, 8, 30, 0).toISOString();
    expect(decidePremiumOffer(base({ registeredAt: hojeCedo }))).toBe("signup-day");

    // Ontem à noite já é outro dia — o que conta é o calendário, não 24h
    const ontemTarde = new Date(2026, 8, 5, 23, 50, 0).toISOString();
    expect(decidePremiumOffer(base({ registeredAt: ontemTarde }))).toBe("show");
  });

  it("espera o perfil carregar: sem a data do cadastro não há como decidir", () => {
    expect(decidePremiumOffer(base({ registeredAt: undefined }))).toBe("not-ready");
  });

  it("servidor antigo sem `createdAt` não trava a oferta para sempre", () => {
    expect(decidePremiumOffer(base({ registeredAt: null }))).toBe("show");
  });

  it("data de cadastro ilegível não é 'hoje'", () => {
    expect(decidePremiumOffer(base({ registeredAt: "quando?" }))).toBe("show");
  });

  it("quem já disse 'tenho interesse' fica em paz por 30 dias", () => {
    const ha29dias = AGORA - 29 * DAY_MS;
    const ha31dias = AGORA - 31 * DAY_MS;
    expect(decidePremiumOffer(base({ interestAt: ha29dias }))).toBe("interest");
    expect(decidePremiumOffer(base({ interestAt: ha31dias }))).toBe("show");
    expect(INTEREST_COOLDOWN_DAYS).toBe(30);
  });

  it("o servidor sabendo do interesse basta — mesmo sem data local", () => {
    // Quem respondeu sim em outro aparelho não precisa responder de novo aqui
    expect(decidePremiumOffer(base({ interestRegistered: true }))).toBe("interest");
  });

  it("sete dias de silêncio entre uma exibição e a próxima", () => {
    const ha3dias = AGORA - 3 * DAY_MS;
    const ha8dias = AGORA - 8 * DAY_MS;
    expect(decidePremiumOffer(base({ lastShownAt: ha3dias }))).toBe("cooldown");
    expect(decidePremiumOffer(base({ lastShownAt: ha8dias }))).toBe("show");
    expect(OFFER_COOLDOWN_DAYS).toBe(7);
  });

  it("no máximo uma por sessão, mesmo numa sessão que dura mais que a carência", () => {
    // App que nunca fecha: a carência de 7 dias passou, mas a exibição foi
    // NESTA sessão — e isso basta para segurar a segunda
    const inicioSessao = AGORA - 10 * DAY_MS;
    expect(
      decidePremiumOffer(
        base({ sessionStartedAt: inicioSessao, lastShownAt: AGORA - 9 * DAY_MS }),
      ),
    ).toBe("already-this-session");
  });

  it("nunca em tela de tarefa — revisar, agendar, trocar senha", () => {
    expect(decidePremiumOffer(base({ routeName: APP_ROUTES.revisao }))).toBe("task-screen");
    expect(decidePremiumOffer(base({ routeName: APP_ROUTES.agendamento }))).toBe(
      "task-screen",
    );
    expect(decidePremiumOffer(base({ routeName: APP_ROUTES.alterarSenha }))).toBe(
      "task-screen",
    );
  });

  it("nem em tela de autenticação ou rota desconhecida", () => {
    expect(decidePremiumOffer(base({ routeName: "Login" }))).toBe("task-screen");
    expect(decidePremiumOffer(base({ routeName: undefined }))).toBe("task-screen");
  });

  it("Home e Perfil são os lugares certos", () => {
    expect(decidePremiumOffer(base({ routeName: MAIN_TAB_ROUTES.principal }))).toBe("show");
    expect(decidePremiumOffer(base({ routeName: APP_ROUTES.perfil }))).toBe("show");
  });
});

describe("isTaskScreen", () => {
  it("reaproveita a decisão do trilho: sem destino é tarefa", () => {
    expect(isTaskScreen(APP_ROUTES.revisao)).toBe(true);
    expect(isTaskScreen(APP_ROUTES.seguranca)).toBe(true);
    expect(isTaskScreen(APP_ROUTES.plano)).toBe(false);
    expect(isTaskScreen(MAIN_TAB_ROUTES.financas)).toBe(false);
  });
});

describe("isSameLocalDay", () => {
  it("compara o calendário local, não 24 horas", () => {
    expect(
      isSameLocalDay(new Date(2026, 8, 6, 0, 1), new Date(2026, 8, 6, 23, 59)),
    ).toBe(true);
    expect(
      isSameLocalDay(new Date(2026, 8, 5, 23, 59), new Date(2026, 8, 6, 0, 1)),
    ).toBe(false);
  });
});
