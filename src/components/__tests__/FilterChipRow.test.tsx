import React from "react";
import { Image } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";

import FilterChipRow from "../FilterChipRow";

/**
 * A fileira de filtros, e o EC-229: o chip de origem veste o logo do banco.
 *
 * Reconhecer o roxo do Nubank é mais rápido do que ler "Ultravioleta
 * ····1234" numa fileira rolante — e o filtro fica reconhecível sem ler.
 */
describe("Fileira de filtros", () => {
  it("o chip escolhido se anuncia como escolhido", () => {
    const { getByLabelText } = render(
      <FilterChipRow
        options={[
          { key: "tudo", label: "Tudo" },
          { key: "c1", label: "Nubank" },
        ]}
        value="c1"
        onChange={jest.fn()}
        spokenPrefix="Origem"
      />,
    );

    expect(getByLabelText("Origem: Nubank").props.accessibilityState.selected).toBe(
      true,
    );
  });

  it("tocar num chip inativo troca o filtro", () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(
      <FilterChipRow
        options={[
          { key: "tudo", label: "Tudo" },
          { key: "c1", label: "Nubank" },
        ]}
        value="tudo"
        onChange={onChange}
        spokenPrefix="Origem"
      />,
    );

    fireEvent.press(getByLabelText("Origem: Nubank"));

    expect(onChange).toHaveBeenCalledWith("c1");
  });

  it("tocar no chip JÁ ativo não redispara a busca", () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(
      <FilterChipRow
        options={[{ key: "c1", label: "Nubank" }]}
        value="c1"
        onChange={onChange}
        spokenPrefix="Origem"
      />,
    );

    fireEvent.press(getByLabelText("Origem: Nubank"));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("a contagem entra na frase falada, no singular e no plural", () => {
    const { getByLabelText } = render(
      <FilterChipRow
        options={[
          { key: "a", label: "Inter", count: 1 },
          { key: "b", label: "Nubank", count: 18 },
        ]}
        value="a"
        onChange={jest.fn()}
        spokenPrefix="Origem"
      />,
    );

    expect(getByLabelText("Origem: Inter, 1 lançamento")).toBeTruthy();
    expect(getByLabelText("Origem: Nubank, 18 lançamentos")).toBeTruthy();
  });

  it("sem opção nenhuma, a fileira não ocupa espaço", () => {
    const { toJSON } = render(
      <FilterChipRow
        options={[]}
        value=""
        onChange={jest.fn()}
        spokenPrefix="Origem"
      />,
    );

    expect(toJSON()).toBeNull();
  });

  it("EC-229: o chip de origem veste o logo do banco", () => {
    const { UNSAFE_root } = render(
      <FilterChipRow
        options={[{ key: "c1", label: "Ultravioleta", brand: "Nubank" }]}
        value="c1"
        onChange={jest.fn()}
        spokenPrefix="Origem"
      />,
    );

    expect(UNSAFE_root.findAllByType(Image).length).toBeGreaterThan(0);
  });

  it("marca desconhecida NÃO ganha placeholder cinza", () => {
    // Placeholder só acrescenta ruído sem acrescentar reconhecimento
    const { UNSAFE_root } = render(
      <FilterChipRow
        options={[{ key: "x", label: "Tudo", brand: null }]}
        value="x"
        onChange={jest.fn()}
        spokenPrefix="Origem"
      />,
    );

    expect(UNSAFE_root.findAllByType(Image)).toHaveLength(0);
  });
});
