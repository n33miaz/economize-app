import {
  WAITING_KINDS,
  WAITING_STEP_MS,
  waitingLine,
  waitingLines,
} from "../waitingLines";

/**
 * EC-224 — a legenda de espera tem voz E tem fim.
 *
 * O concorrente alterna legendas genéricas sem prazo: numa das perguntas do
 * tour ele passou treze minutos trocando de frase, reescreveu a própria
 * abertura no meio e nunca respondeu. Legenda animada sem prazo é a promessa
 * do esqueleto eterno, só que com mais palavras.
 */
describe("Legendas de espera", () => {
  it("a primeira frase aparece no instante zero", () => {
    expect(waitingLine("import", 0)).toBe("lendo o extrato");
  });

  it("avança na ordem real do trabalho", () => {
    expect(waitingLine("import", WAITING_STEP_MS)).toBe(
      "reconhecendo os estabelecimentos",
    );
    expect(waitingLine("import", WAITING_STEP_MS * 4)).toBe("procurando duplicata");
  });

  it("NÃO circula: na última frase, ela fica", () => {
    // Voltar ao começo faria o app parecer que recomeçou o trabalho — a
    // sensação exata do laço infinito do concorrente
    const ultima = waitingLines("import").at(-1);

    expect(waitingLine("import", WAITING_STEP_MS * 50)).toBe(ultima);
    expect(waitingLine("import", WAITING_STEP_MS * 500)).toBe(ultima);
  });

  it("passado o prazo, para de prometer", () => {
    expect(waitingLine("import", WAITING_STEP_MS * 2, true)).toBe(
      "está demorando mais do que deveria",
    );
  });

  it("tempo negativo não quebra (relógio do aparelho adiantado)", () => {
    expect(waitingLine("sync", -5_000)).toBe("falando com o seu banco");
  });

  it("nenhuma frase é genérica", () => {
    // "Analisando..." não ensina nada e some da memória no segundo seguinte
    const PROIBIDAS = [
      /^analisando/i,
      /^carregando/i,
      /^processando/i,
      /^aguarde/i,
      /quase l[áa]/i,
      /^um momento/i,
    ];
    for (const kind of WAITING_KINDS) {
      for (const frase of waitingLines(kind)) {
        for (const proibida of PROIBIDAS) {
          expect(frase).not.toMatch(proibida);
        }
      }
    }
  });

  it("toda sequência tem pelo menos três passos e nenhum repetido", () => {
    for (const kind of WAITING_KINDS) {
      const frases = waitingLines(kind);
      expect(frases.length).toBeGreaterThanOrEqual(3);
      expect(new Set(frases).size).toBe(frases.length);
    }
  });

  it("a legenda descreve o trabalho, então cita coisa do domínio", () => {
    // Uma frase que serviria para qualquer app não diz o que ESTE app faz
    const DOMINIO =
      /extrato|banco|lan[çc]amento|duplicata|estorno|categoria|fatura|aplica[çc][ãa]o|gasto|fila|vocabul[áa]rio|conta|m[êe]s|resposta|linha|estabelecimento/i;
    for (const kind of WAITING_KINDS) {
      for (const frase of waitingLines(kind)) {
        expect(frase).toMatch(DOMINIO);
      }
    }
  });
});

/**
 * A sequência da importação é a ordem REAL das varreduras do servidor. Se uma
 * mudar sem a outra, a legenda vira ficção — e este teste é o que impede.
 */
describe("A ordem da importação é a ordem do servidor", () => {
  it("as seis varreduras aparecem na mesma sequência", () => {
    const frases = waitingLines("import").join(" | ");

    const ordemDoServidor = [
      "dinheiro seu trocando de conta", // InternalTransferService
      "aplicação e o que é gasto", // InvestmentFlowService
      "duplicata", // DuplicateTransactionService
      "estorno", // RefundReconciliationService
      "se repete todo mês", // RecurrenceDetectionService
    ];

    let posicao = -1;
    for (const marca of ordemDoServidor) {
      const encontrado = frases.indexOf(marca);
      expect(encontrado).toBeGreaterThan(posicao);
      posicao = encontrado;
    }
  });
});
