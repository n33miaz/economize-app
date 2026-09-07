import { railKeyForRoute } from "../routes/railDestinations";

import type { PlanId } from "../services/api";

/**
 * Quando a oferta do Plus pode aparecer.
 *
 * <p>Tudo aqui é função pura sobre números e datas — sem store, sem tela —
 * porque o risco deste recurso não é técnico, é de tom: uma oferta que
 * aparece na hora errada ensina a fechar tudo que se parece com ela, e a
 * partir daí nenhum aviso do app é lido. As regras são poucas e cada uma tem
 * um teste com o motivo.
 */

export const DAY_MS = 86_400_000;

/** As duas primeiras aberturas são de quem ainda não viu valor nenhum. */
export const MIN_SESSIONS_BEFORE_OFFER = 2;

/** Silêncio mínimo entre duas exibições. */
export const OFFER_COOLDOWN_DAYS = 7;

/** Quem já disse "tenho interesse" não é perguntado de novo por um mês. */
export const INTEREST_COOLDOWN_DAYS = 30;

export type PremiumOfferVerdict =
  | "show"
  /** Já é Plus: não há o que oferecer. */
  | "plus"
  /** Perfil ainda não carregou — sem a data do cadastro não dá para decidir. */
  | "not-ready"
  | "first-sessions"
  | "signup-day"
  | "interest"
  | "cooldown"
  | "already-this-session"
  | "task-screen";

export interface PremiumOfferContext {
  /** Agora, em epoch ms — vem de fora para o teste mandar no relógio. */
  now: number;
  plan: PlanId;
  sessionCount: number;
  /** Início da sessão atual (epoch ms). */
  sessionStartedAt: number;
  /** `createdAt` do perfil, em ISO. `undefined` = perfil ainda não carregou. */
  registeredAt: string | null | undefined;
  lastShownAt: number | null;
  interestAt: number | null;
  /** O servidor já sabe do interesse (registrado aqui ou em outro aparelho). */
  interestRegistered: boolean;
  /** Nome da rota onde a oferta apareceria. */
  routeName?: string;
}

/** Mesmo dia do calendário LOCAL: cadastro às 23h e oferta à 1h são dias diferentes. */
export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Tela de tarefa (revisar, agendar, trocar senha) ou tela sem lugar no trilho
 * (login, rota desconhecida). Reaproveita a decisão que o trilho já tomou:
 * `null` lá significa "não é destino", e é exatamente onde uma oferta
 * interromperia algo que a pessoa estava fazendo.
 */
export function isTaskScreen(routeName?: string): boolean {
  return railKeyForRoute(routeName) === undefined;
}

export function decidePremiumOffer(ctx: PremiumOfferContext): PremiumOfferVerdict {
  if (ctx.plan === "PLUS") return "plus";
  if (isTaskScreen(ctx.routeName)) return "task-screen";
  if (ctx.registeredAt === undefined) return "not-ready";
  if (ctx.sessionCount <= MIN_SESSIONS_BEFORE_OFFER) return "first-sessions";

  if (ctx.registeredAt) {
    const registered = new Date(ctx.registeredAt);
    if (
      !Number.isNaN(registered.getTime()) &&
      isSameLocalDay(registered, new Date(ctx.now))
    ) {
      return "signup-day";
    }
  }

  // O servidor sabendo já basta: quem respondeu sim em outro aparelho não
  // precisa responder de novo neste. Sem data do lado dele, o silêncio vale
  // enquanto o pagamento não existir — e aí a pergunta muda de natureza.
  if (ctx.interestRegistered) return "interest";
  if (
    ctx.interestAt != null &&
    ctx.now - ctx.interestAt < INTEREST_COOLDOWN_DAYS * DAY_MS
  ) {
    return "interest";
  }

  if (ctx.lastShownAt != null) {
    // A ordem importa: uma sessão pode durar mais que a carência (app que
    // nunca fecha), e nesse caso é ESTA regra que segura a segunda exibição
    if (ctx.lastShownAt >= ctx.sessionStartedAt) return "already-this-session";
    if (ctx.now - ctx.lastShownAt < OFFER_COOLDOWN_DAYS * DAY_MS) return "cooldown";
  }

  return "show";
}
