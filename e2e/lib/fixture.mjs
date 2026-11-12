// O extrato sintético do roteiro: uma fonte só para o arquivo que sobe e para
// os números que o teste espera ver na tela.
//
// As datas NÃO são fixas de propósito. A Home mostra o mês corrente; um OFX
// com data escrita à mão passaria hoje e reprovaria no mês seguinte sem que
// nada tivesse quebrado. Aqui todo lançamento cai no mês corrente (no fuso de
// Brasília, o do app) e nunca depois de hoje.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));

/**
 * Nada aqui é dado de alguém: nomes, banco e valores são inventados.
 * `diasAtras` é relativo a hoje e é encolhido para caber no mês corrente.
 */
export const LANCAMENTOS = [
  { id: "E2E-0001", tipo: "CREDIT", valor: 4500.0, memo: "SALARIO EMPRESA EXEMPLO LTDA", diasAtras: 6, papel: "crédito" },
  { id: "E2E-0002", tipo: "DEBIT", valor: -1200.0, memo: "PIX ENVIADO IMOBILIARIA EXEMPLO ALUGUEL", diasAtras: 5, papel: "débito" },
  { id: "E2E-0003", tipo: "DEBIT", valor: -850.4, memo: "PAGAMENTO FATURA CARTAO CREDITO BANCO SINTETICO", diasAtras: 4, papel: "pagamento de fatura" },
  { id: "E2E-0004", tipo: "DEBIT", valor: -89.9, memo: "COMPRA CARTAO DEBITO SUPERMERCADO EXEMPLO", diasAtras: 2, papel: "compra em cartão" },
  { id: "E2E-0005", tipo: "CREDIT", valor: 150.0, memo: "PIX RECEBIDO MARIA EXEMPLO", diasAtras: 1, papel: "crédito" },
];

/** Hoje em Brasília, como {ano, mes, dia}. */
function hojeEmBrasilia(agora = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora);
  const pega = (tipo) => Number(partes.find((p) => p.type === tipo).value);
  return { ano: pega("year"), mes: pega("month"), dia: pega("day") };
}

const dois = (n) => String(n).padStart(2, "0");

/**
 * Monta o extrato e devolve o que o teste precisa conferir.
 *
 * As regras dos totais vêm do código da API, não do que a tela mostrar:
 * `AnalyticsService` soma como saída todo valor negativo e como entrada todo
 * positivo, pulando só o que for transferência interna, ignorado ou
 * estornado. E upload de arquivo NUNCA marca transferência interna
 * (`BankStatementService.reconcileInternalLegs`: "só conector sabe disso"),
 * então o pagamento de fatura deste extrato conta como saída comum.
 */
export function montarExtrato(agora = new Date()) {
  const { ano, mes, dia } = hojeEmBrasilia(agora);
  const lancamentos = LANCAMENTOS.map((l) => {
    const d = Math.max(1, dia - l.diasAtras);
    return { ...l, dia: d, data: `${ano}${dois(mes)}${dois(d)}` };
  });

  const centavos = (v) => Math.round(v * 100);
  const entradas = lancamentos.filter((l) => l.valor > 0).reduce((s, l) => s + centavos(l.valor), 0) / 100;
  const saidas = lancamentos.filter((l) => l.valor < 0).reduce((s, l) => s - centavos(l.valor), 0) / 100;
  const saldo = Math.round((entradas - saidas) * 100) / 100;

  const blocos = lancamentos
    .map((l) =>
      [
        "<STMTTRN>",
        `<TRNTYPE>${l.tipo}</TRNTYPE>`,
        `<DTPOSTED>${l.data}120000[-3:BRT]</DTPOSTED>`,
        `<TRNAMT>${l.valor.toFixed(2)}</TRNAMT>`,
        `<FITID>${l.id}</FITID>`,
        `<MEMO>${l.memo}</MEMO>`,
        "</STMTTRN>",
      ].join("\n"),
    )
    .join("\n");

  const hoje = `${ano}${dois(mes)}${dois(dia)}`;
  const conteudo = readFileSync(join(AQUI, "..", "fixtures", "extrato-sintetico.ofx.tpl"), "utf8")
    .replaceAll("{{HOJE}}", hoje)
    .replaceAll("{{INICIO}}", `${ano}${dois(mes)}01`)
    .replace("{{LANCAMENTOS}}", blocos)
    .replace("{{SALDO}}", saldo.toFixed(2));

  const destino = join(AQUI, "..", "artifacts", "extrato-sintetico.ofx");
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, conteudo);

  return { arquivo: destino, lancamentos, entradas, saidas, saldo, mes: `${ano}-${dois(mes)}` };
}
