// Apoio do roteiro: o contexto do navegador, o vigia de console/rede e os
// pequenos gestos que se repetem. Nada aqui conhece regra de negócio.
import { expect, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const WEB_URL = process.env.E2E_WEB_URL!;
export const API_URL = process.env.E2E_API_URL!;
export const ARTIFACTS = join(dirname(fileURLToPath(import.meta.url)), "..", "artifacts");

/** O alvo do dono: iPhone 12 no Safari, que deixa 390x664 úteis. Tema escuro. */
export const VIEWPORT = { width: 390, height: 664 };

export async function abrirContexto(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    baseURL: WEB_URL,
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    colorScheme: "dark",
  });
}

/** "R$ 4.650,00", aceitando o espaço comum ou o não-separável que o Intl põe. */
export function brl(valor: number): RegExp {
  const texto = Math.abs(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return new RegExp(`R\\$\\s?${texto.replace(/\./g, "\\.")}(?!\\d)`);
}

export const JSQR_DO_CDN = /^https:\/\/cdn\.jsdelivr\.net\/npm\/jsqr@/;

type Evento = { tipo: "console" | "excecao" | "resposta" | "externo"; texto: string; url?: string; status?: number };

/**
 * Ruído que o roteiro CONHECE e por isso não derruba a conferência de cada
 * tela. Cada item diz por que é inevitável aqui. Nada entra por conveniência:
 * defeito do app não mora nesta lista, mora num teste que falha.
 */
const CONHECIDOS: { id: string; motivo: string; casa: (e: Evento) => boolean }[] = [
  {
    id: "RUIDO-FAMILIA",
    motivo:
      "GET /family responde 404 para quem não tem família. O app trata como 'sem família' (sem erro na " +
      "tela), mas o navegador registra todo 404 no console por conta própria; só a API mudando o contrato " +
      "tira a linha",
    casa: (e) => e.status === 404 && /\/api\/v1\/family$/.test(e.url ?? ""),
  },
  {
    id: "EXTERNO-JSQR",
    motivo: "o app pede jsQR a cdn.jsdelivr.net ao abrir; o roteiro bloqueia toda saída da máquina",
    casa: (e) => JSQR_DO_CDN.test(e.url ?? ""),
  },
];

export class Vigia {
  private fila: Evento[] = [];
  /** Tudo o que foi tolerado, para o relatório final dizer o que apareceu. */
  readonly tolerados: { id: string; motivo: string; tela: string; evento: Evento }[] = [];
  /** Toda requisição que tentou sair da máquina (todas foram abortadas). */
  readonly externos: string[] = [];
  /** Toda chamada feita à API, em ordem: "GET /api/v1/…". */
  readonly chamadas: string[] = [];
  readonly observacoes: Record<string, unknown> = {};

  async vigiar(context: BrowserContext, page: Page) {
    // A garantia dura de "nada de produção": o que não for a web ou a API
    // locais é abortado antes de sair, e fica anotado
    await context.route(
      // só http(s): blob: e data: nascem dentro da própria página
      (url) => /^https?:$/.test(url.protocol) && !url.href.startsWith(WEB_URL) && !url.href.startsWith(API_URL),
      (route) => {
        const url = route.request().url();
        this.externos.push(url);
        this.fila.push({ tipo: "externo", texto: `requisição externa bloqueada: ${url}`, url });
        // O jsQR do CDN é pedido na abertura do app: recebe um script vazio
        // (a requisição não sai da máquina do mesmo jeito) para a falha de
        // rede provocada por este bloqueio não virar exceção na página
        if (JSQR_DO_CDN.test(url)) return route.fulfill({ status: 200, contentType: "text/javascript", body: "" });
        return route.abort();
      },
    );
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      this.fila.push({ tipo: "console", texto: msg.text(), url: msg.location().url });
    });
    page.on("pageerror", (erro) => this.fila.push({ tipo: "excecao", texto: String(erro) }));
    page.on("request", (req) => {
      if (req.url().startsWith(API_URL)) this.chamadas.push(`${req.method()} ${req.url().slice(API_URL.length)}`);
    });
    page.on("response", (res) => {
      if (res.status() < 400) return;
      const req = res.request();
      this.fila.push({
        tipo: "resposta",
        texto: `${res.status()} ${req.method()} ${res.url()}`,
        url: res.url(),
        status: res.status(),
      });
    });
  }

  /** Esvazia a fila sem conferir: para depois de um defeito já registrado. */
  descartar(): Evento[] {
    const eventos = this.fila;
    this.fila = [];
    return eventos;
  }

  /**
   * A conferência de toda tela visitada (item g do roteiro): sem rolagem
   * horizontal da página, sem erro no console, sem exceção, sem resposta 5xx.
   */
  async conferirTela(page: Page, tela: string) {
    // dá tempo de as chamadas da tela terminarem e de seus erros chegarem
    await page.waitForLoadState("networkidle").catch(() => undefined);
    const eventos = this.descartar();

    // O erro de console "Failed to load resource" é o eco de uma resposta: o
    // status vem da resposta de mesma URL, que é quem diz se é conhecido
    const statusPorUrl = new Map(eventos.filter((e) => e.tipo === "resposta").map((e) => [e.url, e.status]));
    const inesperados: Evento[] = [];
    for (const evento of eventos) {
      const completo = { ...evento, status: evento.status ?? statusPorUrl.get(evento.url) };
      const conhecido = CONHECIDOS.find((c) => c.casa(completo));
      if (conhecido) {
        this.tolerados.push({ id: conhecido.id, motivo: conhecido.motivo, tela, evento: completo });
      } else if (completo.tipo === "resposta" && (completo.status ?? 0) < 500) {
        // 4xx sem eco no console não é erro por si só; fica só anotado
        this.tolerados.push({ id: "4XX", motivo: "resposta 4xx", tela, evento: completo });
      } else {
        inesperados.push(completo);
      }
    }
    expect(inesperados, `${tela}: erro de console, exceção, 5xx ou saída da máquina`).toEqual([]);

    const larguras = await page.evaluate(() => ({
      janela: window.innerWidth,
      documento: document.documentElement.scrollWidth,
      corpo: document.body.scrollWidth,
    }));
    expect(
      Math.max(larguras.documento, larguras.corpo),
      `${tela}: a página rola na horizontal (${JSON.stringify(larguras)})`,
    ).toBeLessThanOrEqual(larguras.janela);
    await conferirAlinhamento(page, tela);
  }

  gravar(arquivo = "registro.json") {
    mkdirSync(ARTIFACTS, { recursive: true });
    const porId: Record<string, { motivo: string; vezes: number; telas: string[] }> = {};
    for (const t of this.tolerados) {
      const item = (porId[t.id] ??= { motivo: t.motivo, vezes: 0, telas: [] });
      item.vezes += 1;
      if (!item.telas.includes(t.tela)) item.telas.push(t.tela);
    }
    writeFileSync(
      join(ARTIFACTS, arquivo),
      JSON.stringify({ observacoes: this.observacoes, tolerados: porId, externos: [...new Set(this.externos)] }, null, 2),
    );
  }
}

