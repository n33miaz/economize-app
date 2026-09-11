import fs from "fs";
import path from "path";

import {
  AGING_UNTIL_MS,
  FRESH_UNTIL_MS,
  formatRelativeTime,
  freshnessStamp,
} from "../freshness";

const AGORA = Date.parse("2026-09-10T12:00:00Z");
const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

describe("Idade de um número", () => {
  it("conta o tempo do jeito que se fala", () => {
    expect(formatRelativeTime(AGORA - 40 * 1000, AGORA)).toBe("agora");
    expect(formatRelativeTime(AGORA - 5 * MIN, AGORA)).toBe("há 5 min");
    expect(formatRelativeTime(AGORA - 2 * HORA, AGORA)).toBe("há 2 h");
    expect(formatRelativeTime(AGORA - 1 * DIA, AGORA)).toBe("há 1 dia");
    expect(formatRelativeTime(AGORA - 3 * DIA, AGORA)).toBe("há 3 dias");
  });

  it("passada uma semana, vira data", () => {
    expect(formatRelativeTime(AGORA - 8 * DIA, AGORA)).toBe("02/09/2026");
  });

  it("aceita ISO e epoch, porque as duas formas existem no app", () => {
    expect(formatRelativeTime("2026-09-10T10:00:00Z", AGORA)).toBe("há 2 h");
    expect(formatRelativeTime(AGORA - 2 * HORA, AGORA)).toBe("há 2 h");
  });

  it("sem instante devolve null — quem chama decide o que dizer", () => {
    expect(formatRelativeTime(null, AGORA)).toBeNull();
    expect(formatRelativeTime(undefined, AGORA)).toBeNull();
    expect(formatRelativeTime("data que não é data", AGORA)).toBeNull();
  });

  it("relógio adiantado não produz 'há -3 min'", () => {
    // O aparelho pode estar à frente do servidor; o piso em zero devolve a
    // coisa mais próxima da verdade que dá para afirmar
    expect(formatRelativeTime(AGORA + 3 * MIN, AGORA)).toBe("agora");
  });
});

describe("Carimbo de atualização", () => {
  it("NUNCA escreve 'agora' sem leitura — é o defeito que ele existe para não repetir", () => {
    const carimbo = freshnessStamp(null, AGORA);

    expect(carimbo.label).toBe("sem leitura ainda");
    expect(carimbo.label).not.toContain("agora");
    expect(carimbo.tone).toBe("unknown");
    expect(carimbo.ageMs).toBeNull();
  });

  it("o tom vem do mesmo instante que o texto", () => {
    expect(freshnessStamp(AGORA - 5 * MIN, AGORA).tone).toBe("fresh");
    expect(freshnessStamp(AGORA - 2 * HORA, AGORA).tone).toBe("aging");
    expect(freshnessStamp(AGORA - 2 * DIA, AGORA).tone).toBe("stale");
  });

  it("os limites são exatos nas bordas", () => {
    expect(freshnessStamp(AGORA - FRESH_UNTIL_MS + 1, AGORA).tone).toBe("fresh");
    expect(freshnessStamp(AGORA - FRESH_UNTIL_MS, AGORA).tone).toBe("aging");
    expect(freshnessStamp(AGORA - AGING_UNTIL_MS + 1, AGORA).tone).toBe("aging");
    expect(freshnessStamp(AGORA - AGING_UNTIL_MS, AGORA).tone).toBe("stale");
  });

  it("o prefixo cola na frase, e data ganha 'em'", () => {
    expect(freshnessStamp(AGORA - 11 * HORA, AGORA, "sincronizado").label).toBe(
      "sincronizado há 11 h",
    );
    expect(freshnessStamp(AGORA - 8 * DIA, AGORA, "sincronizado").label).toBe(
      "sincronizado em 02/09/2026",
    );
  });

  it("as onze horas do concorrente aparecem como onze horas", () => {
    // O caso medido: o painel dele dizia "Atualizado agora" com a última
    // leitura de 11 horas atrás. Aqui o número tem de sair na frase
    const carimbo = freshnessStamp(AGORA - 11 * HORA, AGORA, "atualizado");

    expect(carimbo.label).toBe("atualizado há 11 h");
    expect(carimbo.tone).toBe("aging");
  });
});

/**
 * O valor do EC-215 não está na função — está em ela ser a única. Uma frase de
 * frescor escrita à mão numa tela é exatamente o defeito do concorrente, e
 * volta em silêncio na primeira tela nova.
 */
describe("O carimbo mora num lugar só", () => {
  const RAIZ = path.resolve(__dirname, "..", "..");
  const PERMITIDOS = [
    path.join("utils", "freshness.ts"),
    path.join("components", "FreshnessStamp.tsx"),
    path.join("utils", "investments.ts"),
  ];

  // Comentário citando a frase é documentação, não afirmação na tela — e o
  // próprio BalanceCheckNotice explica o defeito do concorrente citando-o.
  // Tirar os comentários antes de varrer é o que separa os dois casos
  const semComentarios = (fonte: string) =>
    fonte
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");

  // Frase de frescor pregada no texto da tela
  const FRASES = [
    /"[^"]*Atualizado agora[^"]*"/i,
    /"[^"]*atualizado h[áa] pouco[^"]*"/i,
    /`[^`]*Atualizado agora[^`]*`/i,
    />\s*Atualizado agora\s*</i,
  ];

  const arquivos: string[] = [];
  const varrer = (dir: string) => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const completo = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        if (entrada.name === "__tests__" || entrada.name === "node_modules") continue;
        varrer(completo);
      } else if (/\.tsx?$/.test(entrada.name)) {
        arquivos.push(completo);
      }
    }
  };
  varrer(path.join(RAIZ, "screens"));
  varrer(path.join(RAIZ, "components"));

  it("nenhuma tela afirma frescor por conta própria", () => {
    const culpados: string[] = [];
    for (const arquivo of arquivos) {
      const relativo = path.relative(RAIZ, arquivo);
      if (PERMITIDOS.some((permitido) => relativo.endsWith(permitido))) continue;
      const conteudo = semComentarios(fs.readFileSync(arquivo, "utf8"));
      if (FRASES.some((frase) => frase.test(conteudo))) culpados.push(relativo);
    }

    expect(culpados).toEqual([]);
  });

  it("a varredura enxerga arquivos de verdade", () => {
    // Sem isto, um erro de caminho faria o teste acima passar sempre
    expect(arquivos.length).toBeGreaterThan(40);
  });
});
