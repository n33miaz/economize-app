/**
 * O que o app diz enquanto trabalha — EC-224.
 *
 * <b>O defeito, medido no concorrente.</b> A IA do Pierre alterna legendas
 * enquanto "raciocina", e a ideia é boa: movimento com texto cansa menos que
 * um spinner mudo. Mas as dele são genéricas ("Analisando...", "Quase lá") e
 * **não têm fim** — numa das perguntas do tour ele ficou treze minutos
 * alternando frases, reescreveu a própria abertura no meio, e nunca respondeu.
 * Legenda animada sem prazo é a mesma promessa do esqueleto eterno, só que
 * com mais palavras.
 *
 * <b>A regra daqui.</b> Três coisas, sempre juntas:
 * <ol>
 *   <li><b>A legenda diz o que está acontecendo de verdade</b> — "procurando
 *       duplicata", não "Analisando". Quem lê aprende como o app funciona;
 *       "Analisando" não ensina nada e some da memória no segundo seguinte;</li>
 *   <li><b>a ordem é a ordem real do trabalho</b>, então a legenda também é
 *       progresso: quem chegou em "conferindo a fatura" sabe que passou das
 *       duplicatas;</li>
 *   <li><b>tem fim.</b> Passado o prazo, a última frase deixa de prometer e
 *       diz que está demorando — quem decide o que fazer com isso é a tela
 *       (ver `useLoadingDeadline`).</li>
 * </ol>
 */

/** Cada trabalho longo do app tem a sua sequência. */
export type WaitingKind = "import" | "sync" | "assistant" | "recategorize";

/**
 * As frases, na ORDEM em que o trabalho acontece de verdade.
 *
 * A da importação é literalmente a ordem do `StatementHygieneService`:
 * movimentação própria, aplicação/resgate, casa, duplicatas, estornos,
 * recorrência. Se a ordem lá mudar, esta muda junto — e é por isso que o
 * teste compara as duas.
 */
const FRASES: Record<WaitingKind, string[]> = {
  import: [
    "lendo o extrato",
    "reconhecendo os estabelecimentos",
    "separando o que é dinheiro seu trocando de conta",
    "vendo o que é aplicação e o que é gasto",
    "procurando duplicata",
    "casando compra com estorno",
    "descobrindo o que se repete todo mês",
  ],
  sync: [
    "falando com o seu banco",
    "buscando os lançamentos novos",
    "conferindo contra o extrato que já está aqui",
    "passando a faxina: duplicata, estorno e o que se repete",
  ],
  assistant: [
    "lendo os seus lançamentos do período",
    "somando por categoria",
    "montando a resposta com as linhas que a sustentam",
  ],
  recategorize: [
    "reexaminando a fila",
    "aplicando o vocabulário atual",
    "guardando as categorias que mudaram",
  ],
};

/**
 * Quanto tempo cada frase fica na tela.
 *
 * Dois segundos e meio: menos que isso vira estroboscópio e ninguém lê; mais
 * que isso e a tela parece travada entre as trocas.
 */
export const WAITING_STEP_MS = 2_500;

/**
 * A frase da vez.
 *
 * <p>A sequência **não circula**. Chegando na última, ela fica — voltar ao
 * começo faria o app parecer que recomeçou o trabalho, que é exatamente a
 * sensação do laço infinito do concorrente.
 *
 * @param elapsedMs há quanto tempo o trabalho começou
 * @param overdue   o prazo estourou (vem do `useLoadingDeadline`)
 */
export function waitingLine(
  kind: WaitingKind,
  elapsedMs: number,
  overdue = false,
): string {
  if (overdue) {
    // Passado o prazo, parar de prometer é mais honesto do que continuar
    // alternando frases bonitas
    return "está demorando mais do que deveria";
  }
  const frases = FRASES[kind];
  const passo = Math.floor(Math.max(0, elapsedMs) / WAITING_STEP_MS);
  return frases[Math.min(passo, frases.length - 1)];
}

/** Exposto para o teste que compara a ordem com a do servidor. */
export function waitingLines(kind: WaitingKind): string[] {
  return FRASES[kind];
}

export const WAITING_KINDS = Object.keys(FRASES) as WaitingKind[];
