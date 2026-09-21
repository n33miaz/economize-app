import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import PurchasePreferenceSheet from "../PurchasePreferenceSheet";
import { useAccountsStore } from "../../store/accountsStore";
import { useToastStore } from "../../store/toastStore";
import { useWishStore } from "../../store/wishStore";
import type { ConnectorAccount } from "../../services/api";

/**
 * Como a pessoa faz as compras (EC-237).
 *
 * <p>Três garantias: salvar manda a cadência e o fim de semana certos ao
 * store; escolher cartão sem selecionar um cartão específico é bloqueado
 * antes de qualquer chamada de rede; e "deixar o app deduzir" não é mais uma
 * opção de cadência — é o DELETE da preferência, para a pessoa desfazer o que
 * declarou sem precisar adivinhar qual era a dedução.
 */

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const cartao = (over: Partial<ConnectorAccount> = {}): ConnectorAccount =>
  ({
    id: "acc-1",
    name: "Nubank",
    type: "CREDIT_CARD",
    institution: "Nubank",
    statementClosingDay: 10,
    statementDueDay: 17,
    linked: true,
    reportedBalance: -500,
    reportedBalanceAt: "2026-09-16T09:00:00Z",
    creditLimit: 3000,
    creditLimitSharedWith: null,
    ...over,
  }) as ConnectorAccount;

const montar = (props: { visible: boolean; onClose: () => void }) =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <PurchasePreferenceSheet {...props} />
    </SafeAreaProvider>,
  );

describe("PurchasePreferenceSheet", () => {
  let savePurchasePreference: jest.Mock;
  let clearPurchasePreference: jest.Mock;
  let showToast: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    savePurchasePreference = jest
      .fn()
      .mockResolvedValue({ ok: true, message: "Preferência de compra salva." });
    clearPurchasePreference = jest
      .fn()
      .mockResolvedValue({ ok: true, message: "O app volta a deduzir do seu extrato." });
    showToast = jest.fn();

    useWishStore.setState({
      incomePattern: null,
      isSaving: false,
      savePurchasePreference,
      clearPurchasePreference,
    } as never);
    useToastStore.setState({ showToast } as never);
    useAccountsStore.setState({
      accounts: [cartao()],
      fetchAccounts: jest.fn().mockResolvedValue(undefined),
    } as never);
  });

  it("fechada, não desenha o conteúdo", () => {
    const { queryByText } = montar({ visible: false, onClose: jest.fn() });

    expect(queryByText("Como você faz as compras")).toBeNull();
  });

  it("salva mensal com preferência de fim de semana", async () => {
    const onClose = jest.fn();
    const { getByText, getByLabelText } = montar({ visible: true, onClose });

    fireEvent.press(getByLabelText("Mensal"));
    // O toggle de fim de semana já nasce ligado por padrão
    fireEvent.press(getByText("Salvar"));

    await waitFor(() =>
      expect(savePurchasePreference).toHaveBeenCalledWith({
        cadence: "MONTHLY",
        weekendPreferred: true,
        paymentMode: "CASH",
        cardAccountId: null,
      }),
    );
    expect(showToast).toHaveBeenCalledWith(
      "Preferência de compra salva.",
      "success",
    );
    expect(onClose).toHaveBeenCalled();
  });

  /**
   * A guarda existe para este cenário exato: `card_account_id` tem
   * `ON DELETE SET NULL` (V37) — se o cartão escolhido for desconectado, a
   * preferência salva fica com `paymentMode: "CARD"` e `cardAccountId: null`.
   * Reabrir a folha nesse estado não pode mandar isso de volta ao servidor
   * sem a pessoa escolher outro cartão.
   */
  it("cartão desconectado depois de escolhido: bloqueia antes de salvar sem cartão", async () => {
    useWishStore.setState({
      incomePattern: {
        status: "READY",
        message: null,
        today: "2026-09-15",
        sources: [],
        preference: {
          cadence: "MONTHLY",
          weekendPreferred: true,
          paymentMode: "CARD",
          cardAccountId: null,
          updatedAt: "2026-09-01T00:00:00Z",
        },
        inferred: null,
        advice: null,
      },
      isSaving: false,
      savePurchasePreference,
      clearPurchasePreference,
    } as never);

    const { getByText } = montar({ visible: true, onClose: jest.fn() });

    fireEvent.press(getByText("Salvar"));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        "Escolha qual cartão paga o mercado.",
        "warning",
      ),
    );
    expect(savePurchasePreference).not.toHaveBeenCalled();
  });

  it("escolher um cartão da lista salva com paymentMode CARD", async () => {
    const { getByLabelText, getByText } = montar({
      visible: true,
      onClose: jest.fn(),
    });

    fireEvent.press(getByLabelText("Mensal"));
    fireEvent.press(getByLabelText(/Cartão Nubank/));
    fireEvent.press(getByText("Salvar"));

    await waitFor(() =>
      expect(savePurchasePreference).toHaveBeenCalledWith({
        cadence: "MONTHLY",
        weekendPreferred: true,
        paymentMode: "CARD",
        cardAccountId: "acc-1",
      }),
    );
  });

  it("'Deixar o app deduzir' chama o DELETE da preferência, não um PUT", async () => {
    const onClose = jest.fn();
    const { getByLabelText } = montar({ visible: true, onClose });

    // "AUTO" já é o valor inicial quando não há preferência salva; o rótulo
    // do botão também vira "Deixar o app deduzir" nesse estado — por isso a
    // busca é pelo `accessibilityLabel` fixo do botão, não pelo texto visível
    fireEvent.press(getByLabelText("Salvar como você compra"));

    await waitFor(() => expect(clearPurchasePreference).toHaveBeenCalled());
    expect(savePurchasePreference).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      "O app volta a deduzir do seu extrato.",
      "success",
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("abrir já parte da preferência salva, não de 'auto'", () => {
    useWishStore.setState({
      incomePattern: {
        status: "READY",
        message: null,
        today: "2026-09-15",
        sources: [],
        preference: {
          cadence: "WEEKLY",
          weekendPreferred: false,
          paymentMode: "CASH",
          cardAccountId: null,
          updatedAt: "2026-09-01T00:00:00Z",
        },
        inferred: null,
        advice: null,
      },
    } as never);

    const { getByLabelText } = montar({ visible: true, onClose: jest.fn() });

    // Semanal selecionado como o segmento ativo
    expect(getByLabelText("Semanal").props.accessibilityState.selected).toBe(
      true,
    );
  });

  it("cartão sem dia de fechamento conhecido aparece rotulado, não escondido", () => {
    useAccountsStore.setState({
      accounts: [cartao({ id: "acc-2", name: "Ofx sem fechamento", statementClosingDay: null })],
      fetchAccounts: jest.fn(),
    } as never);

    const { getByLabelText, getByText } = montar({
      visible: true,
      onClose: jest.fn(),
    });

    fireEvent.press(getByLabelText("Mensal"));

    expect(getByText("Fechamento desconhecido")).toBeTruthy();
    // A escolha continua permitida — só o rótulo avisa
    expect(getByLabelText(/Ofx sem fechamento/)).toBeTruthy();
  });
});
