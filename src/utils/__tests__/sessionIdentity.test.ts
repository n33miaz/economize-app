import { userKeyFromToken } from "../sessionIdentity";

const jwtFor = (claims: object) =>
  `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;

/**
 * "É a mesma pessoa?" — a pergunta que decide se a conversa e os favoritos
 * guardados no aparelho ficam ou somem quando alguém entra.
 */
describe("userKeyFromToken", () => {
  it("a mesma pessoa dá a mesma chave, em tokens diferentes", () => {
    // cada login emite um token novo (outro `iat`, outra assinatura)
    const ontem = jwtFor({ sub: "ana@casa.dev", iat: 1 });
    const hoje = jwtFor({ sub: "ana@casa.dev", iat: 2 });

    expect(userKeyFromToken(ontem)).toBe(userKeyFromToken(hoje));
  });

  it("caixa e espaço no e-mail não fazem outra pessoa", () => {
    expect(userKeyFromToken(jwtFor({ sub: " Ana@Casa.dev " }))).toBe(
      userKeyFromToken(jwtFor({ sub: "ana@casa.dev" })),
    );
  });

  it("pessoas diferentes dão chaves diferentes", () => {
    expect(userKeyFromToken(jwtFor({ sub: "ana@casa.dev" }))).not.toBe(
      userKeyFromToken(jwtFor({ sub: "bruno@casa.dev" })),
    );
  });

  it("a chave não é o e-mail, nem o contém", () => {
    const key = userKeyFromToken(jwtFor({ sub: "ana@casa.dev" }));

    expect(key).toMatch(/^[0-9a-f]+$/);
    expect(key).not.toContain("ana");
  });

  it("lê base64url: os caracteres - e _ que o padrão não tem", () => {
    // este `sub` produz `-` e `_` no payload; lido como base64 comum, o JSON
    // sairia quebrado e a pessoa viraria "desconhecida" a cada login
    const token = jwtFor({ sub: "a>?>?>?~~~@casa.dev" });
    expect(token.split(".")[1]).toMatch(/[-_]/);

    expect(userKeyFromToken(token)).not.toBeNull();
  });

  it.each([
    ["sem sessão", null],
    ["token vazio", ""],
    ["token opaco, que não é JWT", "token-opaco"],
    ["payload que não é JSON", "h.@@@.s"],
    ["JWT sem `sub`", jwtFor({ iat: 1 })],
    ["`sub` que não é texto", jwtFor({ sub: 42 })],
  ])("%s: não dá para saber quem é", (_caso, token) => {
    // null é tratado por quem chama como OUTRA pessoa — na dúvida, apaga
    expect(userKeyFromToken(token)).toBeNull();
  });
});
