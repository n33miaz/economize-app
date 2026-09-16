import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { render } from "@testing-library/react-native";

import Badge, { type BadgeVariant } from "../Badge";

describe("Badge", () => {
  it("mostra o texto e o anuncia como um nó só", () => {
    const tela = render(<Badge label="Revisar" />);

    expect(tela.getByText("Revisar")).toBeTruthy();
    // Sem o nó único o leitor de tela lê uma caixa e depois um texto solto
    // no meio da linha em que o selo mora
    expect(tela.getByLabelText("Revisar")).toBeTruthy();
  });

  it("fala outra coisa quando o texto curto não basta", () => {
    const tela = render(
      <Badge label="Revisar" accessibilityLabel="aguardando revisão" />,
    );

    expect(tela.getByText("Revisar")).toBeTruthy();
    expect(tela.getByLabelText("aguardando revisão")).toBeTruthy();
    expect(tela.queryByLabelText("Revisar")).toBeNull();
  });

  it.each<BadgeVariant>(["neutral", "warning", "success", "danger", "info"])(
    "a variante %s desenha o selo com o texto",
    (variant) => {
      const tela = render(<Badge label="Selo" variant={variant} />);
      expect(tela.getByText("Selo")).toBeTruthy();
    },
  );

  it("nenhuma variante veste o accent", () => {
    // O âmbar é a cor da AÇÃO; um selo diz estado. Pintá-lo de marca faria o
    // olho procurar um botão onde há uma informação — regra §4.4 do design
    // system, cobrada aqui no fonte para não voltar por uma variante nova
    const fonte = readFileSync(join(__dirname, "..", "Badge.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");

    expect(fonte).not.toMatch(/t\.accent\./);
  });
});