/**
 * O conteúdo está no lugar na horizontal? Duas coisas denunciam uma tela
 * deslocada, e as duas são cobradas em toda tela visitada e antes de toda
 * captura:
 *
 * 1. um contêiner de página (cena, paginador) com `overflow: hidden` rolado
 *    para o lado. Ninguém rola
 *    isso com o dedo; quando acontece (um `scrollIntoView`, um foco) a tela
 *    inteira fica deslocada e não volta sozinha;
 * 2. um bloco de conteúdo VISÍVEL cortado pela borda da tela — começa antes
 *    de 0 ou termina depois da largura. Ficam de fora as faixas de rolagem horizontal
 *    intencionais (chips, atalhos de banco, cartões de indicador), onde o
 *    corte é o convite a arrastar, e o que está inteiro fora da tela (as
 *    outras abas do paginador, a folha recolhida).
 */
export async function conferirAlinhamento(page: Page, tela: string) {
  // deixa a troca de aba e as folhas terminarem de assentar
  let anterior = "";
  let achados = { rolados: [] as string[], cortados: [] as string[] };
  for (let i = 0; i < 12; i++) {
    achados = await page.evaluate(() => {
      const largura = window.innerWidth;
      const altura = window.innerHeight;
      const nome = (el: Element) =>
        `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}"`;

      // Faixa: uma tira baixa que rola para o lado (chips, atalhos de banco,
      // a régua das abas). Cena e paginador são altos — ocupam a tela
      const ehFaixa = (p: Element) => p.clientHeight < altura / 3;

      const rolados: string[] = [];
      for (const el of document.querySelectorAll("*")) {
        if (el.scrollLeft !== 0 && getComputedStyle(el).overflowX === "hidden" && !ehFaixa(el)) {
          rolados.push(`${nome(el)} scrollLeft=${Math.round(el.scrollLeft)}`);
        }
      }

      const emFaixa = (el: Element) => {
        for (let p = el.parentElement; p; p = p.parentElement) {
          if (getComputedStyle(p).overflowX !== "visible" && p.scrollWidth > p.clientWidth + 2 && ehFaixa(p)) return true;
        }
        return false;
      };

      const cortados: string[] = [];
      // Campo de texto fica de fora: o <input> do react-native-web é mais largo
      // que a moldura do campo (o 'Preço unitário' vai a 423 px numa tela de
      // 390) sem que nada apareça cortado
      for (const el of document.querySelectorAll('[role="button"], button, [role="heading"], [role="tab"]')) {
        const caixa = el.getBoundingClientRect();
        if (caixa.width === 0 || caixa.height === 0 || caixa.bottom <= 0 || caixa.top >= altura) continue;
        // O que se vê do elemento: um campo de texto pode ser mais largo que a
        // moldura que o recorta, e isso não é conteúdo fora da tela. Só vale o
        // recorte de molduras PEQUENAS; o da página inteira é justamente o
        // que esconderia uma tela deslocada
        const r = { left: caixa.left, right: caixa.right, top: caixa.top, bottom: caixa.bottom };
        for (let p = el.parentElement; p; p = p.parentElement) {
          const q = p.getBoundingClientRect();
          if (getComputedStyle(p).overflowX !== "visible" && q.width < largura * 0.9) {
            r.left = Math.max(r.left, q.left);
            r.right = Math.min(r.right, q.right);
          }
        }
        if (r.right <= r.left) continue;
        const naTela = r.right > 1 && r.left < largura - 1;
        const cortado = r.left < -1 || r.right > largura + 1;
        if (!naTela || !cortado || emFaixa(el)) continue;
        // Só conta o que a pessoa de fato vê: a cena da outra aba fica
        // estacionada ao lado, invisível, e não é conteúdo cortado
        const x = Math.min(Math.max((r.left + r.right) / 2, 2), largura - 2);
        const y = Math.min(Math.max((r.top + r.bottom) / 2, 2), altura - 2);
        const topo = document.elementFromPoint(x, y);
        if (topo && (el.contains(topo) || topo.contains(el))) {
          cortados.push(`${nome(el)} x=${Math.round(r.left)}..${Math.round(r.right)}`);
        }
      }
      return { rolados, cortados };
    });
    const agora = JSON.stringify(achados);
    if (agora === anterior) break;
    anterior = agora;
    await page.waitForTimeout(250);
  }
  expect(achados.rolados, `${tela}: contêiner de overflow escondido rolado para o lado`).toEqual([]);
  expect(achados.cortados, `${tela}: conteúdo cortado pela borda da tela (largura ${VIEWPORT.width})`).toEqual([]);
}

