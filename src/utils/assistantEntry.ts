/**
 * A porta do assistente sabe de onde você veio — EC-201.
 *
 * O concorrente trata o chat como uma aba: você entra numa caixa em branco e
 * ele não faz ideia do que estava na sua tela um segundo antes. Foi assim que
 * o Pierre respondeu *"Sem gastos por categoria"* enquanto a home mostrava
 * R$ 810,61 em cinco categorias — e depois sugeriu conectar contas a quem já
 * tinha conectado cinco bancos.
 *
 * Aqui o assistente é **porta**, não aba: ele é alcançado de qualquer tela e
 * chega sabendo qual. O contexto não muda o que o servidor lê — os números
 * continuam saindo do banco, sempre (EC-200) — ele muda a **primeira
 * pergunta**, que é a parte mais cara de escrever para quem abriu o chat sem
 * saber o que perguntar.
 */

/** As telas que abrem a porta, e o assunto de cada uma. */
export type AssistantOrigin =
  | "home"
  | "extrato"
  | "analise"
  | "fatura"
  | "previsao"
  | "recorrencias"
  | "relatorios"
  | "investimentos"
  | "planos";

/**
 * As perguntas que a tela sugere.
 *
 * Três, nunca mais: uma lista longa vira menu, e menu é o contrário de
 * conversa. Todas são perguntas que os dados do app conseguem responder — não
 * adianta sugerir o que o assistente vai ter de recusar.
 */
const SUGESTOES: Record<AssistantOrigin, string[]> = {
  home: [
    "Como estou este mês comparado ao anterior?",
    "Qual foi meu maior gasto do mês?",
    "O que mais pesou nas minhas despesas?",
  ],
  extrato: [
    "Tem algum lançamento repetido no meu extrato?",
    "Quais foram meus maiores gastos deste mês?",
    "Quanto gastei em mercado no período?",
  ],
  analise: [
    "Qual categoria mais cresceu em relação ao mês passado?",
    "Onde eu conseguiria cortar sem doer muito?",
    "Meus gastos por categoria estão equilibrados?",
  ],
  fatura: [
    "Quanto da minha fatura é parcelamento?",
    "O que mais pesou nesta fatura?",
    "Quantas parcelas ainda faltam?",
  ],
  previsao: [
    "Vou fechar o mês no positivo?",
    "O que está comprometido nos próximos 30 dias?",
    "Qual mês da previsão é o mais apertado?",
  ],
  recorrencias: [
    "Quanto eu pago por mês em assinaturas?",
    "Tem alguma cobrança recorrente que parou?",
    "Quanto isso dá por ano?",
  ],
  relatorios: [
    "Resuma meu mês em três frases.",
    "O que mudou em relação ao mês anterior?",
    "Qual foi a maior surpresa nos meus gastos?",
  ],
  investimentos: [
    "Quanto eu apliquei este mês?",
    "Quanto do meu dinheiro está investido?",
    "Meus resgates foram maiores que as aplicações?",
  ],
  planos: [
    "Consigo alcançar meu objetivo no prazo?",
    "Quanto precisaria guardar por mês?",
    "O que está atrapalhando minha meta?",
  ],
};

/**
 * O rótulo do botão, por tela.
 *
 * "Fale com o Nino" em toda parte é o mesmo botão genérico do concorrente.
 * Dizer sobre O QUÊ se vai falar é o que transforma um botão numa porta.
 */
const ROTULOS: Record<AssistantOrigin, string> = {
  home: "Pergunte sobre o mês",
  extrato: "Pergunte sobre o extrato",
  analise: "Pergunte sobre suas categorias",
  fatura: "Pergunte sobre a fatura",
  previsao: "Pergunte sobre a previsão",
  recorrencias: "Pergunte sobre o que se repete",
  relatorios: "Peça um resumo",
  investimentos: "Pergunte sobre os investimentos",
  planos: "Pergunte sobre a meta",
};

export function assistantSuggestions(origin: AssistantOrigin | undefined): string[] {
  if (!origin) return SUGESTOES.home;
  return SUGESTOES[origin] ?? SUGESTOES.home;
}

export function assistantLabel(origin: AssistantOrigin | undefined): string {
  if (!origin) return "Fale com o Nino";
  return ROTULOS[origin] ?? "Fale com o Nino";
}

/** Toda origem tem rótulo e sugestões — usado pela guarda de teste. */
export const ASSISTANT_ORIGINS = Object.keys(SUGESTOES) as AssistantOrigin[];
