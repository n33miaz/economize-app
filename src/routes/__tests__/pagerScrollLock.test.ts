import { pagerScrollLockStyle } from "../pagerScrollLock";

describe("trava de rolagem do contêiner das abas de cima", () => {
  it("na web com suporte a clip, o contêiner deixa de ser rolável", () => {
    // `hidden` aceitaria scrollLeft vindo de scrollIntoView/foco; `clip` não
    expect(pagerScrollLockStyle("web", true)).toEqual({ overflow: "clip" });
  });

  it("no Android e no iOS nada muda: o paginador é nativo", () => {
    expect(pagerScrollLockStyle("android", true)).toBeUndefined();
    expect(pagerScrollLockStyle("ios", true)).toBeUndefined();
  });

  it("navegador sem clip mantém o hidden da biblioteca", () => {
    // um valor desconhecido viraria `visible` e as abas vizinhas vazariam
    expect(pagerScrollLockStyle("web", false)).toBeUndefined();
  });

  it("sem argumentos, segue a plataforma do teste (nativa): undefined", () => {
    expect(pagerScrollLockStyle()).toBeUndefined();
  });
});
