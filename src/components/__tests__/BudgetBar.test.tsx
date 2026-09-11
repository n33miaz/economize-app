import React from "react";
import { render } from "@testing-library/react-native";

import BudgetBar from "../BudgetBar";
import { darkTheme } from "../../theme/colors";
import type { BudgetLine } from "../../services/api";

const linha = (patch: Partial<BudgetLine> = {}): BudgetLine => ({
  categoryId: "c1",
  categoryName: "Mercado",
  monthlyLimit: 800,
  windowLimit: 800,
  spent: 150,
  expectedSoFar: 160,
  overBy: 0,
  exceeded: false,
  abovePace: false,
  ...patch,
});

/**
 * EC-204 na tela.
 *
 * O que se prova aqui é a distinção que a barra existe para desenhar: 20% no
 * dia 3 e 20% no dia 28 contam histórias opostas.
 */
describe("Barra do teto", () => {
  const corDaBarra = (arvore: ReturnType<typeof render>) => {
    const json = JSON.stringify(arvore.toJSON());
    return {
      temPerigo: json.includes(darkTheme.semantic.danger),
      temAviso: json.includes(darkTheme.semantic.warning),
      temAccent: json.includes(darkTheme.accent.neon),
    };
  };

  it("dentro do teto e do ritmo: accent, sem recado", () => {
    const tela = render(<BudgetBar line={linha()} />);

    expect(corDaBarra(tela).temAccent).toBe(true);
    expect(tela.queryByText(/acima do ritmo/)).toBeNull();
    expect(tela.queryByText(/passou/)).toBeNull();
  });

  it("acima do ritmo: cor de atenção e o recado", () => {
    const tela = render(
      <BudgetBar line={linha({ spent: 400, expectedSoFar: 160, abovePace: true })} />,
    );

    expect(corDaBarra(tela).temAviso).toBe(true);
    expect(tela.getByText("acima do ritmo do período")).toBeTruthy();
  });

  it("estourou: cor de perigo e QUANTO passou", () => {
    const tela = render(
      <BudgetBar line={linha({ spent: 900, overBy: 100, exceeded: true })} />,
    );

    expect(corDaBarra(tela).temPerigo).toBe(true);
    expect(tela.getByText(/passou R\$\s?100/)).toBeTruthy();
  });

  it("quem ouve recebe gasto, teto e veredito na mesma frase", () => {
    const { getByLabelText } = render(
      <BudgetBar line={linha({ spent: 900, overBy: 100, exceeded: true })} />,
    );

    expect(getByLabelText(/Mercado: R\$\s?900,00 de R\$\s?800,00, passou/)).toBeTruthy();
  });

  it("dentro do teto, a frase falada diz isso", () => {
    const { getByLabelText } = render(<BudgetBar line={linha()} />);

    expect(getByLabelText(/dentro do teto/)).toBeTruthy();
  });

  it("categoria sem nome não vira espaço vazio", () => {
    const { getByText } = render(<BudgetBar line={linha({ categoryName: null })} />);

    expect(getByText("Sem categoria")).toBeTruthy();
  });

  it("teto zero não divide por zero nem quebra a barra", () => {
    const tela = render(<BudgetBar line={linha({ windowLimit: 0, expectedSoFar: 0 })} />);

    expect(tela.toJSON()).not.toBeNull();
  });
});
