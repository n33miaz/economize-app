import {
  RAIL_DESTINATIONS,
  RAIL_GROUPS,
  railKeyForRoute,
} from "../railDestinations";
import {
  APP_ROUTES,
  FINANCE_TAB_ROUTES,
  LEAF_ROUTE_NAMES,
  MAIN_TAB_ROUTES,
  MARKET_TAB_ROUTES,
} from "../routeNames";

// As três abas da barra inferior, pela fonte única — e não mais por uma cópia
// escrita à mão, que era o que deixava um `name` renomeado no navegador
// passar por todas as suítes sem uma falha sequer
const ABAS_DA_BARRA = Object.values(MAIN_TAB_ROUTES);

describe("mapa de destinos do trilho", () => {
  it("não repete chave nem rota", () => {
    const chaves = RAIL_DESTINATIONS.map((d) => d.key);
    const rotas = RAIL_DESTINATIONS.map((d) => d.route);
    expect(new Set(chaves).size).toBe(chaves.length);
    expect(new Set(rotas).size).toBe(rotas.length);
  });

  it("só aponta para rotas que o navegador declara", () => {
    // O `route` é tipado como `LeafRouteName`, então um destino inventado já
    // não compila; aqui a mesma regra fica visível em runtime
    RAIL_DESTINATIONS.forEach((destino) => {
      expect(LEAF_ROUTE_NAMES).toContain(destino.route);
    });
  });

  it("leva TODOS os destinos, não só o trio da barra", () => {
    // O ponto do EC-108: no celular Análise/Relatórios/Previsão/Categorias só
    // eram alcançáveis por botão escondido dentro de outra tela
    const rotas = RAIL_DESTINATIONS.map((d) => d.route);
    [
      APP_ROUTES.analise,
      APP_ROUTES.relatorios,
      APP_ROUTES.previsao,
      APP_ROUTES.categorias,
      APP_ROUTES.noticias,
      APP_ROUTES.assistente,
      APP_ROUTES.perfil,
      // EC-150: a casa é destino do trilho — no celular só o Perfil leva lá
      APP_ROUTES.familia,
      APP_ROUTES.avancado,
      APP_ROUTES.sobre,
    ].forEach((rota) => expect(rotas).toContain(rota));
  });

  it("marca como aninhado exatamente o trio da barra inferior", () => {
    const aninhados = RAIL_DESTINATIONS.filter((d) => d.inMainTabs).map(
      (d) => d.route,
    );
    expect(aninhados.sort()).toEqual([...ABAS_DA_BARRA].sort());
  });

  it("reserva o ícone com preenchimento animado ao mesmo trio", () => {
    // Fora dele o `fill` do lucide vira silhueta — o "i" do Info sumia
    const primarios = RAIL_DESTINATIONS.filter((d) => d.primary).map(
      (d) => d.route,
    );
    expect(primarios.sort()).toEqual([...ABAS_DA_BARRA].sort());
  });

  it("dá título a todo grupo menos o primeiro, que é a navegação-base", () => {
    expect(RAIL_GROUPS[0].title).toBeUndefined();
    RAIL_GROUPS.slice(1).forEach((grupo) => {
      expect(grupo.title).toBeTruthy();
      expect(grupo.items.length).toBeGreaterThan(0);
    });
  });
});

describe("cobertura: nenhuma tela fica fora do mapa", () => {
  // Este é o teste que faltava. Antes, adicionar uma tela nova (ou renomear
  // uma existente) deixava o trilho apagado nela e as 24 suítes verdes: nada
  // comparava o mapa com a lista real de rotas do navegador.
  it("toda rota-folha declarada tem uma decisão de trilho", () => {
    LEAF_ROUTE_NAMES.forEach((rota) => {
      // Ou acende um destino, ou é tela de tarefa e herda o de origem —
      // as duas respostas são válidas; o que não pode é não haver resposta
      const comOrigem = railKeyForRoute(rota, "home");
      expect(comOrigem).toBeDefined();
    });
  });
});

describe("railKeyForRoute — qual item acende", () => {
  it("acende o próprio destino quando a rota é o destino", () => {
    RAIL_DESTINATIONS.forEach((destino) => {
      expect(railKeyForRoute(destino.route)).toBe(destino.key);
    });
  });

  it("acende Finanças nas abas internas dela", () => {
    expect(railKeyForRoute(FINANCE_TAB_ROUTES.carteira)).toBe("financas");
    expect(railKeyForRoute(FINANCE_TAB_ROUTES.extrato)).toBe("financas");
    expect(railKeyForRoute(FINANCE_TAB_ROUTES.recorrencias)).toBe("financas");
  });

  it("acende Mercado nas abas internas dele", () => {
    expect(railKeyForRoute(MARKET_TAB_ROUTES.moedas)).toBe("mercado");
    expect(railKeyForRoute(MARKET_TAB_ROUTES.indices)).toBe("mercado");
  });

  it("tela de tarefa preserva o destino de ONDE o usuário veio", () => {
    // "Revisão" abre de três lugares diferentes. Fixá-la em "Finanças" fazia
    // o trilho pular para lá quando o usuário clicou no card da Home, e
    // pílula parada no lugar errado engana mais do que pílula apagada
    expect(railKeyForRoute(APP_ROUTES.revisao, "home")).toBe("home");
    expect(railKeyForRoute(APP_ROUTES.revisao, "analise")).toBe("analise");
    expect(railKeyForRoute(APP_ROUTES.revisao, "financas")).toBe("financas");
    expect(railKeyForRoute(APP_ROUTES.agendamento, "financas")).toBe(
      "financas",
    );
    expect(railKeyForRoute(APP_ROUTES.alterarSenha, "perfil")).toBe("perfil");
  });

  it("sai de uma tarefa e volta a mandar quem a rota diz", () => {
    // A herança não pode grudar: ao sair da Revisão para Relatórios, o
    // destino real assume de novo
    const naTarefa = railKeyForRoute(APP_ROUTES.revisao, "home");
    expect(railKeyForRoute(APP_ROUTES.relatorios, naTarefa)).toBe("relatorios");
  });

  it("tarefa sem origem conhecida não acende nada", () => {
    // Link direto para a tarefa ou cold start: não dá para saber de onde
    // veio, e chutar um destino seria inventar
    expect(railKeyForRoute(APP_ROUTES.revisao)).toBeUndefined();
    expect(railKeyForRoute(APP_ROUTES.agendamento, undefined)).toBeUndefined();
  });

  it("devolve indefinido para rota desconhecida e para rota nenhuma", () => {
    expect(railKeyForRoute("Login")).toBeUndefined();
    expect(railKeyForRoute("Login", "home")).toBeUndefined();
    expect(railKeyForRoute(undefined)).toBeUndefined();
  });
});
