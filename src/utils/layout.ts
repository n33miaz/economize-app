// Arrumação de blocos em grade. Vive fora dos componentes porque é a mesma
// decisão repetida em toda tela larga: quantas colunas cabem (isso é do
// `useBreakpoint`) e COMO os blocos se distribuem entre elas (isso é daqui).
// Sem esta separação, cada tela inventaria a própria conta e o desktop ficaria
// com sete arrumações diferentes.

/**
 * Distribui itens por colunas equilibrando PESO, sem perder a prioridade.
 *
 * Duas regras, nesta ordem:
 *
 * 1. Os `n` primeiros itens semeiam as `n` colunas, um em cada. É o que
 *    garante que o bloco mais importante nasça no topo da esquerda e o
 *    segundo no topo da direita — cortar a lista ao meio ("primeira metade à
 *    esquerda") enterraria o terceiro mais importante abaixo da dobra.
 * 2. Cada item seguinte cai na coluna mais LEVE até aqui (empate vai para a
 *    da esquerda, que é a que se lê primeiro).
 *
 * O peso é uma dica estática de altura relativa, declarada por quem monta a
 * grade: a altura real só existe depois do layout, e esperar por ela para
 * então redistribuir faria os blocos pularem de coluna na frente do usuário.
 * Sem `weightOf` todo item pesa 1 e o resultado degenera exatamente no
 * rodízio `i % n` — o comportamento anterior, agora como caso particular.
 *
 * Com `columns <= 1` devolve uma coluna só — é o caminho do celular, e ele
 * não paga nada por isso.
 */
export function splitIntoColumns<T>(
  items: T[],
  columns: number,
  weightOf?: (item: T) => number,
): T[][] {
  if (columns <= 1) return [items];

  const buckets: T[][] = Array.from({ length: columns }, () => []);
  const totals: number[] = Array.from({ length: columns }, () => 0);
  const weight = (item: T) => (weightOf ? weightOf(item) : 1);

  items.forEach((item, index) => {
    // Semeadura: os primeiros itens vão um por coluna, na ordem de prioridade
    if (index < columns) {
      buckets[index].push(item);
      totals[index] += weight(item);
      return;
    }

    let lightest = 0;
    for (let i = 1; i < columns; i += 1) {
      // `<` e não `<=`: no empate fica a coluna de menor índice
      if (totals[i] < totals[lightest]) lightest = i;
    }
    buckets[lightest].push(item);
    totals[lightest] += weight(item);
  });

  return buckets;
}

/**
 * Completa a última linha de uma grade com buracos (`null`), para que o item
 * ímpar do fim não estique por toda a largura.
 *
 * É o preço do `numColumns` do FlatList: ele monta cada linha como um flex row
 * e um item sozinho com `flex: 1` ocupa a linha inteira — o último card
 * ficaria com o dobro da largura dos outros, o que lê como erro de layout.
 */
export function padRowsForColumns<T>(
  items: T[],
  columns: number,
): (T | null)[] {
  if (columns <= 1) return items;

  const missing = (columns - (items.length % columns)) % columns;
  if (missing === 0) return items;

  return [...items, ...Array.from({ length: missing }, () => null)];
}
