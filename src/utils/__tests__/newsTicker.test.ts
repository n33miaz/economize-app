import {
  TICKER_LIMIT,
  TICKER_PAUSE_MS,
  TICKER_ROTATE_MS,
  buildTickerParams,
  createAutoAdvance,
  indexAfterRefresh,
  prepareTickerArticles,
  relativeTimeLabel,
  wrapIndex,
} from "../newsTicker";

describe("wrapIndex (rotação circular)", () => {
  it("mantém índices dentro do intervalo", () => {
    expect(wrapIndex(0, 5)).toBe(0);
    expect(wrapIndex(4, 5)).toBe(4);
    expect(wrapIndex(5, 5)).toBe(0);
    expect(wrapIndex(7, 5)).toBe(2);
  });

  it("volta para o fim ao recuar antes do início", () => {
    expect(wrapIndex(-1, 5)).toBe(4);
    expect(wrapIndex(-6, 5)).toBe(4);
  });

  it("não explode com lista vazia", () => {
    expect(wrapIndex(3, 0)).toBe(0);
  });
});

describe("buildTickerParams (filtro de preferências)", () => {
  it("sem filtro manda só o limite", () => {
    expect(buildTickerParams("all", "all")).toEqual({ limit: TICKER_LIMIT });
  });

  it("região e categoria entram apenas quando restringem", () => {
    expect(buildTickerParams("br", "all")).toEqual({
      limit: TICKER_LIMIT,
      region: "br",
    });
    expect(buildTickerParams("all", "cripto")).toEqual({
      limit: TICKER_LIMIT,
      category: "cripto",
    });
    expect(buildTickerParams("global", "economia")).toEqual({
      limit: TICKER_LIMIT,
      region: "global",
      category: "economia",
    });
  });
});

describe("prepareTickerArticles", () => {
  const article = (url: string, title = "Manchete") => ({ url, title });

  it("remove itens sem link ou manchete e URLs repetidas", () => {
    const input = [
      article("https://a"),
      { url: "", title: "sem link" },
      { url: "https://b", title: "" },
      article("https://a", "repetida"),
      article("https://c"),
    ];
    expect(prepareTickerArticles(input).map((a) => a.url)).toEqual([
      "https://a",
      "https://c",
    ]);
  });

  it("corta no limite mesmo quando o servidor ignora limit=", () => {
    const input = Array.from({ length: 40 }, (_, i) =>
      article(`https://noticia/${i}`),
    );
    expect(prepareTickerArticles(input)).toHaveLength(TICKER_LIMIT);
  });

  it("tolera resposta nula", () => {
    expect(prepareTickerArticles(null)).toEqual([]);
    expect(prepareTickerArticles(undefined)).toEqual([]);
  });
});

describe("indexAfterRefresh (renovação sem salto)", () => {
  const list = [
    { url: "https://a", title: "A" },
    { url: "https://b", title: "B" },
    { url: "https://c", title: "C" },
  ];

  it("segue a notícia em tela quando ela continua na lista", () => {
    expect(indexAfterRefresh(list, "https://c", 1)).toBe(2);
  });

  it("reaproveita o índice antigo quando a notícia saiu", () => {
    expect(indexAfterRefresh(list, "https://sumiu", 1)).toBe(1);
  });

  it("aplica módulo quando a lista encolheu", () => {
    expect(indexAfterRefresh(list, "https://sumiu", 7)).toBe(1);
  });

  it("lista vazia sempre cai no zero", () => {
    expect(indexAfterRefresh([], "https://a", 4)).toBe(0);
  });
});

describe("relativeTimeLabel", () => {
  const now = Date.parse("2026-08-15T12:00:00Z");

  it("gradua de agora até dias", () => {
    expect(relativeTimeLabel("2026-08-15T11:59:40Z", now)).toBe("agora");
    expect(relativeTimeLabel("2026-08-15T11:35:00Z", now)).toBe("há 25 min");
    expect(relativeTimeLabel("2026-08-15T09:00:00Z", now)).toBe("há 3 h");
    expect(relativeTimeLabel("2026-08-14T10:00:00Z", now)).toBe("há 1 dia");
    expect(relativeTimeLabel("2026-08-12T10:00:00Z", now)).toBe("há 3 dias");
  });

  it("mais de uma semana vira data absoluta", () => {
    expect(relativeTimeLabel("2026-08-01T10:00:00Z", now)).toContain("01");
  });

  it("data inválida devolve vazio", () => {
    expect(relativeTimeLabel("nada", now)).toBe("");
  });
});

