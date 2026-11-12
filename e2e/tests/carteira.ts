// A carteira sintética do roteiro, compartilhada pelas duas fases.
import { COTACOES, DOLAR } from "../lib/market-cotacoes.mjs";

export const CDB = { nome: "CDB Banco Sintetico", investido: 1000, atual: 1050 };

/**
 * ETF de fora, em dólar. `precoUsd` é o custo unitário digitado; `cotacaoUsd`
 * é o que o dublê de mercado devolve para VT, e é ela que dá o valor de hoje.
 * `investido` é em REAIS, como o formulário pede.
 */
export const ETF = {
  nome: "ETF Global Sintetico",
  codigo: "VT",
  quantidade: 2,
  precoUsd: 100,
  investido: 1000,
  cotacaoUsd: COTACOES["vt.us"],
};

/** O dólar do dublê; só existe para a API na fase "com-cambio". */
export const DOLAR_EM_REAIS = DOLAR;

/** "US$ 221,00", aceitando o espaço comum ou o não separável que a tela põe. */
export function usd(valor: number): RegExp {
  const texto = Math.abs(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return new RegExp(`US\\$\\s?${texto.replace(/\./g, "\\.")}(?!\\d)`);
}
