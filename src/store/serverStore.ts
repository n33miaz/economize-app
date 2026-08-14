import axios from "axios";
import { create } from "zustand";

// O plano free do Render hiberna a API depois de ~15 min sem tráfego, e o
// primeiro acesso leva perto de um minuto para subir o container. Sem este
// aviso o usuário só via o botão "Entrar" travado até estourar o timeout.
const POLL_INTERVAL_MS = 3000;
const MAX_WAIT_MS = 90000;
const PROBE_TIMEOUT_MS = 8000;

interface ServerState {
  isWaking: boolean;
  waitedSeconds: number;
  setWaking: (value: boolean) => void;
  setWaitedSeconds: (value: number) => void;
}

export const useServerStore = create<ServerState>((set) => ({
  isWaking: false,
  waitedSeconds: 0,
  setWaking: (value) =>
    set({ isWaking: value, waitedSeconds: value ? 0 : 0 }),
  setWaitedSeconds: (value) => set({ waitedSeconds: value }),
}));

/** `/actuator/health` fica fora do `/api/v1` e não pede autenticação. */
export const healthUrlFrom = (baseUrl: string) =>
  `${baseUrl.replace(/\/api\/v1\/?$/, "")}/actuator/health`;

// Várias telas disparam requisições ao mesmo tempo; um único poll serve a
// todas em vez de cada uma abrir o seu
let inFlight: Promise<boolean> | null = null;

const poll = async (healthUrl: string): Promise<boolean> => {
  const store = useServerStore.getState();
  store.setWaking(true);
  const startedAt = Date.now();

  try {
    while (Date.now() - startedAt < MAX_WAIT_MS) {
      try {
        const response = await axios.get(healthUrl, {
          timeout: PROBE_TIMEOUT_MS,
        });
        if (response.status === 200) return true;
      } catch {
        // Ainda subindo: continua o poll
      }
      useServerStore
        .getState()
        .setWaitedSeconds(Math.round((Date.now() - startedAt) / 1000));
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    return false;
  } finally {
    useServerStore.getState().setWaking(false);
  }
};

/**
 * Espera a API responder. Devolve `true` se acordou dentro da janela, `false`
 * se estourou — quem chama decide se ainda vale tentar de novo.
 */
export const waitForServer = (healthUrl: string): Promise<boolean> => {
  if (!inFlight) {
    inFlight = poll(healthUrl).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
};