describe("createAutoAdvance (pausa por interação)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Nenhum timer pode sobreviver ao teste
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("avança na cadência e segue reagendando", () => {
    const onAdvance = jest.fn();
    const pilot = createAutoAdvance(onAdvance, {
      rotateMs: TICKER_ROTATE_MS,
      pauseMs: TICKER_PAUSE_MS,
    });

    pilot.start();
    jest.advanceTimersByTime(TICKER_ROTATE_MS - 1);
    expect(onAdvance).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onAdvance).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(TICKER_ROTATE_MS * 2);
    expect(onAdvance).toHaveBeenCalledTimes(3);

    pilot.stop();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("interação manual adia o próximo avanço para a janela de pausa", () => {
    const onAdvance = jest.fn();
    const pilot = createAutoAdvance(onAdvance, {
      rotateMs: TICKER_ROTATE_MS,
      pauseMs: TICKER_PAUSE_MS,
    });

    pilot.start();
    jest.advanceTimersByTime(TICKER_ROTATE_MS / 2);
    pilot.pause();

    // O tick que estava agendado morre junto com a pausa
    jest.advanceTimersByTime(TICKER_ROTATE_MS);
    expect(onAdvance).not.toHaveBeenCalled();

    // Passada a janela de pausa, a cadência normal volta
    jest.advanceTimersByTime(TICKER_PAUSE_MS - TICKER_ROTATE_MS);
    expect(onAdvance).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(TICKER_ROTATE_MS);
    expect(onAdvance).toHaveBeenCalledTimes(2);

    pilot.stop();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("pausas seguidas se acumulam a partir da última interação", () => {
    const onAdvance = jest.fn();
    const pilot = createAutoAdvance(onAdvance, {
      rotateMs: TICKER_ROTATE_MS,
      pauseMs: TICKER_PAUSE_MS,
    });

    pilot.start();
    pilot.pause();
    jest.advanceTimersByTime(TICKER_PAUSE_MS - 1);
    pilot.pause();
    jest.advanceTimersByTime(TICKER_PAUSE_MS - 1);
    expect(onAdvance).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onAdvance).toHaveBeenCalledTimes(1);

    pilot.stop();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("stop antes do primeiro tick não dispara nada", () => {
    const onAdvance = jest.fn();
    const pilot = createAutoAdvance(onAdvance, {
      rotateMs: TICKER_ROTATE_MS,
      pauseMs: TICKER_PAUSE_MS,
    });

    pilot.start();
    pilot.stop();
    jest.advanceTimersByTime(TICKER_PAUSE_MS * 3);
    expect(onAdvance).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("pause antes de start é inerte (leitor de tela: piloto nunca ligou)", () => {
    const onAdvance = jest.fn();
    const pilot = createAutoAdvance(onAdvance, {
      rotateMs: TICKER_ROTATE_MS,
      pauseMs: TICKER_PAUSE_MS,
    });

    pilot.pause();
    jest.advanceTimersByTime(TICKER_PAUSE_MS * 3);
    expect(onAdvance).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("pause depois de stop não ressuscita o piloto (release após blur)", () => {
    const onAdvance = jest.fn();
    const pilot = createAutoAdvance(onAdvance, {
      rotateMs: TICKER_ROTATE_MS,
      pauseMs: TICKER_PAUSE_MS,
    });

    pilot.start();
    pilot.stop();
    // O release do gesto chega depois do cleanup do componente
    pilot.pause();
    jest.advanceTimersByTime(TICKER_PAUSE_MS * 3);
    expect(onAdvance).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("start depois de stop volta a valer (refoco da tela)", () => {
    const onAdvance = jest.fn();
    const pilot = createAutoAdvance(onAdvance, {
      rotateMs: TICKER_ROTATE_MS,
      pauseMs: TICKER_PAUSE_MS,
    });

    pilot.start();
    pilot.stop();
    pilot.start();
    jest.advanceTimersByTime(TICKER_ROTATE_MS);
    expect(onAdvance).toHaveBeenCalledTimes(1);

    pilot.stop();
    expect(jest.getTimerCount()).toBe(0);
  });
});
