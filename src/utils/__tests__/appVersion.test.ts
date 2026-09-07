import {
  UNKNOWN_VERSION,
  compareSemver,
  isBelow,
  normalizeVersion,
  platformHeader,
  versionHeaders,
} from "../appVersion";

/**
 * A régua de versão.
 *
 * <p>O que estes testes travam é o erro clássico que ela existe para evitar:
 * comparar versões como texto. "2.10.0" é MAIOR que "2.9.9", e um app que
 * errasse isso bloquearia justamente quem acabou de atualizar.
 */
describe("compareSemver", () => {
  it("compara campo a campo, em número — 2.10.0 vem depois de 2.9.9", () => {
    expect(compareSemver("2.10.0", "2.9.9")).toBe(1);
    expect(compareSemver("2.9.9", "2.10.0")).toBe(-1);
  });

  it("iguais são iguais", () => {
    expect(compareSemver("2.3.0", "2.3.0")).toBe(0);
    expect(compareSemver("2.3", "2.3.0")).toBe(0);
    expect(compareSemver("v2.3.0", "2.3.0")).toBe(0);
  });

  it("ignora sufixos: o build de desenvolvimento é a mesma versão", () => {
    expect(compareSemver("2.3.0-beta.1", "2.3.0")).toBe(0);
    expect(compareSemver("2.3.0+build7", "2.3.0")).toBe(0);
  });

  it("o campo mais à esquerda manda", () => {
    expect(compareSemver("3.0.0", "2.99.99")).toBe(1);
    expect(compareSemver("2.4.0", "2.3.99")).toBe(1);
  });
});

describe("normalizeVersion", () => {
  it("completa o que falta com zero", () => {
    expect(normalizeVersion("2")).toBe("2.0.0");
    expect(normalizeVersion("2.3")).toBe("2.3.0");
  });

  it("o que não é versão vira 0.0.0 — nunca exceção", () => {
    // A régua roda na abertura do app: lançar aqui derrubaria tudo por causa
    // de um manifesto malformado
    expect(normalizeVersion("abc")).toBe(UNKNOWN_VERSION);
    expect(normalizeVersion("")).toBe(UNKNOWN_VERSION);
    expect(normalizeVersion(undefined)).toBe(UNKNOWN_VERSION);
    expect(normalizeVersion(null)).toBe(UNKNOWN_VERSION);
    expect(normalizeVersion(42)).toBe(UNKNOWN_VERSION);
  });
});

describe("isBelow", () => {
  it("abaixo é estritamente menor — igual à mínima passa", () => {
    expect(isBelow("2.2.0", "2.3.0")).toBe(true);
    expect(isBelow("2.3.0", "2.3.0")).toBe(false);
    expect(isBelow("2.3.1", "2.3.0")).toBe(false);
  });

  it("versão inválida conta como a mais antiga possível", () => {
    expect(isBelow("lixo", "0.0.1")).toBe(true);
  });
});

describe("cabeçalhos de versão", () => {
  it("a plataforma é um dos três rótulos que o servidor conhece", () => {
    expect(["android", "ios", "web"]).toContain(platformHeader());
  });

  it("manda sempre o mesmo par, com a versão já normalizada", () => {
    const headers = versionHeaders();
    expect(headers["X-App-Version"]).toMatch(/^\d+\.\d+\.\d+$/);
    expect(headers["X-App-Platform"]).toBe(platformHeader());
  });
});
