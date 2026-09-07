import type {
  ForeignQuote,
  InvestmentIndexer,
  InvestmentInterest,
  InvestmentInterestKind,
  InvestmentMovementKind,
  InvestmentPosition,
  InvestmentPositionPayload,
  InvestmentProfile,
  InvestmentSource,
  InvestmentType,
  MacroIndicator,
  MacroIndicatorCode,
  TreasuryBond,
} from "../services/api";
import { isoDate, parseIsoDate } from "./cycleWindow";
import { formatBRL, formatDecimal, formatPercent } from "./money";

/**
 * Leitura dos investimentos (EC-15x).
 *
 * A regra que rege este arquivo: **o servidor consolida, o app explica**. Os
 * números (valor atual, resultado, participação) chegam prontos e nunca são
 * recalculados aqui — a única conta que o app faz é a da posição manual em
 * moeda estrangeira, porque só ele sabe qual cotação acabou de chegar.
 *
 * A segunda regra é a da PERSONALIZAÇÃO: o mesmo indicador (CDI, Selic,
 * dólar) é explicado de forma diferente para quem tem CDB, para quem tem
 * Tesouro Selic e para quem tem ETF no exterior. As frases de
 * `explainIndicatorForUser` nascem do perfil, não de um glossário fixo.
 */

// --- Rótulos ---

/** Ordem de exibição dos grupos. A renda fixa vem primeiro: é onde a maioria começa. */
export const INVESTMENT_TYPE_ORDER: readonly InvestmentType[] = [
  "FIXED_INCOME",
  "TREASURY",
  "FUND",
  "EQUITY",
  "ETF",
  "CRYPTO",
  "PENSION",
  "OTHER",
];

const TYPE_LABELS: Record<InvestmentType, string> = {
  FIXED_INCOME: "Renda fixa",
  TREASURY: "Tesouro Direto",
  FUND: "Fundos",
  EQUITY: "Ações",
  ETF: "ETFs",
  CRYPTO: "Cripto",
  PENSION: "Previdência",
  OTHER: "Outros",
};

export function investmentTypeLabel(
  type: InvestmentType | string | null | undefined,
): string {
  return TYPE_LABELS[type as InvestmentType] ?? TYPE_LABELS.OTHER;
}

/** Tipo desconhecido do servidor cai em "Outros" em vez de sumir da lista. */
export function normalizeInvestmentType(
  type: InvestmentType | string | null | undefined,
): InvestmentType {
  return type && type in TYPE_LABELS ? (type as InvestmentType) : "OTHER";
}

// Subtipos que o servidor emite hoje. O resto é humanizado a partir do código,
// para um subtipo novo nunca aparecer como "TESOURO_RENDA_MAIS" na tela
const SUBTYPE_LABELS: Record<string, string> = {
  CDB: "CDB",
  RDB: "RDB",
  LCI: "LCI",
  LCA: "LCA",
  LC: "Letra de câmbio",
  LF: "Letra financeira",
  DEBENTURE: "Debênture",
  CRI: "CRI",
  CRA: "CRA",
  TESOURO_SELIC: "Tesouro Selic",
  TESOURO_IPCA: "Tesouro IPCA+",
  TESOURO_PREFIXADO: "Tesouro Prefixado",
  TESOURO_RENDA_MAIS: "Tesouro Renda+",
  FUND_DI: "Fundo DI",
  FUND_FIXED_INCOME: "Fundo de renda fixa",
  MULTIMARKET: "Multimercado",
  FII: "Fundo imobiliário",
  STOCK: "Ação",
  BDR: "BDR",
  ETF_BR: "ETF Brasil",
  ETF_US: "ETF exterior",
  PGBL: "PGBL",
  VGBL: "VGBL",
  SAVINGS: "Poupança",
};

