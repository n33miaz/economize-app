import React from "react";
import { Linking } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import UpdateBanner from "../UpdateBanner";
import { useVersionStore } from "../../store/versionStore";

jest.mock("../../services/api", () => ({
  getAppVersion: jest.fn(),
}));

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <UpdateBanner />
    </SafeAreaProvider>,
  );

const INFO = {
  minVersion: "2.0.0",
  latestVersion: "2.3.0",
  downloadUrl: "https://economize-web.onrender.com/baixar",
  storeUrl: null,
};

/**
 * "Nova versão disponível": aviso, nunca bloqueio — e que sabe calar.
 */
describe("UpdateBanner", () => {
  let openUrl: jest.SpyInstance;

  beforeEach(() => {
    useVersionStore.setState({
      status: "unknown",
      info: null,
      bannerDismissed: false,
      refusedByServer: false,
    });
    openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  });

  afterEach(() => openUrl.mockRestore());

  it("sem novidade, não ocupa espaço", () => {
    useVersionStore.setState({ status: "ok", info: INFO });
    expect(montar().queryByText("Nova versão disponível")).toBeNull();
  });

  it("bloqueio não é assunto da faixa — é do gate", () => {
    useVersionStore.setState({ status: "upgrade-required", info: INFO });
    expect(montar().queryByText("Nova versão disponível")).toBeNull();
  });

  it("com versão nova, avisa e oferece a ação", () => {
    useVersionStore.setState({ status: "update-available", info: INFO });

    const { getByText, getByLabelText } = montar();

    expect(getByText("Nova versão disponível")).toBeTruthy();
    // Fora da web a ação é baixar (na web é recarregar a página)
    fireEvent.press(getByLabelText("Baixar"));
    expect(openUrl).toHaveBeenCalledWith("https://economize-web.onrender.com/baixar");
  });

  it("fechar cala a faixa pelo resto da sessão", () => {
    useVersionStore.setState({ status: "update-available", info: INFO });

    const { getByLabelText, queryByText } = montar();
    fireEvent.press(getByLabelText("Fechar aviso"));

    expect(queryByText("Nova versão disponível")).toBeNull();
    expect(useVersionStore.getState().bannerDismissed).toBe(true);
  });
});
