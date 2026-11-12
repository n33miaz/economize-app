// Dublê local de UMA fonte de mercado: a cotação de ticker do exterior no
// formato CSV do Stooq, que é o que a API consulta quando o Yahoo não responde.
// Uso: node market-stub.mjs <porta> [arquivo-do-pid]
//
// Existe para a posição em dólar do roteiro ter cotação sem a rodada depender
// de internet. De propósito NÃO há dublê de câmbio: o roteiro registra o que a
// tela faz com um papel cotado em US$ quando não há dólar para converter.
import { createServer } from "node:http";
import { writeFileSync } from "node:fs";
import { COTACOES } from "./market-cotacoes.mjs";

const [portArg, pidFile] = process.argv.slice(2);

const hoje = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const simbolo = (url.searchParams.get("s") ?? "").toLowerCase();
  const preco = COTACOES[simbolo];
  console.log(`${req.method} ${req.url} -> ${preco ?? "sem cotação"}`);
  res.writeHead(200, { "content-type": "text/csv; charset=utf-8" });
  const cabecalho = "Symbol,Date,Time,Open,High,Low,Close,Volume";
  // Símbolo desconhecido responde como o Stooq de verdade: linha com N/D
  const linha = preco
    ? `${simbolo.toUpperCase()},${hoje()},16:00:00,${preco},${preco},${preco},${preco},1000`
    : `${simbolo.toUpperCase()},N/D,N/D,N/D,N/D,N/D,N/D,N/D`;
  res.end(`${cabecalho}\r\n${linha}\r\n`);
}).listen(Number(portArg), "127.0.0.1", () => {
  if (pidFile) writeFileSync(pidFile, String(process.pid));
  console.log(`dublê de mercado em http://127.0.0.1:${portArg} (pid ${process.pid})`);
});
