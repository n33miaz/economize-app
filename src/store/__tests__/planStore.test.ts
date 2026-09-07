import { getPlans, getUserMe, registerPlanInterest } from "../../services/api";
import { useUserStore } from "../userStore";
import {
  DEFAULT_PLANS,
  resolvePlan,
  selectPlans,
  usePlanStore,
} from "../planStore";

import type { PlansResponse, UserMeWithPlan } from "../../services/api";

jest.mock("../../services/api", () => ({
  getPlans: jest.fn(),
  registerPlanInterest: jest.fn(),
  getUserMe: jest.fn(),
  updateUserMe: jest.fn(),
}));

const mockPlans = getPlans as jest.MockedFunction<typeof getPlans>;
const mockInterest = registerPlanInterest as jest.MockedFunction<
  typeof registerPlanInterest
>;
const mockMe = getUserMe as jest.MockedFunction<typeof getUserMe>;

const AGORA = new Date("2026-09-06T12:00:00Z").getTime();

const perfil = (over: Partial<UserMeWithPlan> = {}): UserMeWithPlan => ({
  id: "u1",
  name: "Alice",
  email: "alice@example.com",
  createdAt: "2026-01-10T10:00:00Z",
  lastLoginAt: null,
  ...over,
});

const CATALOGO: PlansResponse = {
  current: "FREE",
  plans: [
    { id: "FREE", name: "Gratuito", priceMonthly: 0, features: ["Básico"] },
    { id: "PLUS", name: "Plus", priceMonthly: 12.9, features: ["Sem anúncios"] },
  ],
  checkoutAvailable: false,
  interestRegistered: false,
};

/**
 * Plano da conta.
 *
 * <p>O servidor manda; o store defende o app de dois casos que ele não cobre:
 * ser mais velho que o app (sem os campos) e um Plus vencido que ainda não
 * foi rebaixado. Nos dois, o lado seguro é "gratuito, com anúncios".
 */
describe("resolvePlan", () => {
  it("servidor antigo, sem os campos: gratuito com anúncios", () => {
    expect(resolvePlan(perfil(), AGORA)).toEqual({
      plan: "FREE",
      planUntil: null,
      adsEnabled: true,
    });
  });

  it("sem perfil nenhum, idem", () => {
    expect(resolvePlan(null, AGORA).plan).toBe("FREE");
    expect(resolvePlan(undefined, AGORA).adsEnabled).toBe(true);
  });

  it("Plus vigente: sem anúncios, com o prazo", () => {
    expect(
      resolvePlan(
        perfil({ plan: "PLUS", planUntil: "2026-12-31T00:00:00Z", adsEnabled: false }),
        AGORA,
      ),
    ).toEqual({ plan: "PLUS", planUntil: "2026-12-31T00:00:00Z", adsEnabled: false });
  });

  it("Plus sem prazo é Plus", () => {
    expect(
      resolvePlan(perfil({ plan: "PLUS", planUntil: null, adsEnabled: false }), AGORA).plan,
    ).toBe("PLUS");
  });

  it("Plus VENCIDO é tratado como gratuito, com anúncios de volta", () => {
    // O servidor deveria ter rebaixado; se não rebaixou, o app não pode
    // continuar entregando o que não foi pago
    const resolvido = resolvePlan(
      perfil({ plan: "PLUS", planUntil: "2026-08-01T00:00:00Z", adsEnabled: false }),
      AGORA,
    );
    expect(resolvido.plan).toBe("FREE");
    expect(resolvido.adsEnabled).toBe(true);
    // …mas o prazo fica, para a tela poder dizer "venceu em"
    expect(resolvido.planUntil).toBe("2026-08-01T00:00:00Z");
  });

  it("o servidor manda nos anúncios do gratuito também", () => {
    // Um gratuito sem anúncios (promoção, teste) é decisão do servidor
    expect(resolvePlan(perfil({ plan: "FREE", adsEnabled: false }), AGORA).adsEnabled).toBe(
      false,
    );
  });

  it("valor de plano desconhecido cai no gratuito", () => {
    expect(resolvePlan(perfil({ plan: "GOLD" as never }), AGORA).plan).toBe("FREE");
  });
});