export async function captura(page: Page, nome: string) {
  await conferirAlinhamento(page, `captura ${nome}`);
  mkdirSync(ARTIFACTS, { recursive: true });
  await page.screenshot({ path: join(ARTIFACTS, `${nome}.png`) });
}

/** O ponto central do elemento acerta o próprio elemento, ou algo o cobre? */
export async function quemEstaNoCentro(alvo: Locator): Promise<string> {
  return alvo.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (topo && el.contains(topo)) return "o próprio elemento";
    return `coberto por "${(topo?.textContent ?? topo?.tagName ?? "nada").trim().slice(0, 40)}"`;
  });
}

/**
 * A animação de abertura cobre a tela por até 4,5 s depois de entrar. O
 * conteúdo já está montado por baixo (as conferências de texto passam), mas a
 * captura sairia com o pote da abertura: espera o alvo ficar por cima.
 */
export async function aberturaTerminou(alvo: Locator) {
  await expect.poll(() => quemEstaNoCentro(alvo), { timeout: 10_000 }).toBe("o próprio elemento");
}

/**
 * Rola até o fim a lista que contém o elemento, como faria um dedo. O
 * `scrollIntoViewIfNeeded` do Playwright não serve aqui: para ele um botão
 * debaixo da barra de abas já "está na tela".
 */
export async function rolarAteOFim(alvo: Locator) {
  await alvo.evaluate((el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY;
      if (o === "auto" || o === "scroll") p.scrollTop = p.scrollHeight;
    }
  });
  await alvo.page().waitForTimeout(600);
}

