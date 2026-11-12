// Roteiro de ponta a ponta do Economize: web exportada + API local + Postgres
// descartável, tudo nesta máquina (quem sobe é o e2e/run.sh).
//
// É UM roteiro, em série, numa página só: os passos dependem um do outro como
// dependem para quem usa o app, e a sessão nasce pelo formulário de verdade.
// Ninguém injeta token, ninguém fala com a API por fora do navegador.
//
// DEFEITO CONHECIDO não é consertado nem escondido aqui. O roteiro normal faz
// os passos com conferência dura, ANOTA o sintoma do defeito (e a captura) e
// segue pelo caminho que a pessoa seguiria. No fim do arquivo, cada defeito tem
// um teste de UMA asserção sobre o sintoma anotado, marcado com `test.fail` e
// o motivo. Assim a marca só cobre o defeito, nunca um seletor quebrado; e no
// dia em que ele for consertado o Playwright acusa "era para falhar e passou".
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { montarExtrato } from "../lib/fixture.mjs";
import { COTACOES } from "../lib/market-cotacoes.mjs";
import {
  aberturaTerminou,
  abrirContexto,
  botao,
  brl,
  cadastrar,
  campo,
  captura,
  dispensarFolhaDoPote,
  entrar,
  irPara,
  JSQR_DO_CDN,
  quemEstaNoCentro,
  sair,
  Vigia,
  VIEWPORT,
} from "./apoio";

test.describe.configure({ mode: "serial" });

// Usuários criados na hora; o carimbo evita colisão se a pilha for reaproveitada
const carimbo = Date.now();
const SENHA = "SenhaDeTeste#2026";
const alice = { nome: "Alice Sintetica", email: `alice.${carimbo}@e2e.economize.test`, senha: SENHA };
const bruno = { nome: "Bruno Sintetico", email: `bruno.${carimbo}@e2e.economize.test`, senha: SENHA };

const extrato = montarExtrato();
const compra = extrato.lancamentos.find((l) => l.papel === "compra em cartão")!;

const CDB = { nome: "CDB Banco Sintetico", investido: 1000, atual: 1050 };
// `cotacaoUsd` é o preço que o dublê de mercado devolve para VT (lib/market-stub.mjs)
const ETF = { nome: "ETF Global Sintetico", codigo: "VT", quantidade: 2, precoUsd: 100, investido: 1000, cotacaoUsd: COTACOES["vt.us"] };

let context: BrowserContext;
let page: Page;
const vigia = new Vigia();

/** O que o roteiro viu de cada defeito conhecido; cobrado nos testes do fim. */
const sintomas = {
  d1QuemRecebeOToque: "não medido",
  d2: { excecoes: ["não medido"], telaSobreviveu: false },
  d2b: { excecoes: ["não medido"], telaSobreviveu: false },
};

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

  // D1: rola o que der, como faria um dedo, e anota quem recebe o toque
  await importar.scrollIntoViewIfNeeded();
  sintomas.d1QuemRecebeOToque = await quemEstaNoCentro(importar);
  await captura(page, "defeito-D1-importar-coberto");

  // Contorno do D1, declarado: se o botão está coberto em 390x664, o toque é
  // dado com a altura de um iPhone 12 em tela cheia (844), onde ele fica
  // livre. É um toque de verdade; a tela volta a 664 em seguida.
  const coberto = sintomas.d1QuemRecebeOToque !== "o próprio elemento";
  if (coberto) await page.setViewportSize({ width: VIEWPORT.width, height: 844 });
  const [seletor] = await Promise.all([page.waitForEvent("filechooser"), importar.click()]);
  if (coberto) await page.setViewportSize(VIEWPORT);
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
  await page.getByRole("button", { name: /Abrir detalhes e apelido$/ }).nth(2).evaluate((el) => el.scrollIntoView({ block: "center" }));
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

/** Depois de salvar: a tela continua de pé? Anota exceções e devolve o veredito. */
async function comoFicouATela() {
  await page.waitForTimeout(2_000);
  const excecoes = vigia
    .descartar()
    .filter((e) => e.tipo === "excecao")
    .map((e) => e.texto);
  const telaSobreviveu = await page.getByRole("heading", { name: "Posições" }).isVisible();
  return { excecoes, telaSobreviveu };
}

