import React from "react";
import { render } from "@testing-library/react-native";
import type { ReactTestInstance } from "react-test-renderer";

import FreshnessStamp from "../FreshnessStamp";
import { darkTheme } from "../../theme/colors";

const AGORA = Date.parse("2026-09-10T12:00:00Z");
const HORA = 60 * 60_000;

/**
 * A função tem teste próprio; o que se prova aqui é a outra metade — que a
 * idade vira **cor** na tela. Um saldo de ontem com a mesma cara de um saldo
 * de agora é o defeito inteiro, e quem bate o olho no número não lê a linha
 * de baixo.
 */
describe("Carimbo de frescor na tela", () => {
  const corDe = (elemento: ReactTestInstance): string | undefined => {
    const estilos = [elemento.props.style].flat(2) as ({ color?: string } | null)[];
    return estilos.find((estilo) => estilo?.color)?.color;
  };

  it("leitura recente sai discreta", () => {
    const { getByText } = render(
      <FreshnessStamp at={AGORA - 5 * 60_000} now={AGORA} prefix="atualizado" />,
    );

    expect(corDe(getByText("atualizado há 5 min"))).toBe(darkTheme.text.tertiary);
  });

  it("passado um dia, o carimbo muda de cor", () => {
    const { getByText } = render(
      <FreshnessStamp at={AGORA - 26 * HORA} now={AGORA} prefix="atualizado" />,
    );

    expect(corDe(getByText("atualizado há 1 dia"))).toBe(darkTheme.semantic.warning);
  });

  it("sem leitura, avisa em vez de fingir", () => {
    const { getByText } = render(<FreshnessStamp at={null} now={AGORA} />);

    const texto = getByText("sem leitura ainda");
    expect(corDe(texto)).toBe(darkTheme.semantic.warning);
  });

  it("quem ouve recebe a frase inteira", () => {
    const { getByLabelText } = render(
      <FreshnessStamp at={AGORA - 11 * HORA} now={AGORA} prefix="sincronizado" />,
    );

    expect(getByLabelText("Dado sincronizado há 11 h")).toBeTruthy();
  });
});
