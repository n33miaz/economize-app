import { Platform } from "react-native";
import { create } from "zustand";

import {
  getAppVersion,
  type UpgradeRequiredProblem,
  type VersionInfo,
} from "../services/api";
import {
  APP_VERSION,
  DEFAULT_DOWNLOAD_URL,
  UNKNOWN_VERSION,
  isBelow,
} from "../utils/appVersion";

/**
 * Versão do app × o que o servidor aceita.
 *
 * <p>NÃO é persistido de propósito: a resposta de ontem não vale hoje, e um
 * "upgrade-required" guardado em disco travaria o app até depois de ele ter
 * sido atualizado. Cada abertura consulta de novo; enquanto não consegue,
 * fica em "unknown" — que libera.
 */
export type VersionStatus =
  | "unknown"
  | "ok"
  /** Há versão mais nova, mas esta ainda funciona: aviso discreto. */
  | "update-available"
  /** Abaixo da mínima: o servidor não responde mais a esta versão. */
  | "upgrade-required";

interface VersionState {
  status: VersionStatus;
  info: VersionInfo | null;
  /** Última consulta bem-sucedida (epoch ms). */
  checkedAt: number | null;
  /**
   * O servidor devolveu 426 nesta sessão. A partir daí a consulta de versão
   * não REBAIXA mais o status: um servidor que recusa e ao mesmo tempo diz
   * "está tudo bem" faria o gate piscar, e o que vale é a recusa.
   */
  refusedByServer: boolean;
  /** Faixa "nova versão" fechada nesta sessão (só a web tem faixa). */
  bannerDismissed: boolean;
  check: () => Promise<void>;
  markUpgradeRequired: (problem?: UpgradeRequiredProblem | null) => void;
  dismissBanner: () => void;
}

/**
 * A decisão, isolada para o teste chegar nela sem rede e sem trocar de
 * plataforma no meio do caminho.
 *
 * <ul>
 *   <li>Nativo abaixo da mínima → bloqueia.</li>
 *   <li>Abaixo da última → avisa (nativo e web — na web o bundle pode estar
 *       em cache velho, e o aviso é o que leva ao reload).</li>
 *   <li>Web NUNCA bloqueia: não há o que baixar, o reload já é a versão nova.</li>
 *   <li>Versão local desconhecida → "ok": é bug de build, e bloquear todo
 *       mundo por causa dele seria o pior dos dois erros. O servidor continua
 *       sendo a autoridade — se recusar, o 426 chega de qualquer jeito.</li>
 * </ul>
 */
export function decideVersionStatus(
  current: string,
  info: Pick<VersionInfo, "minVersion" | "latestVersion">,
  platform: string = Platform.OS,
): VersionStatus {
  if (current === UNKNOWN_VERSION) return "ok";
  const web = platform === "web";
  if (!web && isBelow(current, info.minVersion)) return "upgrade-required";
  if (isBelow(current, info.latestVersion)) return "update-available";
  return "ok";
}

export const useVersionStore = create<VersionState>((set, get) => ({
  status: "unknown",
  info: null,
  checkedAt: null,
  refusedByServer: false,
  bannerDismissed: false,

  check: async () => {
    try {
      const info = await getAppVersion();
      const decided = decideVersionStatus(APP_VERSION, info);
      const { refusedByServer, status } = get();
      set({
        status: refusedByServer ? status : decided,
        info,
        checkedAt: Date.now(),
      });
    } catch {
      // Sem rede (ou servidor hibernado) não é motivo para bloquear ninguém:
      // o estado anterior fica, e a próxima abertura tenta de novo
    }
  },

  markUpgradeRequired: (problem) => {
    const previous = get().info;
    // O corpo do 426 traz a mínima e o download; o resto (última versão, APK)
    // vem da consulta completa, que é disparada logo abaixo. O bloqueio não
    // espera por ela: já dá para mostrar a tela com o que se tem.
    const info: VersionInfo = {
      minVersion: problem?.minVersion ?? previous?.minVersion ?? APP_VERSION,
      latestVersion:
        previous?.latestVersion ?? problem?.minVersion ?? APP_VERSION,
      downloadUrl:
        problem?.downloadUrl ?? previous?.downloadUrl ?? DEFAULT_DOWNLOAD_URL,
      storeUrl: previous?.storeUrl ?? null,
      apkUrl: previous?.apkUrl ?? null,
      message: problem?.detail ?? previous?.message ?? null,
    };
    set({
      // Na web não há o que baixar: o bundle novo vem no reload. Vira aviso.
      status: Platform.OS === "web" ? "update-available" : "upgrade-required",
      info,
      checkedAt: Date.now(),
      refusedByServer: true,
    });
    void get().check();
  },

  dismissBanner: () => set({ bannerDismissed: true }),
}));
