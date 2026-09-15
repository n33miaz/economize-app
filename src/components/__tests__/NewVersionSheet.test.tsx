import React from "react";
import { render, screen } from "@testing-library/react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import NewVersionSheet from "../NewVersionSheet";
import { usePreferencesStore } from "../../store/preferencesStore";
import { useVersionStore } from "../../store/versionStore";

/**
 * O anúncio de versão nova.
 *
 * <p><b>O defeito que trouxe esta folha.</b> O dono publicou a 2.3.1, abriu o
 * app e não percebeu nada: a faixa do topo é discreta por desenho, e discreta
 * demais é ignorável. Versão nova de um app de dinheiro é notícia.
 */
// A folha vive dentro do CustomModal, que le os recuos da area segura: sem
// provedor com metricas o render estoura antes de desenhar qualquer coisa
const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <NewVersionSheet />
    </SafeAreaProvider>,
  );

const infoCom = (latestVersion: string) => ({
  minVersion: "2.2.0",
  latestVersion,
  downloadUrl: "https://economize-web.onrender.com/baixar",
  apkUrl: "https://github.com/n33miaz/economize-app/releases/latest/download/economize.apk",
  storeUrl: null,
  message: null,
  apiVersion: "1.0.0",
  schemaVersion: "V35",
});

const comEstado = (status: "ok" | "update-available", latestVersion: string) => {
  useVersionStore.setState({ status, info: infoCom(latestVersion) });
};

describe("NewVersionSheet", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ versionNoticeSeenFor: null });
    useVersionStore.setState({ status: "ok", info: null });
  });

  it("anuncia a versão publicada quando há atualização disponível", () => {
    comEstado("update-available", "2.3.1");

    montar();

    expect(screen.getByText("Versão 2.3.1 disponível")).toBeTruthy();
  });

  it("não aparece quando o app está na versão publicada", () => {
    comEstado("ok", "2.3.1");

    montar();

    expect(screen.queryByText(/disponível/)).toBeNull();
  });

  /**
   * A regra central: guardar a VERSÃO e não um booleano. Com booleano o aviso
   * apareceria uma vez na vida e todo release seguinte ficaria mudo.
   */
  it("não repete o anúncio da versão que a pessoa já dispensou", () => {
    usePreferencesStore.setState({ versionNoticeSeenFor: "2.3.1" });
    comEstado("update-available", "2.3.1");

    montar();

    expect(screen.queryByText("Versão 2.3.1 disponível")).toBeNull();
  });

  it("volta a anunciar quando sai uma versão mais nova", () => {
    usePreferencesStore.setState({ versionNoticeSeenFor: "2.3.1" });
    comEstado("update-available", "2.4.0");

    montar();

    expect(screen.getByText("Versão 2.4.0 disponível")).toBeTruthy();
  });

  /**
   * Sem número não há anúncio: "versão nova" sem dizer qual é aviso que não
   * informa nada, e ainda gastaria o único momento em que a pessoa presta
   * atenção.
   */
  it("não aparece sem saber qual é a versão publicada", () => {
    useVersionStore.setState({ status: "update-available", info: null });

    montar();

    expect(screen.queryByText(/disponível/)).toBeNull();
  });

  it("oferece sair sem atualizar — a faixa do topo é quem insiste depois", () => {
    comEstado("update-available", "2.3.1");

    montar();

    expect(screen.getByText("Depois")).toBeTruthy();
  });
});
