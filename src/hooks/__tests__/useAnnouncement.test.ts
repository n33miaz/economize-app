import { act, renderHook } from "@testing-library/react-native";

import { useAnnouncement } from "../useAnnouncement";
import { useAnnouncementStore } from "../../store/announcementStore";
import { clearSessionData } from "../../store/sessionReset";

/**
 * A fila de anúncios diante da limpeza de sessão.
 *
 * <p>A fila é esvaziada quando a sessão acaba e quando outra começa. Isso é
 * certo para o anúncio que morava na árvore autenticada (ele desmontou) e
 * errado para o que mora na RAIZ do app — aviso de versão, tranca —, que
 * continua montado e continua querendo falar.
 */
describe("useAnnouncement", () => {
  beforeEach(() => {
    useAnnouncementStore.getState().reset();
  });

  it("quem continua montado pede a vez de novo depois da limpeza", () => {
    const { result } = renderHook(() => useAnnouncement("versao", 10, true));
    expect(result.current).toBe(true);

    // é o que o login faz ao gravar a sessão
    act(() => clearSessionData());

    expect(useAnnouncementStore.getState().claims).toEqual({ versao: 10 });
    expect(result.current).toBe(true);
  });

  it("quem desmontou não volta para a fila", () => {
    const { unmount } = renderHook(() => useAnnouncement("pote", 30, true));
    unmount();

    act(() => clearSessionData());

    expect(useAnnouncementStore.getState().claims).toEqual({});
  });

  it("quem não quer falar não entra na fila por causa da limpeza", () => {
    const { result } = renderHook(() => useAnnouncement("oferta", 40, false));

    act(() => clearSessionData());

    expect(useAnnouncementStore.getState().claims).toEqual({});
    expect(result.current).toBe(false);
  });
});
