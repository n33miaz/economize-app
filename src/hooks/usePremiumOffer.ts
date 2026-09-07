import { useCallback, useEffect, useState } from "react";
import { useRoute } from "@react-navigation/native";

import { usePlanStore } from "../store/planStore";
import { usePreferencesStore } from "../store/preferencesStore";
import { useUserStore } from "../store/userStore";
import { decidePremiumOffer } from "../utils/premiumOffer";

/**
 * Respiro entre a tela aparecer e a folha subir. Oferta no MESMO quadro da
 * tela é emboscada: a pessoa ainda nem viu onde está.
 */
const OFFER_DELAY_MS = 1200;

/**
 * Decide se a oferta do Plus sobe nesta tela, e quando.
 *
 * <p>Uso, nas telas de DESTINO (Home, Perfil):
 * <pre>
 *   const plusOffer = usePremiumOffer();
 *   …
 *   &lt;PremiumOfferSheet visible={plusOffer.visible} onClose={plusOffer.close} /&gt;
 * </pre>
 *
 * <p>As regras moram em `utils/premiumOffer` e são puras; o hook só junta o
 * que elas pedem (contagem de sessões, plano, datas) e respeita o relógio.
 * Chamado numa tela de tarefa, ele próprio se recusa — a rota é lida daqui,
 * então não depende de ninguém lembrar.
 */
export function usePremiumOffer(): { visible: boolean; close: () => void } {
  const route = useRoute();
  const [visible, setVisible] = useState(false);

  const hasHydrated = usePreferencesStore((s) => s.hasHydrated);
  const sessionCount = usePreferencesStore((s) => s.sessionCount);
  const lastShownAt = usePreferencesStore((s) => s.plusOfferLastShownAt);
  const interestAt = usePreferencesStore((s) => s.plusInterestAt);
  const plan = usePlanStore((s) => s.plan);
  const interestRegistered = usePlanStore((s) => s.interestRegistered);
  const sessionStartedAt = usePlanStore((s) => s.sessionStartedAt);
  const me = useUserStore((s) => s.me);

  useEffect(() => {
    if (visible || !hasHydrated) return;
    const verdict = decidePremiumOffer({
      now: Date.now(),
      plan,
      sessionCount,
      sessionStartedAt,
      // `undefined` enquanto o perfil não chegou: sem a data do cadastro a
      // regra do "mesmo dia" não tem como responder, e a folha espera
      registeredAt: me ? (me.createdAt ?? null) : undefined,
      lastShownAt,
      interestAt,
      interestRegistered,
      routeName: route.name,
    });
    if (verdict !== "show") return;

    const timer = setTimeout(() => {
      // Marca ANTES de abrir: se o app morrer com a folha aberta, a exibição
      // conta mesmo assim — e a regra "uma por sessão" passa a valer já
      usePreferencesStore.getState().markPlusOfferShown(Date.now());
      setVisible(true);
    }, OFFER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [
    visible,
    hasHydrated,
    plan,
    sessionCount,
    sessionStartedAt,
    me,
    lastShownAt,
    interestAt,
    interestRegistered,
    route.name,
  ]);

  const close = useCallback(() => setVisible(false), []);

  return { visible, close };
}
