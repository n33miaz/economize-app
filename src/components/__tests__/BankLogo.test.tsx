import React from "react";
import { Image, StyleSheet } from "react-native";
import { render } from "@testing-library/react-native";
import Landmark from "lucide-react-native/dist/esm/icons/landmark";

import BankLogo from "../BankLogo";

describe("BankLogo", () => {
  it("com logo, mostra a imagem e fala o nome da instituição", () => {
    const tela = render(<BankLogo institution="Nubank" />);

    expect(tela.getByLabelText("Nubank")).toBeTruthy();
    expect(tela.UNSAFE_getAllByType(Image)).toHaveLength(1);
    // Com o PNG na tela, o monograma não pode aparecer por baixo
    expect(tela.queryByText("N")).toBeNull();
  });

  it("sem logo, o monograma assume — e o rótulo falado continua sendo o nome", () => {
    const tela = render(<BankLogo institution="Flash" />);

    expect(tela.getByText("F")).toBeTruthy();
    expect(tela.getByLabelText("Flash")).toBeTruthy();
    expect(tela.UNSAFE_queryAllByType(Image)).toHaveLength(0);
  });

  it("sem instituição nenhuma, o ícone de apoio ocupa a moldura", () => {
    const tela = render(<BankLogo institution={null} Fallback={Landmark} />);

    expect(tela.UNSAFE_getAllByType(Landmark)).toHaveLength(1);
    expect(tela.UNSAFE_queryAllByType(Image)).toHaveLength(0);
  });

  it("o tamanho vai no style, nunca em className", () => {
    // `className` de largura/altura não alcança <Image> na web; o quadrado
    // precisa sair do style para a lista não ficar com logos de tamanhos
    // diferentes
    const tela = render(<BankLogo institution="Banco Inter S.A." size={40} />);

    const imagem = tela.UNSAFE_getByType(Image);
    expect(StyleSheet.flatten(imagem.props.style)).toMatchObject({
      width: 40,
      height: 40,
    });
    expect(imagem.props.resizeMode).toBe("cover");
  });

  it("aceita acento e caixa diferentes na hora de escolher o logo", () => {
    const tela = render(<BankLogo institution="ITAÚ UNIBANCO" />);

    expect(tela.UNSAFE_getAllByType(Image)).toHaveLength(1);
    expect(tela.getByLabelText("ITAÚ UNIBANCO")).toBeTruthy();
  });
});
