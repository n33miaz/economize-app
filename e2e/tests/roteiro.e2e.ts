// Roteiro de ponta a ponta do Economize: web exportada + API local + Postgres
// descartável, tudo nesta máquina (quem sobe é o e2e/run.sh).
//
// É UM roteiro, em série, numa página só: os passos dependem um do outro como
// dependem para quem usa o app, e a sessão nasce pelo formulário de verdade.
// Ninguém injeta token, ninguém fala com a API por fora do navegador.
//
// Aqui não há defeito tolerado: se o app quebrar, um destes testes falha. O
// único ruído aceito está listado, com o motivo, em `CONHECIDOS` (apoio.ts).
//
// Este arquivo é a fase "sem-cambio" do run.sh. A fase "com-cambio" (mesma
// conta, API reiniciada com dólar) é o cambio.e2e.ts.
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { montarExtrato } from "../lib/fixture.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ETF, CDB, usd } from "./carteira";
import {
  aberturaTerminou,
  abrirContexto,
  ARTIFACTS,
  avisoSaiuDaTela,
  botao,
  brl,
  cadastrar,
  campo,
  captura,
  centralizar,
  dispensarFolhaDoPote,
  entrar,
  irPara,
  JSQR_DO_CDN,
  quemEstaNoCentro,
  rolarAteOFim,
  sair,
  tocar,
  tocarAba,
  Vigia,
} from "./apoio";

test.describe.configure({ mode: "serial" });

// Usuários criados na hora; o carimbo evita colisão se a pilha for reaproveitada
const carimbo = Date.now();
const SENHA = "SenhaDeTeste#2026";
const alice = { nome: "Alice Sintetica", email: `alice.${carimbo}@e2e.economize.test`, senha: SENHA };
const bruno = { nome: "Bruno Sintetico", email: `bruno.${carimbo}@e2e.economize.test`, senha: SENHA };

const extrato = montarExtrato();
const compra = extrato.lancamentos.find((l) => l.papel === "compra em cartão")!;

let context: BrowserContext;
let page: Page;
const vigia = new Vigia();

test.beforeAll(async ({ browser }) => {
  context = await abrirContexto(browser);
  page = await context.newPage();
  await vigia.vigiar(context, page);
});

test.afterEach(async ({}, info) => {
  // Falha fora do previsto: guarda a tela do momento
  if (info.status !== info.expectedStatus) {
    await captura(page, `falha-${info.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 60)}`).catch(() => undefined);
  }
});

test.afterAll(async () => {
  // A fase "com-cambio" entra com a mesma conta, pelo formulário
  mkdirSync(ARTIFACTS, { recursive: true });
  writeFileSync(join(ARTIFACTS, "sessao.json"), JSON.stringify({ alice }));
  vigia.gravar();
  await context?.close();
});

// ------------------------------------------------------------------ a. sessão