/**
 * Traz o elemento para o meio da tela rolando SÓ na vertical. O
 * `scrollIntoView` do navegador também arrasta o paginador das abas alguns
 * pixels para o lado, e a captura sairia torta.
 */
export async function centralizar(alvo: Locator) {
  await alvo.evaluate((el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY;
      if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight + 4) {
        const r = el.getBoundingClientRect();
        const pr = p.getBoundingClientRect();
        p.scrollTop += r.top + r.height / 2 - (pr.top + pr.height / 2);
        return;
      }
    }
  });
  await alvo.page().waitForTimeout(400);
}

/**
 * Toca num botão que pode estar baixo na lista: primeiro o traz para o meio
 * rolando só na vertical, como um dedo. Sem isso o `click()` do Playwright,
 * ao achar o botão debaixo da barra de abas, tenta outros alinhamentos de
 * `scrollIntoView` e acaba rolando para o LADO o contêiner das abas.
 */
export async function tocar(alvo: Locator) {
  await centralizar(alvo);
  await alvo.click();
}

/** O aviso flutuante já saiu da tela? (ele fica no DOM, transladado para fora) */
export async function avisoSaiuDaTela(page: Page, texto: string) {
  await expect(page.getByText(texto, { exact: true })).not.toBeInViewport({ timeout: 10_000 });
}

// ----------------------------------------------------------------- os gestos

export const campo = (page: Page, nome: string | RegExp) => page.getByRole("textbox", { name: nome, exact: true });
export const botao = (page: Page, nome: string | RegExp, exato = true) =>
  page.getByRole("button", { name: nome, exact: exato });

export async function cadastrar(page: Page, pessoa: { nome: string; email: string; senha: string }) {
  await botao(page, "Criar conta").click();
  await campo(page, "Nome Completo").fill(pessoa.nome);
  await campo(page, "E-mail").fill(pessoa.email);
  await campo(page, "Senha").fill(pessoa.senha);
  await campo(page, "Confirmar senha").fill(pessoa.senha);
}

export async function entrar(page: Page, pessoa: { email: string; senha: string }) {
  await campo(page, "E-mail").fill(pessoa.email);
  await campo(page, "Senha").fill(pessoa.senha);
  await botao(page, "Entrar").click();
}

/** Perfil › Sair › confirmar. Termina na tela de login. */
export async function sair(page: Page) {
  await botao(page, "Perfil").click();
  await botao(page, "Sair").click();
  // o diálogo de confirmação repete o rótulo; o dele é o último na árvore
  await expect(page.getByText("Tem certeza que deseja encerrar a sessão?")).toBeVisible();
  await botao(page, "Sair").last().click();
  await expect(botao(page, "Entrar")).toBeVisible();
}

/** Espera o elemento parar de se mexer (duas medidas iguais seguidas). */
export async function assentou(alvo: Locator) {
  let anterior = "";
  await expect
    .poll(
      async () => {
        const caixa = JSON.stringify(await alvo.boundingBox());
        const parado = caixa === anterior;
        anterior = caixa;
        return parado;
      },
      { intervals: [120], timeout: 10_000 },
    )
    .toBe(true);
}

/**
 * Toca numa aba (de baixo ou de cima) depois de ela parar no lugar.
 *
 * Não é zelo: o `click()` do Playwright rola o alvo para a tela ANTES de
 * clicar. Com a régua das abas de cima ainda entrando, ele rolava o contêiner
 * das abas (`overflow: hidden`, 1560 px de conteúdo em 390) em 118 px, e a
 * tela ficava deslocada de vez — medido em 12/11/2026. Um dedo não faz isso:
 * o toque por coordenada, no mesmo instante, deixa tudo no lugar.
 */
export async function tocarAba(page: Page, nome: string) {
  const aba = page.getByRole("tab", { name: nome, exact: true });
  await assentou(aba);
  await aba.click();
}

export async function irPara(page: Page, aba: "Finanças" | "Início" | "Mercado", interna?: string) {
  await tocarAba(page, aba);
  if (interna) await tocarAba(page, interna);
}

/**
 * A folha "Seu pote conta o mês" abre sozinha na primeira Home com dados e
 * cobre a tela inteira. Quem usa o app toca em "Entendi"; o roteiro também.
 */
export async function dispensarFolhaDoPote(page: Page, espera = 6_000) {
  const entendi = botao(page, "Entendi");
  try {
    await entendi.waitFor({ state: "visible", timeout: espera });
  } catch {
    return false;
  }
  await entendi.click();
  await expect(entendi).toBeHidden();
  return true;
}
