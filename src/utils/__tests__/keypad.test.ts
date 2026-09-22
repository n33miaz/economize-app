import { LINHAS, digitar, rotuloDaTecla } from "../keypad";

describe("teclado de números do app", () => {
  it("digita da esquerda para a direita, como qualquer campo", () => {
    let valor = "";
    for (const tecla of ["1", "2", ",", "9", "0"] as const) {
      valor = digitar(valor, tecla);
    }
    expect(valor).toBe("12,90");
  });

  it("centavos são dois: o terceiro toque não muda nada", () => {
    expect(digitar("12,90", "5")).toBe("12,90");
  });

  it("vírgula entra uma vez só, e em campo vazio vira 0,", () => {
    expect(digitar("", ",")).toBe("0,");
    expect(digitar("12,5", ",")).toBe("12,5");
  });

  it("zero à esquerda não se acumula", () => {
    expect(digitar("0", "5")).toBe("5");
    expect(digitar("0", "0")).toBe("0");
  });

  it("apagar volta um caractere e para no vazio", () => {
    expect(digitar("12,9", "apagar")).toBe("12,");
    expect(digitar("1", "apagar")).toBe("");
    expect(digitar("", "apagar")).toBe("");
  });

  it("limpar zera — é o que o toque longo no apagar faz", () => {
    expect(digitar("1234,56", "limpar")).toBe("");
  });

  it("não deixa o número crescer além do que uma compra cabe", () => {
    expect(digitar("9999999", "9")).toBe("9999999");
    expect(digitar("999999", "9")).toBe("9999999");
  });

  it("as quatro linhas têm as dez teclas, a vírgula e o apagar", () => {
    const teclas = LINHAS.flat();
    expect(teclas).toHaveLength(12);
    expect(new Set(teclas).size).toBe(12);
    expect(teclas).toContain(",");
    expect(teclas).toContain("apagar");
  });

  it("o leitor de tela ouve o que a tecla faz, não o desenho dela", () => {
    expect(rotuloDaTecla("apagar")).toMatch(/apagar/i);
    expect(rotuloDaTecla("limpar")).toMatch(/limpar/i);
    expect(rotuloDaTecla(",")).toBe("Vírgula");
    expect(rotuloDaTecla("7")).toBe("7");
  });
});
