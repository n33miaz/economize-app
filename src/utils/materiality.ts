/**
 * Abaixo de quanto um número não merece interromper ninguém.
 *
 * De onde isto veio: no tour do concorrente, em 09/09/2026, o app abriu uma
 * peça de **tela cheia**, com gráfico e botão para o CDB deles, para anunciar
 * *"Ei, encontrei dinheiro voando! vi R$ 0,13 na sua conta Mercado Pago"*.
 * Treze centavos. Estava tecnicamente correto e era um desrespeito com o tempo
 * de quem abriu o aplicativo.
 *
 * A distinção que sustenta o módulo inteiro:
 *
 * - **Somas não têm piso.** Uma duplicata de R$ 0,13 continua saindo do total,
 *   um estorno de R$ 0,13 continua sendo pareado, um centavo continua sendo um
 *   centavo. Arredondar a conta do usuário é mentir para ele, e a mentira
 *   pequena é a que corrói a confiança no número grande.
 * - **Avisos têm piso.** Interromper alguém gasta a atenção dela, que é o
 *   recurso mais escasso do app. Um aviso que aparece por treze centavos ensina
 *   o usuário a ignorar avisos — e aí o aviso que importava passa junto.
 *
 * Em uma frase: **o piso governa o que se diz, nunca o que se conta.**
 *
 * O valor é o mesmo declarado na API (`Materiality.PISO_DE_AVISO`), e é
 * duplicado aqui de propósito: parte das decisões de interromper é do
 * servidor e parte é da tela, e um piso que só existe de um lado deixa o
 * outro lado livre para gritar por centavos.
 */

/**
 * Cinco reais.
 *
 * Não é número redondo escolhido no ar: é a menor quantia que aparece sozinha
 * no extrato do dono como decisão de gasto (um café, uma passagem, a taxa de
 * R$ 4,00 que se repete). Abaixo disso o que existe é arredondamento, cashback
 * de centavos e crédito de pontos — nada que mude uma escolha.
 */
export const PISO_DE_AVISO = 5;

/**
 * Este valor merece uma frase na tela?
 *
 * Compara em módulo: −R$ 0,13 é tão pouco quanto +R$ 0,13, e aviso sobre saída
 * pequena incomoda igual. Valor ausente ou que não é número conta como
 * imaterial — aviso sem número não tem o que dizer.
 */
export function vale(valor: number | null | undefined): boolean {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return false;
  return Math.abs(valor) >= PISO_DE_AVISO;
}
