import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import FloatingLabelInput from "../FloatingLabelInput";

describe("FloatingLabelInput Component", () => {
  it("deve renderizar o rótulo e repassar o texto digitado", () => {
    const onChangeText = jest.fn();
    const { getByText, getByLabelText } = render(
      <FloatingLabelInput label="E-mail" value="" onChangeText={onChangeText} />,
    );

    expect(getByText("E-mail")).toBeTruthy();

    // O rótulo vira o accessibilityLabel do input: é assim que leitores de
    // tela (e este teste) localizam o campo
    const input = getByLabelText("E-mail");
    fireEvent.changeText(input, "usuario@teste.com");
    expect(onChangeText).toHaveBeenCalledWith("usuario@teste.com");
  });

  it("deve propagar onFocus e onBlur do TextInput", () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    const { getByLabelText } = render(
      <FloatingLabelInput
        label="Nome Completo"
        value=""
        onChangeText={jest.fn()}
        onFocus={onFocus}
        onBlur={onBlur}
      />,
    );

    const input = getByLabelText("Nome Completo");
    fireEvent(input, "focus");
    fireEvent(input, "blur");

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("não deve exibir o botão de mostrar senha quando o campo está vazio", () => {
    const { queryByLabelText } = render(
      <FloatingLabelInput
        label="Senha"
        value=""
        onChangeText={jest.fn()}
        secureTextEntry
      />,
    );

    expect(queryByLabelText("Mostrar senha")).toBeNull();
  });

  it("deve alternar a visibilidade da senha pelo botão de olho", () => {
    const { getByLabelText, queryByLabelText } = render(
      <FloatingLabelInput
        label="Senha"
        value="123456"
        onChangeText={jest.fn()}
        secureTextEntry
      />,
    );

    const input = getByLabelText("Senha");
    expect(input.props.secureTextEntry).toBe(true);

    fireEvent.press(getByLabelText("Mostrar senha"));

    expect(input.props.secureTextEntry).toBe(false);
    expect(queryByLabelText("Ocultar senha")).toBeTruthy();
  });

  it("deve repassar props extras ao TextInput", () => {
    const { getByLabelText } = render(
      <FloatingLabelInput
        label="E-mail"
        value=""
        onChangeText={jest.fn()}
        keyboardType="email-address"
        autoCapitalize="none"
        testID="campo-email"
      />,
    );

    const input = getByLabelText("E-mail");
    expect(input.props.keyboardType).toBe("email-address");
    expect(input.props.autoCapitalize).toBe("none");
    expect(input.props.testID).toBe("campo-email");
  });
});
