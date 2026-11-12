// Fase "com-cambio" do run.sh: a API foi reiniciada com dólar (mesmo banco),
// e a conta do roteiro entra de novo pelo formulário. A MESMA posição em dólar
// que estava "sem câmbio · fora do total" agora tem de mostrar o "≈ R$".
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  abrirContexto,
  ARTIFACTS,
  botao,
  brl,
  captura,
  dispensarFolhaDoPote,
  entrar,
  irPara,
  Vigia,
} from "./apoio";
import { CDB, DOLAR_EM_REAIS, ETF, usd } from "./carteira";

test.describe.configure({ mode: "serial" });

const { alice } = JSON.parse(readFileSync(join(ARTIFACTS, "sessao.json"), "utf8"));

let context: BrowserContext;
let page: Page;
const vigia = new Vigia();

test.beforeAll(async ({ browser }) => {
  context = await abrirContexto(browser);
  page = await context.newPage();
  await vigia.vigiar(context, page);
});

test.afterAll(async () => {
  vigia.gravar("registro-com-cambio.json");
  await context?.close();
});

test("e. Investimentos com câmbio: a posição em dólar ganha o equivalente em reais", async () => {
  await page.goto("/");
  await entrar(page, alice);
  await expect(page.getByText("Olá, Alice")).toBeVisible();
  // com dados, a folha do pote abre por cima da Home; o toque espera a abertura sair
  await dispensarFolhaDoPote(page, 8_000);

  const [cotacao] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/indicators/quote/${ETF.codigo}`)),
    irPara(page, "Finanças", "Investimentos"),
  ]);
  const cotado = await cotacao.json();
  expect(cotado.price, "cotação em US$ vinda do dublê").toBe(ETF.cotacaoUsd);
  expect(cotado.priceBrl, "a API converteu pelo dólar do dublê").toBe(ETF.cotacaoUsd * DOLAR_EM_REAIS);

  const emDolar = ETF.quantidade * ETF.cotacaoUsd;
  const emReais = emDolar * DOLAR_EM_REAIS;
  const linhaEtf = page
    .locator("div")
    .filter({ has: page.getByText(ETF.nome, { exact: true }) })
    .filter({ has: botao(page, `Editar ${ETF.nome}`) })
    .last();
  // O número da posição é em dólar; os reais são a conta derivada, com "≈"
  await expect(linhaEtf).toContainText(usd(emDolar));
  await expect(linhaEtf).toContainText(new RegExp(`≈\\s?${brl(emReais).source}`));
  // Custo em reais contra o equivalente em reais: resultado nos dois lados em R$
  const ganho = emReais - ETF.investido;
  await expect(linhaEtf).toContainText(new RegExp(`\\+${brl(ganho).source}`));
  await expect(linhaEtf).not.toContainText("fora do total");
  await expect(linhaEtf).not.toContainText("cotação indisponível");

  // O total do cabeçalho vem do servidor, que não soma posição manual cotada
  // pelo app: com ou sem câmbio ele é só o CDB. Fica registrado aqui para a
  // mudança dessa regra não passar em silêncio.
  await expect(page.getByLabel(/^Valor atual: /)).toHaveAccessibleName(brl(CDB.atual));

  await vigia.conferirTela(page, "Investimentos com câmbio");
  await linhaEtf.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await captura(page, "investimentos-brl-e-usd-com-cambio");
});

test("g. nenhuma requisição saiu da máquina", async () => {
  expect(vigia.externos.filter((u) => /onrender\.com/.test(u)), "chamada a produção").toEqual([]);
});
