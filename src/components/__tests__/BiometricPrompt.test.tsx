import React from "react";
import { Modal as RNModal } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import BiometricPrompt from "../BiometricPrompt";

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = (props: React.ComponentProps<typeof BiometricPrompt>) =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <BiometricPrompt {...props} />
    </SafeAreaProvider>,
  );

/**
 * A oferta de biometria, e o check que dá sentido a ela.
 *
 * <p>Sem o check, dizer "agora não" uma vez calava a pergunta para sempre — e
 * quem mudasse de ideia tinha de descobrir sozinho o caminho no Perfil. O
 * estado do check é o que a tela de login lê para decidir se a decisão é
 * definitiva; por isso ele viaja no `onDecline` em vez de ficar guardado aqui.
 */
describe("BiometricPrompt", () => {
  it("fechado, não desenha nada", () => {
    const { queryByLabelText } = montar({
      visible: false,
      onEnable: jest.fn().mockResolvedValue(true),
      onDecline: jest.fn(),
    });

    expect(queryByLabelText("Usar biometria")).toBeNull();
  });

  it("aberto, o check começa desmarcado", () => {
    const { getByLabelText } = montar({
      visible: true,
      onEnable: jest.fn().mockResolvedValue(true),
      onDecline: jest.fn(),
    });

    expect(
      getByLabelText("Não perguntar novamente").props.accessibilityState
        ?.checked,
    ).toBe(false);
  });

  it("recusar sem o check avisa que a decisão NÃO é definitiva", () => {
    const onDecline = jest.fn();
    const { getByLabelText } = montar({
      visible: true,
      onEnable: jest.fn().mockResolvedValue(true),
      onDecline,
    });

    fireEvent.press(getByLabelText("Agora não"));

    expect(onDecline).toHaveBeenCalledWith(false);
  });

  it("recusar com o check marcado cala a pergunta para sempre", () => {
    const onDecline = jest.fn();
    const { getByLabelText } = montar({
      visible: true,
      onEnable: jest.fn().mockResolvedValue(true),
      onDecline,
    });

    fireEvent.press(getByLabelText("Não perguntar novamente"));
    fireEvent.press(getByLabelText("Agora não"));

    expect(onDecline).toHaveBeenCalledWith(true);
  });

  it("o check alterna", () => {
    const { getByLabelText } = montar({
      visible: true,
      onEnable: jest.fn().mockResolvedValue(true),
      onDecline: jest.fn(),
    });
    const check = getByLabelText("Não perguntar novamente");

    fireEvent.press(check);
    expect(check.props.accessibilityState?.checked).toBe(true);
    fireEvent.press(check);
    expect(check.props.accessibilityState?.checked).toBe(false);
  });

  it("o voltar do Android conta como recusa, levando o check junto", () => {
    const onDecline = jest.fn();
    const { getByLabelText, UNSAFE_getByType } = montar({
      visible: true,
      onEnable: jest.fn().mockResolvedValue(true),
      onDecline,
    });

    fireEvent.press(getByLabelText("Não perguntar novamente"));
    // Voltar e tocar fora chamam o mesmo `onClose` do CustomModal; sem
    // ligá-lo ao onDecline, a sessão retida ficaria pendurada e o app não
    // entraria nunca
    UNSAFE_getByType(RNModal).props.onRequestClose();

    expect(onDecline).toHaveBeenCalledWith(true);
  });

  it("enquanto liga, o botão trava — dois toques seriam dois prompts", async () => {
    let liberar: (ok: boolean) => void = () => {};
    const onEnable = jest.fn(
      () =>
        new Promise<boolean>((resolve) => {
          liberar = resolve;
        }),
    );
    const { getByLabelText } = montar({
      visible: true,
      onEnable,
      onDecline: jest.fn(),
    });

    fireEvent.press(getByLabelText("Usar biometria"));
    fireEvent.press(getByLabelText("Usar biometria"));

    expect(onEnable).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(
        getByLabelText("Usar biometria").props.accessibilityState?.busy,
      ).toBe(true),
    );
    liberar(true);
  });

  it("falhar libera o botão para tentar de novo, sem fechar", async () => {
    const onEnable = jest.fn().mockResolvedValue(false);
    const { getByLabelText } = montar({
      visible: true,
      onEnable,
      onDecline: jest.fn(),
    });

    fireEvent.press(getByLabelText("Usar biometria"));

    // Cancelar o prompt do sistema é engano comum: fechar tudo obrigaria a
    // refazer o login inteiro para tentar de novo
    await waitFor(() =>
      expect(
        getByLabelText("Usar biometria").props.accessibilityState?.busy,
      ).toBe(false),
    );
    fireEvent.press(getByLabelText("Usar biometria"));
    expect(onEnable).toHaveBeenCalledTimes(2);
  });

  it("reabrir é uma pergunta nova: o check volta desmarcado", () => {
    const props = {
      visible: true,
      onEnable: jest.fn().mockResolvedValue(true),
      onDecline: jest.fn(),
    };
    const { getByLabelText, rerender } = montar(props);
    fireEvent.press(getByLabelText("Não perguntar novamente"));

    rerender(
      <SafeAreaProvider initialMetrics={METRICAS}>
        <BiometricPrompt {...props} visible={false} />
      </SafeAreaProvider>,
    );
    rerender(
      <SafeAreaProvider initialMetrics={METRICAS}>
        <BiometricPrompt {...props} visible />
      </SafeAreaProvider>,
    );

    expect(
      getByLabelText("Não perguntar novamente").props.accessibilityState
        ?.checked,
    ).toBe(false);
  });
});
