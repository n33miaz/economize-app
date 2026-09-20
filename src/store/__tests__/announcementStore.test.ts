import {
  ANNOUNCEMENT_PRIORITY,
  hasFloor,
  useAnnouncementStore,
} from "../announcementStore";

/**
 * A fila da abertura do app.
 *
 * <p><b>O defeito, relatado pelo dono em 16/09/2026:</b> <i>"os modais estão
 * aparecendo todos ao mesmo tempo ao entrar no app (biometria, nova versão e
 * procure outros)"</i>. Cada anúncio decidia sozinho se aparecia, e as
 * condições deles se satisfazem no MESMO instante — o app acabou de abrir.
 * Três folhas empilhadas não são três avisos: são zero, porque a pessoa fecha
 * tudo no reflexo e o único que importava vai junto.
 */
describe("fila de anúncios", () => {
  beforeEach(() => {
    useAnnouncementStore.getState().reset();
  });

  it("com um pedido só, ele tem a vez", () => {
    useAnnouncementStore.getState().claim("a", 10);

    expect(hasFloor(useAnnouncementStore.getState().claims, "a")).toBe(true);
  });

  /** A ordem é por IMPORTÂNCIA, nunca por quem chegou primeiro. */
  it("o de menor prioridade fala, mesmo chegando depois", () => {
    const { claim } = useAnnouncementStore.getState();
    claim("premium", ANNOUNCEMENT_PRIORITY.premiumOffer);
    claim("versao", ANNOUNCEMENT_PRIORITY.newVersion);

    const { claims } = useAnnouncementStore.getState();
    expect(hasFloor(claims, "versao")).toBe(true);
    expect(hasFloor(claims, "premium")).toBe(false);
  });

  /**
   * O defeito de 17/09/2026, relatado pelo dono: <i>"ao aparecer a tela de
   * biometria, depois que o app se conecta à api ele abre na hora o modal de
   * nova versão"</i>.
   *
   * <p>A tranca desenha as rotas por baixo dela de propósito — o app não
   * recarrega tudo a cada desbloqueio —, e a folha de versão está entre elas.
   * Ela montava, pedia a vez, e ganhava: o `BiometricGate` <b>não participava
   * desta fila</b>. A fila existia desde 16/09 e resolveu três anúncios
   * brigando entre si; o maior de todos nunca havia entrado nela.
   */
  it("com o app trancado, a versão nova não fala", () => {
    const { claim } = useAnnouncementStore.getState();
    claim("versao", ANNOUNCEMENT_PRIORITY.newVersion);
    claim("biometricGate", ANNOUNCEMENT_PRIORITY.biometricGate);

    const { claims } = useAnnouncementStore.getState();
    expect(hasFloor(claims, "biometricGate")).toBe(true);
    expect(hasFloor(claims, "versao")).toBe(false);
  });

  it("a tranca vem antes até da oferta de biometria", () => {
    const { claim } = useAnnouncementStore.getState();
    claim("biometria", ANNOUNCEMENT_PRIORITY.biometric);
    claim("biometricGate", ANNOUNCEMENT_PRIORITY.biometricGate);

    const { claims } = useAnnouncementStore.getState();
    expect(hasFloor(claims, "biometricGate")).toBe(true);
    expect(hasFloor(claims, "biometria")).toBe(false);
  });

  it("destrancado, a versão nova volta a ter a vez", () => {
    const { claim, release } = useAnnouncementStore.getState();
    claim("versao", ANNOUNCEMENT_PRIORITY.newVersion);
    claim("biometricGate", ANNOUNCEMENT_PRIORITY.biometricGate);

    release("biometricGate");

    expect(hasFloor(useAnnouncementStore.getState().claims, "versao")).toBe(true);
  });

  it("a ordem completa: biometria, versão, pote, oferta", () => {
    const { claim } = useAnnouncementStore.getState();
    claim("pote", ANNOUNCEMENT_PRIORITY.potStates);
    claim("premium", ANNOUNCEMENT_PRIORITY.premiumOffer);
    claim("versao", ANNOUNCEMENT_PRIORITY.newVersion);
    claim("biometria", ANNOUNCEMENT_PRIORITY.biometric);

    const { claims } = useAnnouncementStore.getState();
    expect(hasFloor(claims, "biometria")).toBe(true);
    expect(
      ["versao", "pote", "premium"].map((id) => hasFloor(claims, id)),
    ).toEqual([false, false, false]);
  });

  it("quem sai libera a vez para o seguinte", () => {
    const { claim, release } = useAnnouncementStore.getState();
    claim("versao", ANNOUNCEMENT_PRIORITY.newVersion);
    claim("pote", ANNOUNCEMENT_PRIORITY.potStates);

    release("versao");

    expect(hasFloor(useAnnouncementStore.getState().claims, "pote")).toBe(true);
  });

  it("quem não pediu não tem a vez", () => {
    useAnnouncementStore.getState().claim("versao", 20);

    expect(hasFloor(useAnnouncementStore.getState().claims, "pote")).toBe(false);
  });

  /**
   * Empate não deveria acontecer — cada anúncio tem número próprio —, mas se
   * acontecer o resultado tem de ser ESTÁVEL entre renders. Sem isso duas
   * folhas piscariam alternando qual delas aparece.
   */
  it("empate é resolvido de forma estável, e por apenas um dos dois", () => {
    const { claim } = useAnnouncementStore.getState();
    claim("zebra", 20);
    claim("abelha", 20);

    const { claims } = useAnnouncementStore.getState();
    expect(hasFloor(claims, "abelha")).toBe(true);
    expect(hasFloor(claims, "zebra")).toBe(false);
  });

  /** Sair da conta não pode deixar um pedido preso na fila. */
  it("o reset esvazia a fila", () => {
    useAnnouncementStore.getState().claim("versao", 20);

    useAnnouncementStore.getState().reset();

    expect(useAnnouncementStore.getState().claims).toEqual({});
  });

  it("pedir de novo com a mesma prioridade não muda o estado", () => {
    const { claim } = useAnnouncementStore.getState();
    claim("versao", 20);
    const antes = useAnnouncementStore.getState().claims;

    claim("versao", 20);

    expect(useAnnouncementStore.getState().claims).toBe(antes);
  });
});
