import React from "react";
import { StyleSheet } from "react-native";
import { act, render } from "@testing-library/react-native";
import Skeleton from "../Skeleton";

describe("Skeleton Component", () => {
  it("aplica os padrões de dimensão e raio no contêiner", () => {
    const tree = render(<Skeleton />).toJSON() as any;
    const style = StyleSheet.flatten(tree.props.style);

    expect(style).toMatchObject({
      width: "100%",
      height: 20,
      borderRadius: 12,
      overflow: "hidden",
    });
  });

  it("respeita width, height e borderRadius informados (API retrocompatível)", () => {
    const tree = render(
      <Skeleton width={120} height={48} borderRadius={8} />,
    ).toJSON() as any;
    const style = StyleSheet.flatten(tree.props.style);

    expect(style).toMatchObject({ width: 120, height: 48, borderRadius: 8 });
  });

  it("monta a faixa de varredura somente depois de medir a largura", () => {
    const result = render(<Skeleton />);
    const before = result.toJSON() as any;

    // Antes do onLayout não há largura medida — nada de overlay
    expect(before.children).toBeNull();

    act(() => {
      before.props.onLayout({
        nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 20 } },
      });
    });

    const after = result.toJSON() as any;
    expect(after.children).toHaveLength(1);
  });
});