test("e. Investimentos: posição manual em BRL e em USD", async () => {
  await abrirInvestimentos();
  await expect(page.getByText("Ainda não encontramos investimentos")).toBeVisible();
  await vigia.conferirTela(page, "Investimentos sem posições");

  // A posição em BRL, a primeira da carteira
  await botao(page, "Cadastrar à mão").click();
  await campo(page, "Nome").fill(CDB.nome);
  await campo(page, "Valor investido (R$)").fill(String(CDB.investido));
  await campo(page, "Valor atual (R$, opcional)").fill(String(CDB.atual));
  await salvarPosicao();

  // D2: anota se o app sobreviveu ao cadastro da primeira posição
  sintomas.d2 = await comoFicouATela();
  await captura(page, "defeito-D2-apos-primeira-posicao");
  if (!sintomas.d2.telaSobreviveu) {
    // Recupera como a pessoa faria: recarrega. A sessão tem de sobreviver.
    await page.reload();
    await expect(page.getByText("Olá, Alice")).toBeVisible();
    await dispensarFolhaDoPote(page, 3_000);
    vigia.descartar();
    await abrirInvestimentos();
  }

  // A posição em BRL foi gravada, com ou sem D2
  const linhaCdb = linhaDaPosicao(CDB.nome);
  await expect(linhaCdb).toContainText(brl(CDB.atual));
  await expect(page.getByText("1 posição", { exact: true })).toBeVisible();

  // A posição em USD: ETF com ticker de fora
  await botao(page, "Cadastrar posição à mão").click();
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

  // O que a tela faz com uma posição em dólar depende do que há de mercado.
  // O roteiro confere o que cada desfecho promete e REGISTRA qual aconteceu;
  // neste ambiente há cotação em US$ e não há câmbio.
  let desfecho: string;
  if (/US\$/.test(textoEtf) && /≈\s?R\$/.test(textoEtf)) {
    desfecho = "US$ e ≈ R$";
  } else if (/US\$/.test(textoEtf)) {
    desfecho = "US$ e 'sem cotação · fora do total'";
    await expect(linhaEtf).toContainText("sem cotação · fora do total");
  } else if (/R\$/.test(textoEtf)) {
    desfecho = "valor só em R$ (convertido), sem US$";
  } else {
    desfecho = "'cotação indisponível': sem US$, sem ≈ R$ e sem a marca 'fora do total'";
    await expect(linhaEtf).toContainText("cotação indisponível");
  }
  // Sem câmbio, a posição em dólar não pode entrar no total: ele é só o CDB
  if (!/R\$/.test(textoEtf)) {
    await expect(page.getByText(new RegExp(`^Valor atual\\s*${brl(CDB.atual).source}`)).first()).toBeVisible();
  }
  const visto = {
    desfecho,
    texto: textoEtf,
    cotacaoDaApi: { price: cotado.price, currency: cotado.currency, priceBrl: cotado.priceBrl ?? null },
  };
  vigia.observacoes["posição em USD"] = visto;
  test.info().annotations.push({ type: "posição em USD", description: JSON.stringify(visto) });

  await vigia.conferirTela(page, "Investimentos com BRL e USD");
  // A captura mostra as duas posições
  await linhaCdb.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await linhaEtf.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await captura(page, "investimentos-brl-e-usd");
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
  await page.getByRole("tab", { name: "Carteira", exact: true }).click();
  await nadaDaAlice("Carteira do segundo usuário");
  await vigia.conferirTela(page, "Carteira do segundo usuário");

  await page.getByRole("tab", { name: "Investimentos", exact: true }).click();
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

test("e2. posição manual sem valor atual (segundo usuário)", async () => {
  await abrirInvestimentos();
  await botao(page, "Cadastrar à mão").click();
  await campo(page, "Nome").fill("Tesouro Sintetico");
  await campo(page, "Valor investido (R$)").fill("500");
  await salvarPosicao();
  vigia.descartar();

  // D2b: recarrega (para não confundir com o D2) e abre a aba de novo
  await page.reload();
  await expect(page.getByText("Olá, Bruno")).toBeVisible();
  await aberturaTerminou(page.getByText("Olá, Bruno"));
  vigia.descartar();
  await page.getByRole("tab", { name: "Finanças", exact: true }).click();
  await page.getByRole("tab", { name: "Investimentos", exact: true }).click();
  sintomas.d2b = await comoFicouATela();
  await captura(page, "defeito-D2b-posicao-sem-valor-atual");
});

// ------------------------------------------------- defeitos e garantias finais
//
// Cada teste abaixo tem UMA asserção, sobre um sintoma que o roteiro anotou.

test("D1 (defeito conhecido): no Extrato vazio, 'Importar extrato' recebe o toque em 390x664", async () => {
  test.fail(
    true,
    "D1: em 390x664 a barra de abas de baixo cobre o botão 'Importar extrato' do Extrato vazio e a lista " +
      "quase não rola: o toque no centro do botão cai na aba. Evidência: defeito-D1-importar-coberto.png",
  );
  expect(sintomas.d1QuemRecebeOToque).toBe("o próprio elemento");
});

test("D2 (defeito conhecido): cadastrar a primeira posição manual não derruba o app", async () => {
  test.fail(
    true,
    "D2: depois do POST /investments/positions (201) da PRIMEIRA posição, a página lança TypeError " +
      "(toLocaleString em null) e o app inteiro vira a tela de abertura; só recarregando volta. " +
      "Evidência: defeito-D2-apos-primeira-posicao.png",
  );
  expect(sintomas.d2).toEqual({ excecoes: [], telaSobreviveu: true });
});

test("D2b (defeito conhecido): posição manual sem valor atual não quebra a aba Investimentos", async () => {
  test.fail(
    true,
    "D2b: com uma posição manual sem valor atual, GET /investments/summary devolve profit:null e a aba " +
      "Investimentos derruba o app TODA vez que é aberta, inclusive depois de recarregar. " +
      "Evidência: defeito-D2b-posicao-sem-valor-atual.png",
  );
  expect(sintomas.d2b).toEqual({ excecoes: [], telaSobreviveu: true });
});

test("D3 (defeito conhecido): o console fica limpo para quem não tem família", async () => {
  test.fail(
    true,
    "D3: GET /family responde 404 para usuário sem família e o navegador registra " +
      "'Failed to load resource' no console a cada entrada",
  );
  expect(vigia.tolerados.filter((t) => t.id === "D3").map((t) => `${t.tela}: ${t.evento.texto}`)).toEqual([]);
});

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
