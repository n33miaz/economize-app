import {
  chaveValida,
  descreverNota,
  digitoVerificador,
  extrairChave,
  formatarChave,
  formatarCnpj,
  lerNotaFiscal,
  totalDoQr,
} from "../notaFiscal";

/**
 * Cupom de mercado em SP, emitido em 09/2026, CNPJ 12.345.678/0001-95,
 * modelo 65 (NFC-e), série 1, número 123456. O dígito verificador foi
 * calculado pela mesma regra do fisco.
 */
const CHAVE = "35260912345678000195650010001234561123456788";
/** Nota (modelo 55) do Rio, 08/2025 — para provar que o modelo muda a frase. */
const CHAVE_NFE = "33250898765432000110550020000000421876543212";

describe("dígito verificador da chave", () => {
  it("fecha nas chaves de verdade", () => {
    expect(digitoVerificador(CHAVE.slice(0, 43))).toBe(Number(CHAVE[43]));
    expect(chaveValida(CHAVE)).toBe(true);
    expect(chaveValida(CHAVE_NFE)).toBe(true);
  });

  it("um dígito trocado reprova — é o ponto de haver verificador", () => {
    const torta = CHAVE.slice(0, 20) + (Number(CHAVE[20]) === 9 ? "0" : "9") + CHAVE.slice(21);
    expect(chaveValida(torta)).toBe(false);
  });

  it("tamanho errado reprova antes de qualquer conta", () => {
    expect(chaveValida("123")).toBe(false);
    expect(chaveValida(CHAVE + "0")).toBe(false);
    expect(digitoVerificador("123")).toBeNull();
  });

  it("aceita a chave com a formatação em que ela vem impressa", () => {
    expect(chaveValida(formatarChave(CHAVE))).toBe(true);
    expect(formatarChave(CHAVE).split(" ")).toHaveLength(11);
  });
});

describe("achar a chave no que o leitor devolveu", () => {
  it("na URL de consulta com o parâmetro p", () => {
    const qr = `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${CHAVE}|2|1|1|ABCDEF`;
    expect(extrairChave(qr)).toBe(CHAVE);
  });

  it("na URL que usa chNFe", () => {
    expect(extrairChave(`https://nfe.fazenda.rj.gov.br/consulta?chNFe=${CHAVE_NFE}`)).toBe(
      CHAVE_NFE,
    );
  });

  it("nos 44 dígitos crus, que é o que alguns leitores entregam", () => {
    expect(extrairChave(CHAVE)).toBe(CHAVE);
    expect(extrairChave(`  ${formatarChave(CHAVE)}  `)).toBe(CHAVE);
  });

  it("devolve null quando não há chave nenhuma", () => {
    expect(extrairChave("https://exemplo.com/nada")).toBeNull();
    expect(extrairChave("")).toBeNull();
    expect(extrairChave("12345")).toBeNull();
  });
});

describe("o total no QR", () => {
  it("vem quando a nota foi emitida em contingência", () => {
    // layout: chave|versao|ambiente|destinatario|emissao|vNF|vICMS|digVal|...
    const qr = `https://x/qr?p=${CHAVE}|2|1||3230313031|604.91|12.34|ABC|1|HASH`;
    expect(totalDoQr(qr)).toBeCloseTo(604.91, 2);
  });

  it("NÃO vem na emissão normal, e inventar seria pior que não ter", () => {
    const qr = `https://x/qr?p=${CHAVE}|2|1|1|HASH`;
    expect(totalDoQr(qr)).toBeNull();
  });

  it("campo que não é número não vira dinheiro", () => {
    const qr = `https://x/qr?p=${CHAVE}|2|1||3230|nao-e-numero|1|A|1|H`;
    expect(totalDoQr(qr)).toBeNull();
  });
});

describe("ler a nota inteira", () => {
  it("a chave conta estado, mês, loja, modelo, série e número", () => {
    const nota = lerNotaFiscal(`https://nfce.sp.gov.br/qr?p=${CHAVE}|2|1|1|HASH`)!;

    expect(nota.chave).toBe(CHAVE);
    expect(nota.uf).toBe("SP");
    expect(nota.ano).toBe(2026);
    expect(nota.mes).toBe(9);
    expect(nota.cnpj).toBe("12345678000195");
    expect(nota.modelo).toBe("65");
    expect(nota.serie).toBe(1);
    expect(nota.numero).toBe(123456);
    // emissão normal: o total continua sendo digitado por quem está no caixa
    expect(nota.total).toBeNull();
  });

  it("chave inválida não vira nota — guardar uma nota que não existe é pior que não guardar", () => {
    expect(lerNotaFiscal("35260912345678000195650010001234561123456789")).toBeNull();
    expect(lerNotaFiscal("qualquer coisa")).toBeNull();
  });

  it("código de estado desconhecido não inventa sigla", () => {
    // 99 não é estado nenhum; o resto da chave continua valendo
    const base = "99" + CHAVE.slice(2, 43);
    const dv = digitoVerificador(base)!;
    const nota = lerNotaFiscal(base + dv)!;
    expect(nota.uf).toBeNull();
    expect(nota.numero).toBe(123456);
  });
});

describe("como a nota aparece na tela", () => {
  it("cupom e nota têm nomes diferentes, porque o papel é diferente", () => {
    expect(descreverNota(lerNotaFiscal(CHAVE)!)).toBe("Cupom nº 123456 · série 1 · SP · 09/2026");
    expect(descreverNota(lerNotaFiscal(CHAVE_NFE)!)).toBe("Nota nº 42 · série 2 · RJ · 08/2025");
  });

  it("o CNPJ sai pontuado, como a pessoa lê no cupom", () => {
    expect(formatarCnpj("12345678000195")).toBe("12.345.678/0001-95");
    expect(formatarCnpj("123")).toBe("123");
  });
});
