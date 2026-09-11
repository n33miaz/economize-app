import fs from "fs";
import path from "path";

/**
 * Toda tela de DADOS pode ser recarregada com o dedo.
 *
 * <p>É a comodidade que se sente pela ausência: quem puxa uma lista e nada
 * acontece conclui que o app não atualiza, e vai fechar e abrir de novo. Um
 * gesto que a plataforma inteira ensinou não pode faltar em metade das telas.
 *
 * <p><b>Formulário fica de fora, e não é esquecimento.</b> Puxar para
 * recarregar um formulário meio preenchido apagaria o que a pessoa digitou —
 * o gesto não tem o que atualizar ali, e oferecê-lo seria uma armadilha.
 */
describe("Puxar para atualizar nas telas de dados", () => {
  const TELAS = path.resolve(__dirname, "..", "..", "screens");

  /** Telas de leitura: mostram dado do servidor e devem recarregar. */
  const DE_DADOS = [
    "Analytics.tsx",
    "BalanceForecast.tsx",
    "BankIntegration.tsx",
    "Categories.tsx",
    "CreditCards.tsx",
    "Home.tsx",
    "Investments.tsx",
    "News.tsx",
    "Recurrences.tsx",
    "Reports.tsx",
    "Wallet.tsx",
    "Wishes.tsx",
  ];

  /**
   * As que ainda não têm, com o motivo — catraca, não perdão.
   *
   * <p>Tirar uma daqui exige ligar o gesto na tela; acrescentar exige
   * justificar. A lista é a dívida à vista.
   */
  const FALTAM: Record<string, string> = {
    "Family.tsx": "tela mista: metade formulário de convite",
    "IncomeSettings.tsx": "formulário longo, o gesto apagaria o preenchido",
    "Plan.tsx": "conteúdo estático de plano, nada a recarregar do servidor",
    "StatementReview.tsx": "fila com estado local de escolha; recarregar perderia as marcas",
  };

  const fonte = (nome: string) =>
    fs.readFileSync(path.join(TELAS, nome), "utf8");

  const temGesto = (nome: string) =>
    /RefreshControl|usePullToRefresh/.test(fonte(nome));

  it("as telas de dados recarregam com o dedo", () => {
    const sem = DE_DADOS.filter((nome) => !(nome in FALTAM)).filter(
      (nome) => !temGesto(nome),
    );

    expect(sem).toEqual([]);
  });

  it("a dívida listada é dívida de verdade — nenhuma delas já tem o gesto", () => {
    // Entrada obsoleta na lista esconde que o trabalho foi feito
    const jaTem = Object.keys(FALTAM).filter((nome) => temGesto(nome));

    expect(jaTem).toEqual([]);
  });

  it("toda dívida tem motivo escrito", () => {
    for (const motivo of Object.values(FALTAM)) {
      expect(motivo.length).toBeGreaterThan(20);
    }
  });

  it("a lista de telas de dados aponta para arquivos que existem", () => {
    for (const nome of DE_DADOS) {
      expect(fs.existsSync(path.join(TELAS, nome))).toBe(true);
    }
  });
});