describe("planStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePlanStore.getState().reset();
    useUserStore.setState({ me: null, isLoading: false, isSaving: false, error: null });
  });

  it("nasce gratuito com anúncios — o default seguro", () => {
    const state = usePlanStore.getState();
    expect(state.plan).toBe("FREE");
    expect(state.adsEnabled).toBe(true);
    expect(state.checkoutAvailable).toBe(false);
  });

  it("hidrata do perfil", () => {
    usePlanStore
      .getState()
      .hydrateFromUser(perfil({ plan: "PLUS", planUntil: null, adsEnabled: false }));

    expect(usePlanStore.getState().plan).toBe("PLUS");
    expect(usePlanStore.getState().adsEnabled).toBe(false);
  });

  it("o userStore alimenta o plano a cada perfil que chega", async () => {
    mockMe.mockResolvedValue(perfil({ plan: "PLUS", planUntil: null, adsEnabled: false }));

    await useUserStore.getState().fetchMe();

    expect(usePlanStore.getState().plan).toBe("PLUS");
    expect(usePlanStore.getState().adsEnabled).toBe(false);
  });

  it("carrega o catálogo de planos", async () => {
    mockPlans.mockResolvedValue({ ...CATALOGO, interestRegistered: true });

    await usePlanStore.getState().fetchPlans();

    const state = usePlanStore.getState();
    expect(state.plans).toHaveLength(2);
    expect(state.interestRegistered).toBe(true);
    expect(state.hasLoadedPlans).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(selectPlans(state)).toBe(state.plans);
  });

  it("o `current` do catálogo atualiza o plano", async () => {
    mockPlans.mockResolvedValue({ ...CATALOGO, current: "PLUS" });

    await usePlanStore.getState().fetchPlans();

    expect(usePlanStore.getState().plan).toBe("PLUS");
  });

  it("servidor sem a rota: a tela usa a promessa padrão", async () => {
    mockPlans.mockRejectedValue(Object.assign(new Error("404"), { response: { status: 404 } }));

    await usePlanStore.getState().fetchPlans();

    const state = usePlanStore.getState();
    expect(state.plans).toEqual([]);
    expect(state.hasLoadedPlans).toBe(true);
    expect(selectPlans(state)).toBe(DEFAULT_PLANS);
    expect(DEFAULT_PLANS.map((p) => p.id)).toEqual(["FREE", "PLUS"]);
  });

  it("registra interesse e lembra disso", async () => {
    mockInterest.mockResolvedValue();

    const ok = await usePlanStore.getState().registerInterest("PLUS");

    expect(ok).toBe(true);
    expect(mockInterest).toHaveBeenCalledWith("PLUS");
    expect(usePlanStore.getState().interestRegistered).toBe(true);
    expect(usePlanStore.getState().isRegistering).toBe(false);
  });

  it("falha ao registrar devolve false e não finge que registrou", async () => {
    mockInterest.mockRejectedValue(new Error("offline"));

    const ok = await usePlanStore.getState().registerInterest("PLUS");

    expect(ok).toBe(false);
    expect(usePlanStore.getState().interestRegistered).toBe(false);
  });

  it("reset apaga o plano da conta mas não recomeça a sessão", () => {
    const inicio = usePlanStore.getState().sessionStartedAt;
    usePlanStore.getState().hydrateFromUser(perfil({ plan: "PLUS", adsEnabled: false }));

    usePlanStore.getState().reset();

    expect(usePlanStore.getState().plan).toBe("FREE");
    expect(usePlanStore.getState().adsEnabled).toBe(true);
    expect(usePlanStore.getState().sessionStartedAt).toBe(inicio);
  });
});
