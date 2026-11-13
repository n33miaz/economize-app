import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import DeleteAccountSheet from "../DeleteAccountSheet";
import { deleteMyAccount, getMfaStatus } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {},
  getMfaStatus: jest.fn(),
  deleteMyAccount: jest.fn(),
}));

const mockExcluir = deleteMyAccount as jest.MockedFunction<
  typeof deleteMyAccount
>;
const mockStatus = getMfaStatus as jest.MockedFunction<typeof getMfaStatus>;

const mfa = (enabled: boolean) =>
  ({
    enabled,
    pendingConfirmation: false,
    confirmedAt: null,
    recoveryCodesRemaining: 0,
  }) as never;

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = (onClose = jest.fn()) =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <DeleteAccountSheet visible onClose={onClose} />
    </SafeAreaProvider>,
  );

const botao = (tela: ReturnType<typeof montar>) =>
  tela.getByLabelText("Excluir minha conta para sempre");

describe("DeleteAccountSheet", () => {
  beforeEach(() => {
    mockExcluir.mockReset();
    mockStatus.mockReset();
    useAuthStore.setState({
      token: "t",
      userName: "Titular",
      lastUserKey: "u1",
    } as never);
    useToastStore.setState({ message: null } as never);
  });

  it("explica que é permanente e não deixa excluir sem a senha", async () => {
    mockStatus.mockResolvedValue(mfa(false));
    const tela = montar();

    expect(tela.getByText(/É permanente/)).toBeTruthy();
    await waitFor(() => expect(mockStatus).toHaveBeenCalled());
    fireEvent.press(botao(tela));

    expect(mockExcluir).not.toHaveBeenCalled();
  });

  it("com 2FA ligado, exige o código e o envia junto com a senha", async () => {
    mockStatus.mockResolvedValue(mfa(true));
    mockExcluir.mockResolvedValue(undefined);
    const tela = montar();
    await waitFor(() =>
      expect(tela.getByText("Código de verificação")).toBeTruthy(),
    );

    fireEvent.changeText(tela.getByLabelText("Sua senha"), "minha-senha");
    fireEvent.press(botao(tela));
    expect(mockExcluir).not.toHaveBeenCalled();

    fireEvent.changeText(
      tela.getByLabelText("Código de verificação"),
      " 123456 ",
    );
    await act(async () => {
      fireEvent.press(botao(tela));
    });

    expect(mockExcluir).toHaveBeenCalledWith("minha-senha", "123456");
  });

  it("aceito pelo servidor: logout local completo, e esquece quem foi", async () => {
    mockStatus.mockResolvedValue(mfa(false));
    mockExcluir.mockResolvedValue(undefined);
    const onClose = jest.fn();
    const tela = montar(onClose);
    await waitFor(() => expect(mockStatus).toHaveBeenCalled());

    fireEvent.changeText(tela.getByLabelText("Sua senha"), "minha-senha");
    await act(async () => {
      fireEvent.press(botao(tela));
    });

    expect(mockExcluir).toHaveBeenCalledWith("minha-senha", undefined);
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().lastUserKey).toBeNull();
    expect(onClose).toHaveBeenCalled();
  });

  it("dois toques mandam UM pedido só", async () => {
    mockStatus.mockResolvedValue(mfa(false));
    let soltar!: () => void;
    mockExcluir.mockReturnValue(
      new Promise<void>((resolve) => {
        soltar = resolve;
      }),
    );
    const tela = montar();
    await waitFor(() => expect(mockStatus).toHaveBeenCalled());
    fireEvent.changeText(tela.getByLabelText("Sua senha"), "minha-senha");

    await act(async () => {
      fireEvent.press(botao(tela));
      fireEvent.press(botao(tela));
      soltar();
    });

    expect(mockExcluir).toHaveBeenCalledTimes(1);
  });

  it("recusado (senha errada, casa com membros): mostra o motivo e a sessão fica", async () => {
    mockStatus.mockResolvedValue(mfa(false));
    mockExcluir.mockRejectedValue({
      response: {
        status: 409,
        data: { detail: "Você criou uma casa que tem outros membros." },
      },
    });
    const tela = montar();
    await waitFor(() => expect(mockStatus).toHaveBeenCalled());
    fireEvent.changeText(tela.getByLabelText("Sua senha"), "minha-senha");

    await act(async () => {
      fireEvent.press(botao(tela));
    });

    expect(useAuthStore.getState().token).toBe("t");
    expect(useToastStore.getState().message).toMatch(/casa/);
  });
});
