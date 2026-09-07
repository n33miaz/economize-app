import { create } from "zustand";

import {
  getPlans,
  registerPlanInterest,
  type PlanId,
  type PlanOption,
  type UserMeWithPlan,
} from "../services/api";

/**
 * Plano da conta e o que ele muda no app (anúncios, por enquanto).
 *
 * <p>É alimentado por `GET /users/me` — o `userStore` chama
 * {@link PlanState.hydrateFromUser} a cada perfil que chega — e não persiste:
 * plano é dado da conta, e a conta que entra depois de um logout não pode
 * herdar o Plus da anterior.
 *
 * <p>O servidor é a autoridade; o que este store faz é defender o app de dois
 * casos que o servidor não cobre: ser mais VELHO que o app (sem os campos →
 * gratuito com anúncios) e um Plus com prazo vencido que ainda não foi
 * rebaixado (→ tratado como gratuito).
 */

export interface ResolvedPlan {
  plan: PlanId;
  planUntil: string | null;
  adsEnabled: boolean;
}

/**
 * Lê os campos de plano do perfil. Pura para o teste chegar nela com um
 * relógio controlado: "expirado" depende de agora.
 */
export function resolvePlan(
  // `UserMe` cru (servidor antigo) também entra: os campos são opcionais
  me: UserMeWithPlan | null | undefined,
  now: number = Date.now(),
): ResolvedPlan {
  // Servidor antigo (ou perfil ausente): gratuito, com anúncios. É o default
  // conservador — errar para o lado de MOSTRAR anúncio a quem pagou seria
  // pior, mas isso o servidor novo nunca faz, e o velho não tem quem pagou.
  const plan: PlanId = me?.plan === "PLUS" ? "PLUS" : "FREE";
  const planUntil = me?.planUntil ?? null;
  const adsEnabled = typeof me?.adsEnabled === "boolean" ? me.adsEnabled : true;

  if (plan === "PLUS" && planUntil) {
    const until = new Date(planUntil).getTime();
    if (!Number.isNaN(until) && until < now) {
      return { plan: "FREE", planUntil, adsEnabled: true };
    }
  }
  return { plan, planUntil, adsEnabled };
}

/**
 * O que o app promete quando o servidor ainda não tem `/plans` (ou está fora
 * do ar). São as MESMAS promessas do servidor — mudar aqui sem mudar lá é
 * anunciar o que não existe.
 */
export const DEFAULT_PLANS: readonly PlanOption[] = [
  {
    id: "FREE",
    name: "Gratuito",
    priceMonthly: 0,
    features: [
      "Extrato, categorias e análise do mês",
      "Recorrências e previsão de saldo",
      "Desejos em horas de trabalho",
      "Com anúncios discretos",
    ],
  },
  {
    id: "PLUS",
    name: "Plus",
    priceMonthly: 9.9,
    features: [
      "Tudo do gratuito",
      "Sem anúncios",
      "Prioridade nas novidades",
      "Apoia o desenvolvimento do app",
    ],
  },
];

interface PlanState extends ResolvedPlan {
  plans: PlanOption[];
  checkoutAvailable: boolean;
  interestRegistered: boolean;
  isLoading: boolean;
  isRegistering: boolean;
  /** Já tentou `/plans` uma vez — evita rebuscar a cada abertura de folha. */
  hasLoadedPlans: boolean;
  /**
   * Quando esta sessão começou (epoch ms). Fica aqui, e não nas preferências,
   * porque NÃO deve sobreviver ao fechamento do app: é o que define "uma
   * oferta por sessão".
   */
  sessionStartedAt: number;

  hydrateFromUser: (me: UserMeWithPlan | null | undefined) => void;
  fetchPlans: () => Promise<void>;
  registerInterest: (plan: PlanId) => Promise<boolean>;
  reset: () => void;
}

const initialState = {
  plan: "FREE" as PlanId,
  planUntil: null as string | null,
  adsEnabled: true,
  plans: [] as PlanOption[],
  checkoutAvailable: false,
  interestRegistered: false,
  isLoading: false,
  isRegistering: false,
  hasLoadedPlans: false,
};

export const usePlanStore = create<PlanState>((set) => ({
  ...initialState,
  sessionStartedAt: Date.now(),

  hydrateFromUser: (me) => set(resolvePlan(me)),

  fetchPlans: async () => {
    set({ isLoading: true });
    try {
      const response = await getPlans();
      set({
        plans: response.plans,
        checkoutAvailable: response.checkoutAvailable,
        interestRegistered: response.interestRegistered,
        // O `current` do catálogo é o mesmo dado do perfil, mais fresco
        ...(response.current === "PLUS" || response.current === "FREE"
          ? { plan: response.current }
          : null),
        isLoading: false,
        hasLoadedPlans: true,
      });
    } catch {
      // Servidor sem a rota (404) ou fora do ar: a tela usa DEFAULT_PLANS
      set({ isLoading: false, hasLoadedPlans: true });
    }
  },

  registerInterest: async (plan) => {
    set({ isRegistering: true });
    try {
      await registerPlanInterest(plan);
      set({ interestRegistered: true, isRegistering: false });
      return true;
    } catch {
      set({ isRegistering: false });
      return false;
    }
  },

  // `sessionStartedAt` fica de fora de propósito: sair da conta não começa
  // uma sessão nova do app
  reset: () => set({ ...initialState }),
}));

/**
 * Os planos a exibir: os do servidor quando vieram, senão a promessa padrão.
 * Devolve a MESMA referência a cada chamada com o mesmo estado — é seletor de
 * store, e um array novo por render faria as telas redesenharem à toa.
 */
export function selectPlans(
  state: Pick<PlanState, "plans">,
): readonly PlanOption[] {
  return state.plans.length > 0 ? state.plans : DEFAULT_PLANS;
}