test("a. cadastro de usuário novo cai na Home", async () => {
  await page.goto("/");
  await expect(botao(page, "Entrar")).toBeVisible();
  await vigia.conferirTela(page, "Login");

  await cadastrar(page, alice);
  await vigia.conferirTela(page, "Cadastro");
  await botao(page, "Cadastrar").click();

  await expect(page.getByText("Olá, Alice")).toBeVisible();
  await expect(page.getByText("Tudo começa com um extrato")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Início", exact: true })).toHaveAttribute("aria-selected", "true");
  await vigia.conferirTela(page, "Home sem dados");
});

test("a. logout e login pelo formulário", async () => {
  await botao(page, "Perfil").click();
  await expect(botao(page, "Sair")).toBeVisible();
  await vigia.conferirTela(page, "Perfil");
  await page.goBack();

  await sair(page);
  await entrar(page, alice);
  await expect(page.getByText("Olá, Alice")).toBeVisible();
  await vigia.conferirTela(page, "Home depois do login");
});

// ------------------------------------------------------------------ b. extrato

test("b. importa o extrato OFX sintético pela tela de Extrato", async () => {
  await irPara(page, "Finanças", "Extrato");
  const importar = botao(page, "Importar extrato");
  await expect(importar).toBeVisible();
  await expect(page.getByText("Nenhum extrato importado")).toBeVisible();
  await vigia.conferirTela(page, "Extrato sem dados");

  // Em 390x664 o botão nasce abaixo da barra de abas; a lista tem de ter curso
  // para ele subir. Rola até o fim, como um dedo, e o toque tem de acertá-lo
  await rolarAteOFim(importar);
  expect(await quemEstaNoCentro(importar), "quem recebe o toque no centro de 'Importar extrato'").toBe(
    "o próprio elemento",
  );
  await captura(page, "extrato-vazio-botao-livre");
  const [seletor] = await Promise.all([page.waitForEvent("filechooser"), importar.click()]);
  const [envio] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/bank-statements/upload") && r.request().method() === "POST"),
    seletor.setFiles(extrato.arquivo),
  ]);
  expect(envio.status(), "POST /bank-statements/upload").toBe(200);

  // A importação leva direto à Revisão, com a contagem do arquivo
  const total = extrato.lancamentos.length;
  await expect(page.getByText(`${total} transações em ${total} grupos`)).toBeVisible();
  for (const l of extrato.lancamentos) {
    const grupo = page.getByRole("button", { name: new RegExp(`^Grupo ${l.memo}, 1 transação`) });
    await expect(grupo, `grupo de ${l.memo}`).toBeVisible();
    await expect(grupo).toContainText(brl(l.valor));
    if (l.valor < 0) await expect(grupo).toContainText(/-\s?R\$/);
  }
  await vigia.conferirTela(page, "Revisão logo após importar");
  await botao(page, "Deixar para depois").click();

  // De volta ao Extrato: contagem e valores contra o fixture
  await expect(page.getByText("Lançamentos", { exact: true })).toBeVisible();
  for (const l of extrato.lancamentos) {
    const sentido = l.valor < 0 ? "saída" : "entrada";
    const linha = page.getByRole("button", { name: new RegExp(`^${l.memo}, .*${sentido} de `) });
    await expect(linha, `lançamento ${l.memo}`).toHaveCount(1);
    await expect(linha).toHaveAccessibleName(brl(l.valor));
  }
  await expect(page.getByRole("button", { name: /Abrir detalhes e apelido$/ })).toHaveCount(total);

  const resumo = botao(page, "Ver de onde estes números foram somados");
  await expect(resumo).toContainText(new RegExp(`Entradas\\s*${brl(extrato.entradas).source}`));
  await expect(resumo).toContainText(new RegExp(`Saídas\\s*${brl(extrato.saidas).source}`));
  await expect(resumo).toContainText(new RegExp(`Líquido\\s*${brl(extrato.saldo).source}`));
  await expect(page.getByText(`${total} transações aguardando revisão`)).toBeVisible();

  await vigia.conferirTela(page, "Extrato com dados");
  // a captura mostra os lançamentos, não só o resumo do topo
  await centralizar(page.getByRole("button", { name: /Abrir detalhes e apelido$/ }).nth(2));
  await captura(page, "extrato-com-dados");
});

// --------------------------------------------------------------------- c. home

test("c. Home: entradas e saídas do mês batem com o fixture", async () => {
  await irPara(page, "Início");
  await dispensarFolhaDoPote(page);

  // O esperado sai do fixture (ver lib/fixture.mjs para a regra), não da tela
  const gastos = page.getByRole("button", { name: /^Gastos do período: / });
  await expect(gastos).toHaveAccessibleName(brl(extrato.saidas));
  // As outras abas continuam montadas e têm textos parecidos ("Entradas R$…"
  // também existe no Extrato): os números são lidos DENTRO do cartão da Home
  await expect(gastos.locator("xpath=..")).toContainText(
    new RegExp(`Entradas\\s*${brl(extrato.entradas).source}`),
  );
  const sobrou = page
    .locator("div")
    .filter({ has: page.getByText(/^Sobrou em /), hasText: brl(extrato.saldo) })
    .last();
  await expect(sobrou).toBeVisible();

  await vigia.conferirTela(page, "Home com dados");
  await captura(page, "home-com-dados");
});

// ------------------------------------------------------------------ d. revisão

test("d. Revisão: confirmar uma categoria faz a contagem pendente cair", async () => {
  const total = extrato.lancamentos.length;
  await botao(page, `${total} transações aguardando revisão`).click();
  await expect(page.getByText(`${total} transações em ${total} grupos`)).toBeVisible();

  const [confirmacao] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/transactions/") && r.request().method() !== "GET"),
    botao(page, new RegExp(`^Confirmar grupo ${compra.memo} como `), false).click(),
  ]);
  expect(confirmacao.status(), `${confirmacao.request().method()} ${confirmacao.url()}`).toBeLessThan(300);

  await expect(page.getByText(`${total - 1} transações em ${total - 1} grupos`)).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(`^Grupo ${compra.memo},`) })).toHaveCount(0);
  await vigia.conferirTela(page, "Revisão");

  await botao(page, "Fechar revisão").click();
  await expect(botao(page, `${total - 1} transações aguardando revisão`)).toBeVisible();
});

// ------------------------------------------------------------ e. investimentos

async function abrirInvestimentos() {
  await irPara(page, "Finanças", "Investimentos");
  await expect(page.getByRole("heading", { name: "Seus indicadores" })).toBeVisible();
}

