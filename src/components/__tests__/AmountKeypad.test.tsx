import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import AmountKeypad from "../AmountKeypad";

function montar(props: Partial<React.ComponentProps<typeof AmountKeypad>> = {}) {
  const onChange = jest.fn();
  const onAction = jest.fn();
  const onDismiss = jest.fn();
  const tela = render(
    <AmountKeypad
      value=""
      onChange={onChange}
      actionLabel="Adicionar ao carrinho"
      onAction={onAction}
      onDismiss={onDismiss}
      {...props}
    />,
  );
  return { tela, onChange, onAction, onDismiss };
}

describe("AmountKeypad", () => {
  it("cada tecla escreve no campo de quem chamou", () => {
    const { tela, onChange } = montar({ value: "12" });
    fireEvent.press(tela.getByLabelText("9"));
    expect(onChange).toHaveBeenCalledWith("129");
  });

  it("a vírgula e o apagar têm nome, não só desenho", () => {
    const { tela, onChange } = montar({ value: "12" });
    fireEvent.press(tela.getByLabelText("Vírgula"));
    expect(onChange).toHaveBeenCalledWith("12,");

    fireEvent.press(tela.getByLabelText("Apagar o último número"));
    expect(onChange).toHaveBeenCalledWith("1");
  });

  it("segurar o apagar limpa tudo de uma vez", () => {
    const { tela, onChange } = montar({ value: "1234,56" });
    fireEvent(tela.getByLabelText("Apagar o último número"), "longPress");
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("o botão que encerra o item fica NAS teclas, ao alcance do polegar", () => {
    const { tela, onAction } = montar();
    fireEvent.press(tela.getByLabelText("Adicionar ao carrinho"));
    expect(onAction).toHaveBeenCalled();
  });

  it("ocupado não deixa adicionar duas vezes", () => {
    const { tela, onAction } = montar({ disabled: true });
    fireEvent.press(tela.getByLabelText("Adicionar ao carrinho"));
    expect(onAction).not.toHaveBeenCalled();
  });

  it("dá para esconder o teclado e ler a folha inteira", () => {
    const { tela, onDismiss } = montar();
    fireEvent.press(tela.getByLabelText("Esconder o teclado de números"));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("mostra a dica de preço onde o olho já está", () => {
    const { tela } = montar({ hint: "Da última vez R$ 5,99 aqui" });
    expect(tela.getByText("Da última vez R$ 5,99 aqui")).toBeTruthy();
  });
});
