import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import CycleAnchorSheet from "../CycleAnchorSheet";
import { usePreferencesStore } from "../../store/preferencesStore";
import { useRecurrenceStore } from "../../store/recurrenceStore";

jest.mock("../../store/analyticsStore", () => ({
  useAnalyticsStore: Object.assign(jest.fn(), { getState: () => ({}) }),
  reloadAnalyticsForAnchorChange: jest.fn(),
}));

const { reloadAnalyticsForAnchorChange } = jest.requireMock(
  "../../store/analyticsStore",
) as { reloadAnalyticsForAnchorChange: jest.Mock };

/**
 * A escolha da âncora do ciclo (EC-092).
 *
 * <p>O mês financeiro de quem recebe no dia 5 não é o mês do calendário. Duas
 * regras nascem daí e são o que este teste trava: fechar sem aplicar não pode
 * deixar rascunho pendurado, e aplicar precisa RECARREGAR as consolidações —
 * senão a tela fica com o rótulo novo sobre os números velhos.
 */
const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** O sheet vive dentro do CustomModal, que lê os insets da área segura. */
const montar = (props: { visible: boolean; onClose: () => void }) =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <CycleAnchorSheet {...props} />
    </SafeAreaProvider>,
  );

describe("CycleAnchorSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePreferencesStore.setState({ cycleAnchorDay: 1 });
    useRecurrenceStore.setState({ series: [], fetchSeries: jest.fn() } as never);
  });

  it("fechada, não desenha o conteúdo", () => {
    const { queryByLabelText } = montar({ visible: false, onClose: jest.fn() });

    expect(queryByLabelText("Fechar")).toBeNull();
  });

  it("aberta, mostra a escolha atual como rascunho", () => {
    usePreferencesStore.setState({ cycleAnchorDay: 5 });

    const { getByLabelText } = montar({ visible: true, onClose: jest.fn() });

    expect(getByLabelText("Usar o dia 5 como início do ciclo")).toBeTruthy();
  });

  it("escolher um dia muda o rascunho, sem salvar ainda", () => {
    const { getByLabelText } = montar({ visible: true, onClose: jest.fn() });

    fireEvent.press(getByLabelText("Dia 15"));

    // O botão de aplicar passa a falar do dia 15…
    expect(getByLabelText("Usar o dia 15 como início do ciclo")).toBeTruthy();
    // …mas a preferência salva continua a de antes
    expect(usePreferencesStore.getState().cycleAnchorDay).toBe(1);
  });

  it("aplicar salva, fecha e RECARREGA as consolidações", () => {
    const onClose = jest.fn();
    const { getByLabelText } = montar({ visible: true, onClose });
    fireEvent.press(getByLabelText("Dia 15"));

    fireEvent.press(getByLabelText("Usar o dia 15 como início do ciclo"));

    expect(usePreferencesStore.getState().cycleAnchorDay).toBe(15);
    expect(onClose).toHaveBeenCalled();
    // Sem recarregar, o rótulo novo ficaria sobre os números do recorte velho
    expect(reloadAnalyticsForAnchorChange).toHaveBeenCalled();
  });

  it("fechar sem aplicar não deixa rascunho pendurado para a próxima vez", () => {
    const onClose = jest.fn();
    const { getByLabelText, rerender } = montar({ visible: true, onClose });
    fireEvent.press(getByLabelText("Dia 15"));

    fireEvent.press(getByLabelText("Fechar"));
    rerender(
      <SafeAreaProvider initialMetrics={METRICAS}>
        <CycleAnchorSheet visible={false} onClose={onClose} />
      </SafeAreaProvider>,
    );
    rerender(
      <SafeAreaProvider initialMetrics={METRICAS}>
        <CycleAnchorSheet visible onClose={onClose} />
      </SafeAreaProvider>,
    );

    // Reabrir parte do valor SALVO, não do que foi tocado e abandonado
    expect(getByLabelText("Usar o dia 1 como início do ciclo")).toBeTruthy();
    expect(usePreferencesStore.getState().cycleAnchorDay).toBe(1);
  });

  it("abrir sem séries em memória busca as recorrências uma vez", () => {
    const fetchSeries = jest.fn();
    useRecurrenceStore.setState({ series: [], fetchSeries } as never);

    montar({ visible: true, onClose: jest.fn() });

    // Só a Home buscava: aberta pelo Perfil, a folha nunca mostrava
    // "Suas entradas"
    expect(fetchSeries).toHaveBeenCalledTimes(1);
  });

  it("com séries já em memória, reabrir não vira requisição", () => {
    const fetchSeries = jest.fn();
    useRecurrenceStore.setState({
      series: [{ id: "s1", merchantKey: "salario", anchorDay: 5 }],
      fetchSeries,
    } as never);

    montar({ visible: true, onClose: jest.fn() });

    expect(fetchSeries).not.toHaveBeenCalled();
  });
});