/** O cartão de UMA posição: o menor bloco que tem o nome e o botão de editar. */
function linhaDaPosicao(nome: string) {
  return page
    .locator("div")
    .filter({ has: page.getByText(nome, { exact: true }) })
    .filter({ has: botao(page, `Editar ${nome}`) })
    .last();
}

/** Preenche a folha de cadastro (já aberta) e confere que a API gravou. */
async function salvarPosicao() {
  const [criacao] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/investments/positions") && r.request().method() === "POST"),
    botao(page, "Cadastrar posição").click(),
  ]);
  expect(criacao.status(), "POST /investments/positions").toBe(201);
  return criacao;
}

test("e. Investimentos: posição manual em BRL e em USD", async () => {
  await abrirInvestimentos();
  await expect(page.getByText("Ainda não encontramos investimentos")).toBeVisible();
  await vigia.conferirTela(page, "Investimentos sem posições");

  // A posição em BRL, a primeira da carteira
  await tocar(botao(page, "Cadastrar à mão"));
  await campo(page, "Nome").fill(CDB.nome);
  await campo(page, "Valor investido (R$)").fill(String(CDB.investido));
  await campo(page, "Valor atual (R$, opcional)").fill(String(CDB.atual));
  await salvarPosicao();

  // A primeira posição da carteira: a tela continua de pé, com o resumo
  await expect(page.getByRole("heading", { name: "Posições" })).toBeVisible();
  await expect(page.getByLabel(/^Resultado: \+R\$\s50,00 \(\+5,00%\)$/)).toBeVisible();
  await vigia.conferirTela(page, "Investimentos com a primeira posição");

  const linhaCdb = linhaDaPosicao(CDB.nome);
  await expect(linhaCdb).toContainText(brl(CDB.atual));
  await expect(page.getByText("1 posição", { exact: true })).toBeVisible();

  // A posição em USD: ETF com ticker de fora
  await tocar(botao(page, "Cadastrar posição à mão"));
  await botao(page, "Tipo: ETFs").click();
  await campo(page, "Nome").fill(ETF.nome);
  await campo(page, "Código do ativo").fill(ETF.codigo);
  await botao(page, "Dólar (US$)").click();
  await campo(page, "Quantidade").fill(String(ETF.quantidade));
  await campo(page, "Preço unitário (US$)").fill(String(ETF.precoUsd));
  await campo(page, "Valor investido (R$)").fill(String(ETF.investido));
  // A cotação do ticker é pedida pelo app logo depois de salvar; quem responde
  // por baixo da API é o dublê local (lib/market-stub.mjs), em US$ e sem câmbio
  const [criacao, cotacao] = await Promise.all([
    salvarPosicao(),
    page.waitForResponse((r) => r.url().includes(`/indicators/quote/${ETF.codigo}`)),
  ]);
  expect((await criacao.json()).currency).toBe("USD");
  expect(cotacao.status(), "GET /indicators/quote/VT").toBe(200);
  const cotado = await cotacao.json();
  expect(cotado.price, "preço em US$ vindo do dublê").toBe(ETF.cotacaoUsd);
  // a folha de cadastro fecha sozinha depois de salvar
  await expect(botao(page, "Cadastrar posição")).toBeHidden();

  await expect(page.getByText("2 posições", { exact: true })).toBeVisible();
  const linhaEtf = linhaDaPosicao(ETF.nome);
  await expect(linhaEtf).toBeVisible();
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const textoEtf = (await linhaEtf.innerText()).replace(/\s+/g, " ");

  // Nesta fase há cotação em dólar e NÃO há câmbio. A posição mostra o que
  // se sabe (quantidade × cotação, em US$), não inventa reais e diz o que falta
  expect(cotado.priceBrl ?? null, "a API não tem câmbio nesta fase").toBeNull();
  expect(textoEtf).toMatch(usd(ETF.quantidade * ETF.cotacaoUsd));
  await expect(linhaEtf).toContainText("sem câmbio · fora do total");
  expect(textoEtf, "sem câmbio não há equivalente em reais").not.toMatch(/≈|R\$/);
  expect(textoEtf).not.toContain("cotação indisponível");
  // "Fora do total" é verdade: o cabeçalho segue sendo só o CDB
  await expect(page.getByLabel(/^Valor atual: /)).toHaveAccessibleName(brl(CDB.atual));

  await vigia.conferirTela(page, "Investimentos com BRL e USD");
  // A captura mostra as duas posições, já sem o aviso de "cadastrada" por cima
  await avisoSaiuDaTela(page, "Posição cadastrada.");
  await centralizar(linhaEtf);
  await captura(page, "investimentos-brl-e-usd-sem-cambio");
});

// -------------------------------------------------------------- f. outra conta

