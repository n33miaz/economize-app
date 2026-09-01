import React from "react";
import { render } from "@testing-library/react-native";

import CycleCaveats from "../CycleCaveats";
import type { CycleCaveat } from "../../services/api";

const ressalva = (over?: Partial<CycleCaveat>): CycleCaveat => ({
  kind: "LATE_INCOME",
  title: "Vale-refeição caiu no fim do ciclo",
  detail: "Entrou em 25/07, a 6 dias do fechamento.",
  amount: 800,
  ...over,
});

describe("CycleCaveats", () => {
  it("não renderiza nada quando o servidor não manda o campo", () => {
    // Servidor mais velho que o app: ausência é "nada a ressalvar", não erro
    const { toJSON } = render(<CycleCaveats caveats={undefined} />);
    expect(toJSON()).toBeNull();
  });

  it("não renderiza nada num mês limpo", () => {
    // Um bloco vazio dizendo "nenhuma ressalva" ocupa espaço para não informar
    const { toJSON } = render(<CycleCaveats caveats={[]} />);
    expect(toJSON()).toBeNull();
  });

  it("mostra título, explicação e valor da ressalva", () => {
    const { getByText } = render(<CycleCaveats caveats={[ressalva()]} />);
    expect(getByText("Vale-refeição caiu no fim do ciclo")).toBeTruthy();
    expect(getByText(/25\/07/)).toBeTruthy();
    expect(getByText("R$ 800,00")).toBeTruthy();
  });

  it("ressalva sem valor não inventa um número", () => {
    const { queryByText } = render(
      <CycleCaveats
        caveats={[
          ressalva({
            kind: "PARTIAL_PERIOD",
            title: "Este ciclo ainda não fechou",
            amount: null,
          }),
        ]}
      />,
    );
    expect(queryByText(/R\$/)).toBeNull();
  });

  it("monta os três tipos sem quebrar", () => {
    const tipos: CycleCaveat["kind"][] = [
      "LATE_INCOME",
      "PARTIAL_PERIOD",
      "NO_PREVIOUS_DATA",
    ];
    for (const kind of tipos) {
      expect(() =>
        render(<CycleCaveats caveats={[ressalva({ kind })]} />),
      ).not.toThrow();
    }
  });

  it("deixa claro que os valores continuam corretos", () => {
    // A ressalva qualifica a leitura; ela não desmente o número
    const { getByText } = render(<CycleCaveats caveats={[ressalva()]} />);
    expect(getByText(/valores acima continuam corretos/)).toBeTruthy();
  });
});