export function investmentSubtypeLabel(
  subtype: string | null | undefined,
): string | null {
  if (!subtype) return null;
  const known = SUBTYPE_LABELS[subtype.toUpperCase()];
  if (known) return known;
  const words = subtype.replace(/_/g, " ").trim().toLowerCase();
  if (!words) return null;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const INDEXER_LABELS: Record<InvestmentIndexer, string> = {
  CDI: "CDI",
  SELIC: "Selic",
  IPCA: "IPCA",
  PREFIXADO: "Prefixado",
  USD: "Dólar",
  NONE: "",
};

export function indexerLabel(
  indexer: InvestmentIndexer | string | null | undefined,
): string {
  return INDEXER_LABELS[indexer as InvestmentIndexer] ?? "";
}

const SOURCE_LABELS: Record<InvestmentSource, string> = {
  CONNECTOR: "Open Finance",
  STATEMENT: "Extrato",
  MANUAL: "Manual",
};

export function investmentSourceLabel(source: InvestmentSource): string {
  return SOURCE_LABELS[source] ?? source;
}

const MOVEMENT_LABELS: Record<InvestmentMovementKind, string> = {
  APPLY: "Aplicação",
  REDEEM: "Resgate",
  YIELD: "Rendimento",
  OTHER: "Outro",
};

export function movementKindLabel(kind: InvestmentMovementKind): string {
  return MOVEMENT_LABELS[kind] ?? MOVEMENT_LABELS.OTHER;
}

/** Resgate é dinheiro SAINDO da posição: negativo na lista, como no extrato. */
export function movementSignedAmount(
  kind: InvestmentMovementKind,
  amount: number,
): number {
  const abs = Math.abs(amount);
  return kind === "REDEEM" ? -abs : abs;
}

// --- Taxas e valores ---

const isFinite_ = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

// "110%" e não "110,00%": taxa inteira lê melhor sem casas mortas
const rateDigits = (value: number) =>
  formatPercent(value, { decimals: Number.isInteger(value) ? 0 : 2 });

/**
 * A taxa na gramática do indexador. É o mesmo número `rate` do servidor, mas
 * "110" com CDI é "110% do CDI" e "6,2" com IPCA é "IPCA + 6,20% a.a." —
 * mostrar só o número faria o CDB parecer render 110% ao ano.
 */
export function formatRate(
  rate: number | null | undefined,
  indexer?: InvestmentIndexer | string | null,
): string | null {
  const hasRate = isFinite_(rate);
  const spread = hasRate && rate !== 0;
  switch (indexer) {
    case "CDI":
      return hasRate ? `${rateDigits(rate)} do CDI` : "CDI";
    case "SELIC":
      return spread ? `Selic + ${rateDigits(rate)} a.a.` : "Selic";
    case "IPCA":
      return spread ? `IPCA + ${rateDigits(rate)} a.a.` : "IPCA";
    case "PREFIXADO":
      return hasRate ? `${rateDigits(rate)} a.a.` : "Prefixado";
    case "USD":
      return spread ? `Dólar + ${rateDigits(rate)} a.a.` : "Dólar";
    default:
      return spread ? `${rateDigits(rate)} a.a.` : null;
  }
}

/** Linha de apoio da posição: subtipo, instituição e taxa — só o que existe. */
export function positionSubtitle(position: InvestmentPosition): string {
  const parts: string[] = [];
  const subtype = investmentSubtypeLabel(position.subtype);
  if (subtype) parts.push(subtype);
  if (position.institution) parts.push(position.institution);
  const rate = formatRate(position.rate, position.indexer);
  if (rate) parts.push(rate);
  return parts.join(" · ");
}

/** A posição só tem valor em reais depois que a cotação do papel chegar. */
export function positionNeedsQuote(position: InvestmentPosition): boolean {
  return (
    position.source === "MANUAL" &&
    Boolean(position.currency) &&
    position.currency !== "BRL"
  );
}

/**
 * Valor atual EM REAIS.
 *
 * Tudo que veio do banco já chega em reais e é devolvido como está. A posição
 * manual em moeda estrangeira é a exceção: o servidor não sabe o preço dela,
 * então o app multiplica a quantidade pela cotação do papel (`priceBrl`, ou
 * `price` × dólar quando o servidor não converteu). Sem cotação o resultado é
 * `null` — e a tela diz "cotação indisponível", nunca R$ 0,00.
 */
export function positionCurrentValue(
  position: InvestmentPosition,
  quotes: Record<string, ForeignQuote | undefined> = {},
  usdBrl: number | null = null,
): number | null {
  if (!positionNeedsQuote(position)) {
    if (isFinite_(position.currentValue)) return position.currentValue;
    if (isFinite_(position.quantity) && isFinite_(position.unitPrice)) {
      return position.quantity * position.unitPrice;
    }
    return isFinite_(position.investedAmount) ? position.investedAmount : null;
  }

  const quote = position.code
    ? quotes[position.code.toUpperCase()]
    : undefined;
  if (quote && isFinite_(position.quantity)) {
    if (isFinite_(quote.priceBrl)) return position.quantity * quote.priceBrl;
    if (isFinite_(quote.price) && isFinite_(usdBrl)) {
      return position.quantity * quote.price * usdBrl;
    }
  }
  // Sem cotação do papel, sobra o valor na moeda de origem convertido pelo
  // dólar do dia — ainda é o dado do usuário, só que com câmbio de hoje
  if (isFinite_(position.currentValue) && isFinite_(usdBrl)) {
    return position.currentValue * usdBrl;
  }
  return null;
}

export interface Profit {
  value: number;
  /** Nulo quando não há base de custo: zero afirmaria "nada rendeu". */
  percent: number | null;
}

/** Resultado da posição; `null` quando falta o investido ou o valor atual. */
export function profitOf(
  investedAmount: number | null | undefined,
  currentValue: number | null | undefined,
): Profit | null {
  if (!isFinite_(investedAmount) || !isFinite_(currentValue)) return null;
  const value = currentValue - investedAmount;
  return {
    value,
    percent: investedAmount > 0 ? (value / investedAmount) * 100 : null,
  };
}

/** `formatBRL` que respeita o nulo: a tela decide o que dizer no lugar. */
export function formatBRLOrNull(value: number | null | undefined): string | null {
  return isFinite_(value) ? formatBRL(value) : null;
}

/** "+R$ 120,00 (+2,30%)" — valor e percentual com o mesmo sinal. */
export function formatProfit(profit: Profit): string {
  const sign = profit.value > 0 ? "+" : "";
  const percent =
    profit.percent === null
      ? ""
      : ` (${formatPercent(profit.percent, { signed: true })})`;
  return `${sign}${formatBRL(profit.value)}${percent}`;
}

// --- Agrupamento ---

export interface PositionGroup {
  type: InvestmentType;
  label: string;
  positions: InvestmentPosition[];
}

/**
 * Grupos na ordem fixa de `INVESTMENT_TYPE_ORDER`, sem grupo vazio; dentro do
 * grupo o maior valor primeiro (posição sem valor por último — ela ainda não
 * tem com o que competir).
 */
export function groupPositionsByType(
  positions: InvestmentPosition[],
): PositionGroup[] {
  const buckets = new Map<InvestmentType, InvestmentPosition[]>();
  positions.forEach((position) => {
    const type = normalizeInvestmentType(position.type);
    const bucket = buckets.get(type) ?? [];
    bucket.push(position);
    buckets.set(type, bucket);
  });

  const valueOf = (position: InvestmentPosition) =>
    isFinite_(position.currentValue) ? position.currentValue : -Infinity;

  return INVESTMENT_TYPE_ORDER.filter((type) => buckets.has(type)).map(
    (type) => ({
      type,
      label: TYPE_LABELS[type],
      positions: [...(buckets.get(type) ?? [])].sort(
        (a, b) => valueOf(b) - valueOf(a),
      ),
    }),
  );
}

// --- Indicadores acompanhados ---

/** Chave estável de um interesse, para `key` de lista e para o mapa de cotações. */
export function watchKey(watch: InvestmentInterest): string {
  return `${watch.kind}:${watch.code.toUpperCase()}`;
}

const RATE_LABELS: Record<string, string> = {
  CDI: "CDI hoje",
  SELIC: "Selic meta",
};

const INDEX_LABELS: Record<string, string> = {
  IPCA: "IPCA 12 meses",
  IPCA_12M: "IPCA 12 meses",
  IPCA_MES: "IPCA do mês",
  IGPM: "IGP-M 12 meses",
  POUPANCA: "Poupança",
};

const CURRENCY_LABELS: Record<string, string> = {
  USD: "Dólar",
  EUR: "Euro",
  GBP: "Libra",
};

// Os ETFs mais comuns de quem investe fora pelo Brasil. Ticker fora da lista
// aparece só pelo código — inventar um nome seria pior do que não ter
const TICKER_NAMES: Record<string, string> = {
  VT: "Vanguard Total World",
  VTI: "Vanguard Total Stock Market",
  VOO: "Vanguard S&P 500",
  VXUS: "Vanguard Total International",
  VEA: "Vanguard Developed Markets",
  VWO: "Vanguard Emerging Markets",
  BND: "Vanguard Total Bond",
  BNDW: "Vanguard Total World Bond",
  IVV: "iShares Core S&P 500",
  SPY: "SPDR S&P 500",
  QQQ: "Invesco Nasdaq-100",
  VNQ: "Vanguard Real Estate",
  SCHD: "Schwab US Dividend",
};

/** Nome curto do cartão: "CDI hoje", "Selic meta", "Dólar", "VT · Vanguard Total World". */
export function watchLabel(watch: InvestmentInterest): string {
  const code = watch.code.toUpperCase();
  switch (watch.kind) {
    case "RATE":
      return RATE_LABELS[code] ?? code;
    case "INDEX":
      return INDEX_LABELS[code] ?? code;
    case "CURRENCY":
      return CURRENCY_LABELS[code] ?? code;
    case "TICKER": {
      const name = TICKER_NAMES[code];
      return name ? `${code} · ${name}` : code;
    }
    default:
      return code;
  }
}

/**
 * Qual série de `/indicators/macro` alimenta o interesse. `null` para TICKER
 * (que vem de `/indicators/quote`) e para código que a API macro não cobre.
 */
export function macroCodeForWatch(
  watch: InvestmentInterest,
): MacroIndicatorCode | null {
  const code = watch.code.toUpperCase();
  switch (watch.kind) {
    case "RATE":
      return code === "CDI" || code === "SELIC" ? code : null;
    case "INDEX":
      if (code === "IPCA" || code === "IPCA_12M") return "IPCA_12M";
      if (code === "IPCA_MES") return "IPCA_MES";
      if (code === "IGPM") return "IGPM";
      if (code === "POUPANCA") return "POUPANCA";
      return null;
    case "CURRENCY":
      return code === "USD" ? "USD_PTAX" : null;
    default:
      return null;
  }
}

/** Valor do indicador macro no formato que a unidade pede. */
export function macroValueLabel(indicator: MacroIndicator): string {
  const unit = indicator.unit ?? "";
  if (unit.includes("%")) {
    const suffix = unit.includes("a.a") ? " a.a." : "";
    return `${formatPercent(indicator.value)}${suffix}`;
  }
  if (unit === "BRL") {
    // Câmbio tem quatro casas de verdade; o formato abre até elas sem forçar
    // "R$ 5,4000" quando o valor é redondo
    return formatBRL(indicator.value, { maximumFractionDigits: 4 });
  }
  return unit
    ? `${formatDecimal(indicator.value)} ${unit}`
    : formatDecimal(indicator.value);
}

/** Preço do papel na moeda dele: "US$ 118,32". */
export function quoteValueLabel(quote: ForeignQuote): string {
  const symbol = quote.currency === "USD" ? "US$" : quote.currency;
  return `${symbol} ${formatDecimal(quote.price)}`;
}

export interface WatchCardData {
  key: string;
  watch: InvestmentInterest;
  label: string;
  /** Nulo quando o indicador não chegou: a tela mostra "indisponível". */
  value: string | null;
  /** Segunda leitura: o papel em reais, o IPCA do mês ao lado do de 12 meses. */
  secondary: string | null;
  /** Variação percentual quando a fonte informa (cotações); nula nas taxas. */
  variation: number | null;
  /** "dado de ontem" quando a fonte não atualizou; nulo quando está em dia. */
  staleNote: string | null;
  /** Código que `explainIndicatorForUser` entende. */
  explainCode: string;
}

/**
 * Monta os cartões de "Seus indicadores" a partir do perfil e do que já chegou
 * de macro e cotações. Puro: a tela só desenha. Interesse sem dado vira
 * cartão com valor nulo — o usuário pediu para acompanhar, então ele aparece,
 * e aparece dizendo que o número não veio.
 */
export function buildWatchCards(
  profile: InvestmentProfile | null,
  macro: MacroIndicator[],
  quotes: Record<string, ForeignQuote | undefined>,
  now: number = Date.now(),
): WatchCardData[] {
  if (!profile) return [];
  const macroByCode = new Map(macro.map((item) => [item.code, item]));

  return profile.watch.map((watch) => {
    const key = watchKey(watch);
    const label = watchLabel(watch);
    const code = watch.code.toUpperCase();

    if (watch.kind === "TICKER") {
      const quote = quotes[code];
      return {
        key,
        watch,
        label,
        value: quote ? quoteValueLabel(quote) : null,
        secondary:
          quote && isFinite_(quote.priceBrl) ? formatBRL(quote.priceBrl) : null,
        variation:
          quote && isFinite_(quote.changePercent) ? quote.changePercent : null,
        staleNote: quote?.stale ? staleLabel(quote.date, now) : null,
        explainCode: code,
      };
    }

    const macroCode = macroCodeForWatch(watch);
    const indicator = macroCode ? macroByCode.get(macroCode) : undefined;
    // IPCA de 12 meses e do mês são a mesma pergunta em duas escalas: quem
    // acompanha um enxerga o outro na linha de baixo
    const companion =
      macroCode === "IPCA_12M" ? macroByCode.get("IPCA_MES") : undefined;
    return {
      key,
      watch,
      label,
      value: indicator ? macroValueLabel(indicator) : null,
      secondary: companion ? `${macroValueLabel(companion)} no mês` : null,
      variation: null,
      staleNote: indicator?.stale
        ? staleLabel(indicator.referenceDate, now)
        : null,
      explainCode: macroCode ?? code,
    };
  });
}

// --- Explicação personalizada ---

const hasIndexer = (profile: InvestmentProfile | null, indexer: string) =>
  Boolean(profile?.indexers.includes(indexer as InvestmentIndexer));

const tickersOf = (profile: InvestmentProfile | null) =>
  (profile?.watch ?? [])
    .filter((watch) => watch.kind === "TICKER")
    .map((watch) => watch.code.toUpperCase());

/**
 * POR QUE este indicador importa para ESTE usuário — uma frase.
 *
 * O mesmo CDI é uma coisa para quem tem CDB ("seu rendimento cai junto") e
 * outra para quem não tem nada atrelado a ele (uma régua de mercado). A
 * frase muda com o perfil; o glossário genérico só entra quando o perfil não
 * diz nada sobre aquele indicador.
 */
export function explainIndicatorForUser(
  code: string,
  profile: InvestmentProfile | null,
): string {
  const upper = code.toUpperCase();
  const tickers = tickersOf(profile);

  switch (upper) {
    case "CDI":
      return hasIndexer(profile, "CDI")
        ? "Seu CDB rende um percentual do CDI: quando ele cai, seu rendimento cai junto."
        : "O CDI anda colado na Selic e é a régua da renda fixa privada — CDB, LCI e fundo DI rendem em cima dele.";
    case "SELIC":
      if (hasIndexer(profile, "SELIC")) {
        return "O Tesouro Selic acompanha a Selic: cada decisão do Copom muda quanto ele rende daqui para frente.";
      }
      if (hasIndexer(profile, "CDI")) {
        return "O CDI segue a Selic quase um a um: a decisão do Copom chega ao rendimento do seu CDB no dia seguinte.";
      }
      return "A Selic é a taxa básica da economia: puxa o CDI, o Tesouro Selic e o custo do crédito.";
    case "IPCA":
    case "IPCA_12M":
    case "IPCA_MES":
      return hasIndexer(profile, "IPCA")
        ? "Seu título IPCA+ paga a inflação mais uma taxa fixa: o IPCA alto engorda o rendimento nominal, mas é a taxa fixa que diz o ganho real."
        : "A inflação é o que seu dinheiro precisa vencer: rendimento abaixo do IPCA é perda de poder de compra.";
    case "USD":
    case "USD_PTAX":
      if (tickers.length === 1) {
        return `A ${tickers[0]} é cotada em dólar: a variação do câmbio entra no seu resultado em reais.`;
      }
      if (tickers.length > 1) {
        return "Seus ETFs no exterior são cotados em dólar: a variação do câmbio entra no seu resultado em reais.";
      }
      if (hasIndexer(profile, "USD")) {
        return "Parte da sua carteira está em dólar: a variação do câmbio entra no seu resultado em reais.";
      }
      return "O dólar mexe com a inflação, com os importados e com o preço de tudo que é cotado lá fora.";
    case "IGPM":
      return "O IGP-M reajusta aluguéis e contratos: sobe com o câmbio e pesa no seu orçamento antes de aparecer na inflação oficial.";
    case "POUPANCA":
      return hasIndexer(profile, "CDI")
        ? "A poupança rende 70% da Selic quando ela passa de 8,5% a.a.: compare com o percentual do CDI do seu CDB."
        : "A poupança é a comparação de base: qualquer renda fixa precisa render mais do que ela para valer a pena.";
    default: {
      const name = TICKER_NAMES[upper];
      if (name) {
        return `${upper} (${name}) é cotado em dólar: o preço do ETF e o câmbio somam no seu resultado em reais.`;
      }
      return `${upper} é cotado em dólar: preço e câmbio somam no seu resultado em reais.`;
    }
  }
}

// --- Tesouro Direto ---

const TREASURY_INDEXERS: readonly InvestmentIndexer[] = [
  "SELIC",
  "IPCA",
  "PREFIXADO",
];

/** O perfil tem algum indexador que o Tesouro oferece? Decide se o bloco aparece. */
export function hasTreasuryInterest(profile: InvestmentProfile | null): boolean {
  return TREASURY_INDEXERS.some((indexer) => hasIndexer(profile, indexer));
}

/**
 * Só os títulos nos indexadores do perfil: quem tem Tesouro Selic e CDB não
 * precisa ver seis vencimentos de prefixado. Sem indexador do Tesouro no
 * perfil, devolve vazio — a tela oferece "ver todos" para quem quiser.
 */
export function treasuryRelevantTo(
  profile: InvestmentProfile | null,
  bonds: TreasuryBond[],
): TreasuryBond[] {
  if (!profile) return [];
  const wanted = new Set(
    profile.indexers.filter((indexer) => TREASURY_INDEXERS.includes(indexer)),
  );
  if (wanted.size === 0) return [];
  return bonds.filter((bond) => wanted.has(bond.indexer as InvestmentIndexer));
}

/** "Selic + 0,10%", "IPCA + 6,20%", "12,50% a.a." — a taxa de compra na gramática do título. */
export function treasuryRateLabel(bond: TreasuryBond): string | null {
  if (!isFinite_(bond.annualRateBuy)) return null;
  return formatRate(bond.annualRateBuy, bond.indexer) ?? null;
}

// --- Datas ---

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "15/03/2027" — data curta com ano, para vencimentos. */
export function formatShortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const parsed = parseIsoDate(iso);
  if (!parsed) return null;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(parsed.day)}/${pad(parsed.month)}/${parsed.year}`;
}

/** "vence 15/03/2027"; `null` sem vencimento (ação, fundo aberto). */
export function maturityLabel(iso: string | null | undefined): string | null {
  const date = formatShortDate(iso);
  return date ? `vence ${date}` : null;
}

/**
 * "agora", "há 5 min", "há 2 h", "há 3 dias" ou a data curta. Para o
 * "atualizado há …" do resumo; `null` sem data.
 */
export function formatRelativeTime(
  iso: string | null | undefined,
  now: number = Date.now(),
): string | null {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return null;
  const diff = Math.max(0, now - time);
  if (diff < MINUTE) return "agora";
  if (diff < HOUR) return `há ${Math.floor(diff / MINUTE)} min`;
  if (diff < DAY) return `há ${Math.floor(diff / HOUR)} h`;
  if (diff < 7 * DAY) {
    const days = Math.floor(diff / DAY);
    return `há ${days} ${days === 1 ? "dia" : "dias"}`;
  }
  return formatShortDate(iso) ?? null;
}

/**
 * De que dia é o número quando a fonte não atualizou: "dado de ontem" é o
 * caso comum (o provedor publica em D+1); mais velho que isso, a data.
 */
export function staleLabel(
  referenceIso: string | null | undefined,
  now: number = Date.now(),
): string {
  const parsed = referenceIso ? parseIsoDate(referenceIso) : null;
  if (!parsed) return "dado antigo";
  const today = new Date(now);
  const todayIso = isoDate(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate(),
  );
  const reference = isoDate(parsed.year, parsed.month, parsed.day);
  const daysAgo = Math.round(
    (Date.parse(`${todayIso}T12:00:00Z`) -
      Date.parse(`${reference}T12:00:00Z`)) /
      DAY,
  );
  if (daysAgo <= 0) return "dado de hoje, sem atualização";
  if (daysAgo === 1) return "dado de ontem";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `dado de ${pad(parsed.day)}/${pad(parsed.month)}`;
}

// --- Formulário da posição manual ---

export interface PositionFormValues {
  name: string;
  type: InvestmentType;
  subtype: string;
  code: string;
  institution: string;
  indexer: InvestmentIndexer;
  rate: string;
  currency: string;
  quantity: string;
  unitPrice: string;
  investedAmount: string;
  currentValue: string;
  maturityDate: string;
}

export type PositionFormErrors = Partial<Record<keyof PositionFormValues, string>>;

export const EMPTY_POSITION_FORM: PositionFormValues = {
  name: "",
  type: "FIXED_INCOME",
  subtype: "",
  code: "",
  institution: "",
  indexer: "CDI",
  rate: "",
  currency: "BRL",
  quantity: "",
  unitPrice: "",
  investedAmount: "",
  currentValue: "",
  maturityDate: "",
};

/** Mercado padrão para ticker no exterior — o único que a cotação cobre hoje. */
export const DEFAULT_FOREIGN_MARKET = "US";

/** Tipos que se identificam por código negociável: sem ele a posição não tem cotação. */
export const TICKER_TYPES: readonly InvestmentType[] = ["EQUITY", "ETF", "CRYPTO"];

/** Indexador que faz sentido oferecer para cada tipo (o resto vira NONE). */
export function indexersForType(type: InvestmentType): InvestmentIndexer[] {
  switch (type) {
    case "FIXED_INCOME":
      return ["CDI", "IPCA", "PREFIXADO", "SELIC"];
    case "TREASURY":
      return ["SELIC", "IPCA", "PREFIXADO"];
    case "FUND":
    case "PENSION":
      return ["CDI", "IPCA", "NONE"];
    case "ETF":
    case "EQUITY":
      return ["NONE", "USD"];
    default:
      return ["NONE"];
  }
}

/** ETF/ação com moeda estrangeira: é o caso em que a cotação precisa de mercado. */
export function isForeignTickerForm(values: PositionFormValues): boolean {
  return (
    TICKER_TYPES.includes(values.type) &&
    values.currency.trim().toUpperCase() !== "BRL" &&
    values.currency.trim() !== ""
  );
}

/**
 * "1.234,56" → 1234.56; "1234.56" → 1234.56; vazio → null; lixo → NaN.
 * Aceita as duas grafias porque o teclado numérico do iOS em pt-BR manda
 * vírgula e o do navegador manda ponto.
 */
export function parseDecimalInput(text: string): number | null {
  const raw = text.replace(/\s/g, "").trim();
  if (!raw) return null;
  const normalized =
    raw.includes(",") && raw.includes(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : Number.NaN;
}

/** "15/03/2027" ou "2027-03-15" → "2027-03-15"; inválida → null. */
export function parseDateInput(text: string): string | null {
  const raw = text.trim();
  if (!raw) return null;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  const iso = br ? `${br[3]}-${br[2]}-${br[1]}` : raw;
  const parsed = parseIsoDate(iso);
  if (!parsed) return null;
  // 31/02 passa pela regex e cai aqui: o calendário é quem decide
  const probe = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  if (probe.getUTCMonth() !== parsed.month - 1) return null;
  return isoDate(parsed.year, parsed.month, parsed.day);
}

export function positionToFormValues(
  position: InvestmentPosition | null,
): PositionFormValues {
  if (!position) return { ...EMPTY_POSITION_FORM };
  const text = (value: number | null) =>
    isFinite_(value) ? String(value).replace(".", ",") : "";
  return {
    name: position.name ?? "",
    type: normalizeInvestmentType(position.type),
    subtype: position.subtype ?? "",
    code: position.code ?? "",
    institution: position.institution ?? "",
    indexer: position.indexer ?? "NONE",
    rate: text(position.rate),
    currency: position.currency ?? "BRL",
    quantity: text(position.quantity),
    unitPrice: text(position.unitPrice),
    investedAmount: text(position.investedAmount),
    currentValue: text(position.currentValue),
    maturityDate: formatShortDate(position.maturityDate) ?? "",
  };
}

export type PositionValidation =
  | { ok: true; payload: InvestmentPositionPayload }
  | { ok: false; errors: PositionFormErrors };

/**
 * Valida o formulário e monta o corpo do cadastro. Regras:
 * nome obrigatório; código obrigatório (e em maiúsculas) para ação, ETF e
 * cripto; números positivos; e pelo menos UMA medida de quanto foi investido —
 * o valor em reais, ou quantidade com preço unitário.
 */
export function validatePositionForm(
  values: PositionFormValues,
): PositionValidation {
  const errors: PositionFormErrors = {};

  const name = values.name.trim();
  if (name.length < 2) errors.name = "Dê um nome à posição.";

  const code = values.code.trim().toUpperCase();
  if (TICKER_TYPES.includes(values.type) && !code) {
    errors.code = "Informe o código do ativo (ex.: VT, PETR4).";
  }

  const numberField = (
    field: "quantity" | "unitPrice" | "investedAmount" | "currentValue" | "rate",
    allowZero: boolean,
  ): number | null => {
    const parsed = parseDecimalInput(values[field]);
    if (parsed === null) return null;
    if (Number.isNaN(parsed) || parsed < 0 || (!allowZero && parsed === 0)) {
      errors[field] = allowZero
        ? "Use um número maior ou igual a zero."
        : "Use um número maior que zero.";
      return null;
    }
    return parsed;
  };

  const quantity = numberField("quantity", false);
  const unitPrice = numberField("unitPrice", false);
  const investedAmount = numberField("investedAmount", false);
  const currentValue = numberField("currentValue", true);
  const rate = numberField("rate", true);

  const hasQuantityPrice = quantity !== null && unitPrice !== null;
  if (
    investedAmount === null &&
    !hasQuantityPrice &&
    !errors.investedAmount &&
    !errors.quantity &&
    !errors.unitPrice
  ) {
    errors.investedAmount =
      "Informe o valor investido, ou a quantidade e o preço unitário.";
  }

  const maturityText = values.maturityDate.trim();
  const maturityDate = maturityText ? parseDateInput(maturityText) : null;
  if (maturityText && !maturityDate) {
    errors.maturityDate = "Use o formato dia/mês/ano (ex.: 15/03/2027).";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const currency = values.currency.trim().toUpperCase() || "BRL";
  const indexer = values.indexer === "NONE" ? null : values.indexer;
  const payload: InvestmentPositionPayload = {
    name,
    type: values.type,
    subtype: values.subtype.trim() || null,
    code: code || null,
    institution: values.institution.trim() || null,
    indexer,
    rate: indexer ? rate : null,
    currency,
    quantity,
    unitPrice,
    // Quantidade × preço só substitui o investido em reais quando a moeda é
    // real: em dólar a conta daria dólares no campo que promete reais
    investedAmount:
      investedAmount ??
      (hasQuantityPrice && currency === "BRL" ? quantity * unitPrice : null),
    currentValue,
    maturityDate,
  };
  return { ok: true, payload };
}

/** Interesse a acompanhar sugerido pela posição: o ticker no exterior. */
export function interestSuggestedBy(
  payload: InvestmentPositionPayload,
): InvestmentInterest | null {
  if (!payload.code) return null;
  if (!TICKER_TYPES.includes(payload.type)) return null;
  if ((payload.currency ?? "BRL") === "BRL") return null;
  return { kind: "TICKER", code: payload.code, market: DEFAULT_FOREIGN_MARKET };
}

// --- Seletor de interesse ---

export interface InterestOption {
  kind: InvestmentInterestKind;
  code: string;
  label: string;
  /** Subtítulo do seletor: o que o número diz. */
  hint: string;
}

/** Opções prontas do "+ acompanhar". Ticker é livre e entra pelo campo de texto. */
export const INTEREST_OPTIONS: readonly InterestOption[] = [
  { kind: "RATE", code: "CDI", label: "CDI", hint: "Taxa que remunera CDB, LCI e fundo DI" },
  { kind: "RATE", code: "SELIC", label: "Selic", hint: "Taxa básica; base do Tesouro Selic" },
  { kind: "INDEX", code: "IPCA", label: "IPCA", hint: "Inflação oficial; base do Tesouro IPCA+" },
  { kind: "INDEX", code: "IGPM", label: "IGP-M", hint: "Reajuste de aluguel e contratos" },
  { kind: "INDEX", code: "POUPANCA", label: "Poupança", hint: "A comparação de base da renda fixa" },
  { kind: "CURRENCY", code: "USD", label: "Dólar", hint: "Câmbio PTAX; afeta ativos no exterior" },
  { kind: "CURRENCY", code: "EUR", label: "Euro", hint: "Câmbio do euro" },
];

/** Já está no perfil? Evita oferecer de novo o que o usuário acompanha. */
export function isWatching(
  profile: InvestmentProfile | null,
  interest: Pick<InvestmentInterest, "kind" | "code">,
): boolean {
  const key = `${interest.kind}:${interest.code.toUpperCase()}`;
  return Boolean(profile?.watch.some((watch) => watchKey(watch) === key));
}

/** Ticker digitado: maiúsculas, sem espaço; vazio ou inválido → null. */
export function normalizeTicker(text: string): string | null {
  const ticker = text.trim().toUpperCase().replace(/\s+/g, "");
  return /^[A-Z0-9.\-]{1,12}$/.test(ticker) ? ticker : null;
}
