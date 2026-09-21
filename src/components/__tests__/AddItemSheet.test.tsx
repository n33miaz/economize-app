import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import AddItemSheet from "../AddItemSheet";
import type { ShoppingItem } from "../../utils/shopping";
import { formatBRL } from "../../utils/money";
import { detectCamera } from "../../utils/camera";
import * as ImagePicker from "expo-image-picker";

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("../../utils/camera", () => ({
  detectCamera: jest.fn().mockResolvedValue(true),
  shrinkImageForWeb: jest.fn(async (uri: string) => uri),
}));

const detectar = detectCamera as jest.MockedFunction<typeof detectCamera>;
const camera = ImagePicker.launchCameraAsync as jest.MockedFunction<typeof ImagePicker.launchCameraAsync>;

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const ITEM: ShoppingItem = {
  clientId: "i1",
  name: "Leite",
  quantity: 2,
  unitPrice: 5.49,
  promoNote: "leve 3",
  checked: true,
  photoRef: null,
  deleted: false,
  addedByName: null,
  clientUpdatedAt: "2026-09-21T10:00:00.000Z",
};

function montar(over: Partial<React.ComponentProps<typeof AddItemSheet>> = {}) {
  const props = {
    visible: true,
    storeName: "Carrefour",
    editing: null,
    suggestionsFor: jest.fn(() => [] as string[]),
    priceSummaryFor: jest.fn(() => null),
    lookupPrice: jest.fn(async () => null),
    onSave: jest.fn(),
    onDelete: jest.fn(),
    onClose: jest.fn(),
    ...over,
  };
  const utils = render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <AddItemSheet {...props} />
    </SafeAreaProvider>,
  );
  return { ...utils, props };
}

describe("AddItemSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    detectar.mockResolvedValue(true);
  });

  it("adiciona em um toque e já limpa para o próximo item", async () => {
    const { getByLabelText, props } = montar();

    fireEvent.changeText(getByLabelText("Nome do item"), "Arroz");
    fireEvent.changeText(getByLabelText("Preço unitário"), "24,90");
    fireEvent.press(getByLabelText("Adicionar ao carrinho"));

    expect(props.onSave).toHaveBeenCalledWith({
      name: "Arroz",
      quantity: 1,
      unitPrice: 24.9,
      promoNote: null,
      photoRef: null,
      checked: undefined,
    });
    // A folha continua aberta e vazia: digitar quarenta itens tem de ser rápido
    expect(props.onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(getByLabelText("Nome do item").props.value).toBe(""));
    expect(getByLabelText("Preço unitário").props.value).toBe("");
    expect(getByLabelText("Quantidade").props.value).toBe("1");
  });

  it("sem nome não salva e diz o que falta", () => {
    const { getByLabelText, getByText, props } = montar();

    fireEvent.press(getByLabelText("Adicionar ao carrinho"));

    expect(getByText("Diga o que você pegou.")).toBeTruthy();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("preço vazio é 'sem preço', não erro — anotar depois é o fluxo real", () => {
    const { getByLabelText, props } = montar();

    fireEvent.changeText(getByLabelText("Nome do item"), "Sabão");
    fireEvent.press(getByLabelText("Adicionar ao carrinho"));

    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ name: "Sabão", unitPrice: 0 }));
  });

  it("− e + mexem na quantidade sem descer de 1", () => {
    const { getByLabelText } = montar();

    fireEvent.press(getByLabelText("Uma unidade a mais"));
    fireEvent.press(getByLabelText("Uma unidade a mais"));
    expect(getByLabelText("Quantidade").props.value).toBe("3");

    fireEvent.press(getByLabelText("Uma unidade a menos"));
    fireEvent.press(getByLabelText("Uma unidade a menos"));
    fireEvent.press(getByLabelText("Uma unidade a menos"));
    expect(getByLabelText("Quantidade").props.value).toBe("1");
  });

  it("sugestões completam o nome em um toque", () => {
    const { getByLabelText, props } = montar({
      suggestionsFor: jest.fn((q: string) => (q ? ["Arroz integral"] : [])),
    });

    fireEvent.changeText(getByLabelText("Nome do item"), "arr");
    fireEvent.press(getByLabelText("Usar Arroz integral"));

    expect(getByLabelText("Nome do item").props.value).toBe("Arroz integral");
    expect(props.suggestionsFor).toHaveBeenCalledWith("arr");
  });

  it("diz quanto custou da última vez — do aparelho na hora, do servidor depois", async () => {
    const local = { lastPrice: 5.49, lastStore: "Carrefour", lastDate: "2026-09-01", minPrice: 5.49, maxPrice: 5.49, avgPrice: 5.49, occurrences: 1 };
    const servidor = { ...local, lastPrice: 4.99, lastStore: "Dia", lastDate: "2026-09-15" };
    const { getByLabelText, findByText } = montar({
      priceSummaryFor: jest.fn(() => local),
      lookupPrice: jest.fn(async () => servidor),
    });

    fireEvent.changeText(getByLabelText("Nome do item"), "Leite");

    expect(await findByText(`da última vez ${formatBRL(5.49)} aqui`)).toBeTruthy();
    expect(await findByText(`da última vez ${formatBRL(4.99)} no Dia`)).toBeTruthy();
  });

  it("editar abre com os valores do item e fecha ao salvar", () => {
    const { getByLabelText, props } = montar({ editing: ITEM });

    expect(getByLabelText("Nome do item").props.value).toBe("Leite");
    expect(getByLabelText("Quantidade").props.value).toBe("2");
    expect(getByLabelText("Preço unitário").props.value).toBe("5,49");
    expect(getByLabelText("Promoção").props.value).toBe("leve 3");

    fireEvent.changeText(getByLabelText("Preço unitário"), "5,99");
    fireEvent.press(getByLabelText("Salvar item"));

    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ name: "Leite", quantity: 2, unitPrice: 5.99, promoNote: "leve 3", checked: true }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it("editando, remover pede confirmação a quem chamou", () => {
    const { getByLabelText, props } = montar({ editing: ITEM });

    fireEvent.press(getByLabelText("Remover item do carrinho"));

    expect(props.onDelete).toHaveBeenCalledWith(ITEM);
  });

  it("sem câmera o botão de foto some", async () => {
    detectar.mockResolvedValue(false);
    const { queryByLabelText } = montar();

    await waitFor(() => expect(queryByLabelText("Foto do preço")).toBeNull());
  });

  it("com câmera, a foto entra no item", async () => {
    camera.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///preco.jpg" } as never] });
    const { getByLabelText, findByLabelText, props } = montar();

    fireEvent.changeText(getByLabelText("Nome do item"), "Café");
    fireEvent.press(await findByLabelText("Foto do preço"));

    await waitFor(() => expect(camera).toHaveBeenCalledWith({ mediaTypes: ["images"], quality: 0.5 }));
    expect(await findByLabelText("Tirar outra foto do preço")).toBeTruthy();
    fireEvent.press(getByLabelText("Adicionar ao carrinho"));
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ photoRef: "file:///preco.jpg" }));
  });
});
