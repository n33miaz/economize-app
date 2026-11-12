import React from "react";
import { Text } from "react-native";
import { render } from "@testing-library/react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import { useFooterClearance } from "../useFooterClearance";
import {
  ILHA_ALTURA,
  ILHA_RESPIRO,
  ilhaBottom,
  ilhaCoverage,
  TabBarHeightContext,
} from "../../routes/tabBarHeight";
import { spacing } from "../../theme/ds";

/**
 * A folga do rodapé das listas sai da MESMA conta que posiciona a ilha da
 * barra de abas.
 *
 * Eram duas contas. A ilha subia pelo inset real da área segura; o contexto
 * de altura só somava o inset no iOS e na web, e no Android valia zero. Num
 * Android de borda a borda com 24 px de inset a ilha cobria até 100 px e o
 * Extrato reservava 92: os últimos 8 px do último botão ficavam sob a barra.
 */
describe("folga do rodapé × ilha da barra de abas", () => {
  const metricas = (bottom: number): Metrics => ({
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 0, left: 0, right: 0, bottom },
  });

  function Sonda() {
    return <Text testID="folga">{String(useFooterClearance())}</Text>;
  }

  const folgaCom = (inset: number, alturaDaBarra: number | undefined) => {
    const { getByTestId } = render(
      <SafeAreaProvider initialMetrics={metricas(inset)}>
        <TabBarHeightContext.Provider value={alturaDaBarra}>
          <Sonda />
        </TabBarHeightContext.Provider>
      </SafeAreaProvider>,
    );
    return Number(getByTestId("folga").props.children);
  };

  it.each([0, 24, 34])("inset %i: a ilha cobre altura + respiro + inset, e a folga passa disso", (inset) => {
    // o topo da ilha, medido a partir da borda de baixo
    const topoDaIlha = ilhaBottom(inset) + ILHA_ALTURA;
    expect(ilhaCoverage(inset)).toBe(topoDaIlha);
    expect(ilhaCoverage(inset)).toBe(ILHA_ALTURA + ILHA_RESPIRO + inset);

    const folga = folgaCom(inset, ilhaCoverage(inset));
    expect(folga).toBe(topoDaIlha + spacing[4]);
    expect(folga).toBeGreaterThan(topoDaIlha);
  });

  it("inset ausente ou inválido conta como zero, nos dois lados", () => {
    for (const torto of [undefined, null, Number.NaN, -5] as unknown as number[]) {
      expect(ilhaBottom(torto)).toBe(ILHA_RESPIRO);
      expect(ilhaCoverage(torto)).toBe(ILHA_ALTURA + ILHA_RESPIRO);
    }
  });

  it("fora das abas (sem barra), a folga é a do botão do assistente", () => {
    expect(folgaCom(24, undefined)).toBeGreaterThan(24);
    expect(folgaCom(24, undefined)).toBeLessThan(ilhaCoverage(24) + spacing[4]);
  });
});
