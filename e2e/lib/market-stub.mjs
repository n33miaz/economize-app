// Dublê local das duas fontes de mercado que o roteiro precisa:
//   /q/l/?s=vt.us   cotação de ticker do exterior, no CSV do Stooq (é o que a
//                   API consulta quando o Yahoo não responde);
//   /awesome/all    câmbio, no JSON da AwesomeAPI (de onde a API tira o dólar
//                   que converte a cotação para reais).
// Uso: node market-stub.mjs <porta> [arquivo-do-pid]
//
// O dublê serve as duas sempre. Quem decide se há câmbio é a API: o run.sh só
// aponta `awesome.api.url` para cá na fase "com-cambio".
import { createServer } from "node:http";
import { writeFileSync } from "node:fs";
import { COTACOES, DOLAR } from "./market-cotacoes.mjs";

const [portArg, pidFile] = process.argv.slice(2);

const hoje = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

function stooq(url) {
  const simbolo = (url.searchParams.get("s") ?? "").toLowerCase();
  const preco = COTACOES[simbolo];
  const cabecalho = "Symbol,Date,Time,Open,High,Low,Close,Volume";
  // Símbolo desconhecido responde como o Stooq de verdade: linha com N/D
  const linha = preco
    ? `${simbolo.toUpperCase()},${hoje()},16:00:00,${preco},${preco},${preco},${preco},1000`
    : `${simbolo.toUpperCase()},N/D,N/D,N/D,N/D,N/D,N/D,N/D`;
  return { tipo: "text/csv; charset=utf-8", corpo: `${cabecalho}\r\n${linha}\r\n` };
}

function awesome() {
  const valor = DOLAR.toFixed(4);
  return {
    tipo: "application/json; charset=utf-8",
    corpo: JSON.stringify({
      USD: {
        code: "USD",
        codein: "BRL",
        name: "Dólar Americano/Real Brasileiro",
        high: valor,
        low: valor,
        varBid: "0",
        pctChange: "0",
        bid: valor,
        ask: valor,
        timestamp: String(Math.floor(Date.now() / 1000)),
      },
    }),
  };
}

createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const resposta = url.pathname.startsWith("/awesome/all")
    ? awesome()
    : url.pathname.startsWith("/q/l")
      ? stooq(url)
      : null;
  console.log(`${req.method} ${req.url} -> ${resposta ? 200 : 404}`);
  if (!resposta) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { "content-type": resposta.tipo });
  res.end(resposta.corpo);
}).listen(Number(portArg), "127.0.0.1", () => {
  if (pidFile) writeFileSync(pidFile, String(process.pid));
  console.log(`dublê de mercado em http://127.0.0.1:${portArg} (pid ${process.pid})`);
});
