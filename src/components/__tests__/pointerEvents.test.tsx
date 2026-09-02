import fs from "fs";
import path from "path";

import React from "react";
import { StyleSheet } from "react-native";
import { render } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import Toast from "../Toast";
import { boxNone } from "../../utils/pointerEvents";

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 1280, height: 860 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

type No = { props?: { style?: unknown }; children?: unknown } | null;

/** O primeiro estilo achatado da árvore que satisfaz o teste. */
function procura(
  no: unknown,
  aceita: (estilo: Record<string, unknown> | undefined) => boolean,
): Record<string, unknown> | undefined {
  if (!no || typeof no !== "object") return undefined;
  const atual = no as NonNullable<No>;
  const estilo = StyleSheet.flatten(atual.props?.style) as
    | Record<string, unknown>
    | undefined;
  if (aceita(estilo)) return estilo;
  const filhos = Array.isArray(atual.children) ? atual.children : [];
  for (const filho of filhos) {
    const achado = procura(filho, aceita);
    if (achado) return achado;
  }
  return undefined;
}

describe("camadas que flutuam sobre o app", () => {
  it("box-none sai de StyleSheet.create, não de objeto solto", () => {
    // O valor precisa passar pelo compilador de estilos do react-native-web:
    // é ele que emite `none` no contêiner e `auto` nos filhos. Inline, o
    // navegador descarta `pointer-events: box-none` por ser inválido e o
    // contêiner volta a capturar clique
    expect(StyleSheet.flatten(boxNone)).toEqual({ pointerEvents: "box-none" });
  });

  it("a camada do toast não captura clique", () => {
    const { toJSON } = render(
      <SafeAreaProvider initialMetrics={METRICAS}>
        <Toast />
      </SafeAreaProvider>,
    );

    // A camada é procurada pelo zIndex e não pela posição na árvore: assim o
    // teste sobrevive a um provider a mais em volta
    const camada = procura(toJSON(), (estilo) => estilo?.zIndex === 9999);

    // Ela cobre a tela inteira só para posicionar o aviso no topo. Capturando
    // clique, cega o app inteiro — e sem desenhar nada que denuncie a causa
    expect(camada).toMatchObject({ pointerEvents: "box-none" });
  });

  it("nenhum estilo inline no app declara box-none", () => {
    // Guarda de fonte porque o sintoma é invisível: nada quebra no console,
    // nada muda na tela, e o app inteiro para de responder ao mouse na web
    const raiz = path.join(__dirname, "..", "..");
    const correto = path.join("utils", "pointerEvents.ts");
    const suspeitos: string[] = [];

    const varre = (dir: string) => {
      for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
        const alvo = path.join(dir, entrada.name);
        // Testes falam SOBRE o padrão: citá-lo aqui não põe camada nenhuma
        // na tela
        if (entrada.isDirectory()) {
          if (entrada.name !== "__tests__") varre(alvo);
        } else if (/\.tsx?$/.test(entrada.name) && !alvo.endsWith(correto)) {
          if (
            /pointerEvents:\s*["']box-(none|only)["']/.test(
              fs.readFileSync(alvo, "utf8"),
            )
          ) {
            suspeitos.push(path.relative(raiz, alvo));
          }
        }
      }
    };
    varre(raiz);

    expect(suspeitos).toEqual([]);
  });
});
