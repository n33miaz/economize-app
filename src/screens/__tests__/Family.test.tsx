import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import Family from "../Family";
import { useAccountsStore } from "../../store/accountsStore";
import { useCategoriesStore } from "../../store/categoriesStore";
import { useFamilyStore } from "../../store/familyStore";

jest.mock("../../services/api", () => ({ __esModule: true, default: {} }));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({ index: 1, routes: [{ name: "Main" }, { name: "Familia" }] }),
  }),
  useRoute: () => ({ params: {} }),
  useIsFocused: () => true,
  useFocusEffect: (efeito: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(efeito, []);
  },
}));

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const CASA = {
  id: "f1",
  name: "Casa Salada",
  role: "OWNER",
  members: [
    {
      id: "m1",
      userId: "u1",
      name: "Neemias Cormino Manso",
      role: "OWNER",
      joinedAt: "2026-09-07T14:31:17Z",
      shareScope: "TRANSACTIONS",
      isMe: true,
    },
    {
      id: "m2",
      userId: "u2",
      name: "Alice dos Santos Araujo",
      role: "MEMBER",
      joinedAt: "2026-09-07T14:31:18Z",
      shareScope: "TRANSACTIONS",
      isMe: false,
    },
  ],
  mySharing: {
    shareScope: "TRANSACTIONS",
    hiddenCategoryIds: [],
    sharedAccountIds: [],
    includeUnassigned: true,
  },
  invite: null,
};

const BASE = {
  family: null,
  hasFamily: false,
  hasLoadedOnce: true,
  isLoading: false,
  isSaving: false,
  error: null,
  scope: "me",
  setScope: jest.fn(),
  lastInvite: null,
  analytics: null,
  fetchFamily: jest.fn().mockResolvedValue(undefined),
};

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Family />
    </SafeAreaProvider>,
  );

describe("Família", () => {
  beforeEach(() => {
    useFamilyStore.setState(BASE as never);
    useCategoriesStore.setState({
      items: [],
      fetch: jest.fn().mockResolvedValue(undefined),
    } as never);
    useAccountsStore.setState({
      accounts: [],
      byId: new Map(),
      fetchAccounts: jest.fn().mockResolvedValue(undefined),
    } as never);
  });

  it("sem casa, oferece criar ou entrar com código", async () => {
    const { getByText } = montar();

    await waitFor(() => expect(getByText("Família")).toBeTruthy());
  });

  it("com casa, lista quem mora nela", async () => {
    useFamilyStore.setState({
      ...BASE,
      family: CASA,
      hasFamily: true,
    } as never);

    const { getByText } = montar();

    await waitFor(() => expect(getByText("Casa Salada")).toBeTruthy());
    expect(getByText("Alice dos Santos Araujo")).toBeTruthy();
  });

  it("busca a casa ao abrir", async () => {
    const fetchFamily = jest.fn().mockResolvedValue(undefined);
    useFamilyStore.setState({ ...BASE, fetchFamily } as never);

    montar();

    await waitFor(() => expect(fetchFamily).toHaveBeenCalled());
  });

  it("falha ao carregar não deixa a tela sem explicação", async () => {
    useFamilyStore.setState({
      ...BASE,
      error: "Não foi possível carregar a casa.",
    } as never);

    const { getByText } = montar();

    await waitFor(() => expect(getByText("Família")).toBeTruthy());
  });
});
