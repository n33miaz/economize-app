import React from "react";
import { render } from "@testing-library/react-native";

import PotIcon, { potStateFor } from "../PotIcon";

describe("potStateFor — o pote conta o mês", () => {
  it("sem entradas ainda mostra meia altura em tom de marca", () => {
    // Vermelho no primeiro acesso acusaria o usuário de um resultado que
    // ninguém mediu — "não sei" não pode parecer "você foi mal"
    const s = potStateFor(0, 0);
    expect(s.tone).toBe("brand");
    expect(s.level).toBe(0.5);
  });

  it("sobra negativa esvazia o pote e pinta de vermelho", () => {
    const s = potStateFor(-120, 5000);
    expect(s.level).toBe(0);
    expect(s.tone).toBe("danger");
  });

  it("guardar 30% ou mais é meta batida", () => {
    expect(potStateFor(1500, 5000)).toMatchObject({ level: 1, tone: "success" });
    expect(potStateFor(5000, 5000).tone).toBe("success");
  });

  it("as faixas do meio sobem de degrau em degrau", () => {
    expect(potStateFor(100, 5000).level).toBe(0.25); // 2%  — apertado
    expect(potStateFor(400, 5000).level).toBe(0.5); // 8%  — no caminho
    expect(potStateFor(1000, 5000).level).toBe(0.75); // 20% — sobrou bem
  });

  it("proporção, e não valor absoluto: quem ganha mais precisa guardar mais", () => {
    // R$ 900 sobrando é ótimo com renda de 3 mil e apertado com renda de 30 mil
    expect(potStateFor(900, 3000).tone).toBe("success");
    expect(potStateFor(900, 30000).level).toBe(0.25);
  });

  it("sobra zerada não é vermelho — é o degrau mais baixo", () => {
    // Fechar no zero é apertado, não negativo. A diferença importa para quem
    // está tentando não entrar no vermelho
    const s = potStateFor(0, 5000);
    expect(s.tone).toBe("brand");
    expect(s.level).toBe(0.25);
  });
});

describe("PotIcon", () => {
  it("monta em todos os níveis sem estourar", () => {
    // O conteúdo muda de quantidade conforme o nível; um índice errado numa
    // das faixas só apareceria montando de verdade
    for (const level of [0, 0.1, 0.3, 0.5, 0.7, 0.85, 0.95, 1]) {
      expect(() => render(<PotIcon level={level} />)).not.toThrow();
    }
  });

  it("aceita nível fora da faixa sem quebrar", () => {
    expect(() => render(<PotIcon level={-3} />)).not.toThrow();
    expect(() => render(<PotIcon level={9} />)).not.toThrow();
  });
});