test("f. troca de conta: nada do primeiro usuário aparece para o segundo", async () => {
  await irPara(page, "Início");
  await sair(page);
  // Fecha a conta da Alice aqui: o que sobrar de chamada dela fica deste lado
  await vigia.conferirTela(page, "Login depois de sair");
  const chamadasDaAlice = vigia.chamadas.length;
  await cadastrar(page, bruno);
  await botao(page, "Cadastrar").click();
  await expect(page.getByText("Olá, Bruno")).toBeVisible();
  await aberturaTerminou(page.getByText("Olá, Bruno"));

  const nadaDaAlice = async (tela: string) => {
    // dá tempo de qualquer dado atrasado (cache, resposta órfã) aparecer
    await page.waitForLoadState("networkidle").catch(() => undefined);
    const texto = await page.locator("body").innerText();
    for (const proibido of [
      "Alice",
      ...extrato.lancamentos.map((l) => l.memo),
      CDB.nome,
      ETF.nome,
      brl(extrato.entradas),
      brl(extrato.saidas),
      brl(CDB.atual),
    ]) {
      if (typeof proibido === "string") expect(texto, `${tela}: sobrou "${proibido}" da outra conta`).not.toContain(proibido);
      else expect(texto, `${tela}: sobrou o valor ${proibido} da outra conta`).not.toMatch(proibido);
    }
  };

  // Home
  await expect(page.getByText("Tudo começa com um extrato")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Investido: / })).toHaveAccessibleName(brl(0));
  await expect(page.getByRole("button", { name: /aguardando revisão/ })).toHaveCount(0);
  await nadaDaAlice("Home do segundo usuário");
  await vigia.conferirTela(page, "Home do segundo usuário");
  await captura(page, "segundo-usuario-home-vazia");

  // Extrato
  await irPara(page, "Finanças", "Extrato");
  await expect(page.getByText("Nenhum extrato importado")).toBeVisible();
  await expect(page.getByRole("button", { name: /Abrir detalhes e apelido$/ })).toHaveCount(0);
  await nadaDaAlice("Extrato do segundo usuário");
  await vigia.conferirTela(page, "Extrato do segundo usuário");

  // Carteira e Investimentos
  await tocarAba(page, "Carteira");
  await nadaDaAlice("Carteira do segundo usuário");
  await vigia.conferirTela(page, "Carteira do segundo usuário");

  await tocarAba(page, "Investimentos");
  await expect(page.getByText("Ainda não encontramos investimentos")).toBeVisible();
  await nadaDaAlice("Investimentos do segundo usuário");
  await vigia.conferirTela(page, "Investimentos do segundo usuário");

  // Nem por baixo do pano: o Bruno não pode pedir a cotação do ticker da Alice
  const chamadasDoBruno = vigia.chamadas.slice(chamadasDaAlice);
  expect(
    chamadasDoBruno.filter((c) => c.includes(`/quote/${ETF.codigo}`)),
    "o segundo usuário pediu a cotação de um ativo que só o primeiro tem",
  ).toEqual([]);
});

// ------------------------------------------------- defeitos e garantias finais

test("e2. posição manual sem valor atual: resultado desconhecido, tela de pé", async () => {
  await abrirInvestimentos();
  await tocar(botao(page, "Cadastrar à mão"));
  await campo(page, "Nome").fill("Tesouro Sintetico");
  await campo(page, "Valor investido (R$)").fill("500");
  await salvarPosicao();

  // A API responde profit:null. O cabeçalho mostra um traço, não some nem cai
  const semResultado = async () => {
    await expect(page.getByRole("heading", { name: "Posições" })).toBeVisible();
    await expect(page.getByLabel("Resultado: desconhecido")).toHaveText("—");
    await expect(linhaDaPosicao("Tesouro Sintetico")).toBeVisible();
  };
  await semResultado();
  await vigia.conferirTela(page, "Investimentos com resultado desconhecido");

  // E continua de pé ao voltar à aba depois de recarregar
  await page.reload();
  await expect(page.getByText("Olá, Bruno")).toBeVisible();
  await aberturaTerminou(page.getByText("Olá, Bruno"));
  await abrirInvestimentos();
  await semResultado();
  await vigia.conferirTela(page, "Investimentos depois de recarregar");
});

// ------------------------------------------------------------ garantia final

test("g. nenhuma requisição saiu da máquina", async () => {
  const externos = [...new Set(vigia.externos)];
  // Produção nunca, em hipótese nenhuma
  expect(externos.filter((u) => /onrender\.com/.test(u)), "chamada a produção").toEqual([]);
  // O único pedido externo conhecido é o jsQR do CDN (bloqueado); outro é novidade
  expect(
    externos.filter((u) => !JSQR_DO_CDN.test(u)),
    "pedido externo que o roteiro não conhecia (todos foram bloqueados)",
  ).toEqual([]);
  vigia.observacoes["pedidos externos bloqueados"] = externos;
});
