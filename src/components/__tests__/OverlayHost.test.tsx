import fs from "fs";
import path from "path";
import React from "react";
import { Text } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import CustomModal from "../CustomModal";
import OverlayHost from "../OverlayHost";
import { useOverlayStore } from "../../store/overlayStore";

/**
 * O andar de cima do app.
 *
 * <p><b>O defeito que trouxe isto, com data.</b> Em 15/09/2026 o dono relatou
 * três coisas que pareciam três: o pote não abria, o "Sair" desenhava cacos no
 * canto superior esquerdo, e os detalhes do extrato faziam o mesmo. Era uma
 * só — o {@code Modal} do Android na nova arquitetura (`newArchEnabled`, RN
 * 0.76.9) nasce com caixa de layout de tamanho zero: o conteúdo pinta fora dos
 * limites, mas o Android <b>não entrega toque</b> fora deles. A folha aparecia
 * e nenhum botão dentro dela respondia.
 *
 * <p>Por isso as folhas passaram a ser camadas do próprio app. O teste guarda
 * as duas metades da decisão: a camada chega ao host, e ninguém volta a
 * importar {@code Modal}.
 */
const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const comProvedor = (no: React.ReactNode) =>
  render(<SafeAreaProvider initialMetrics={METRICAS}>{no}</SafeAreaProvider>);

describe("OverlayHost", () => {
  beforeEach(() => {
    useOverlayStore.setState({ layers: [], hostMounted: false });
  });

  it("sem host na árvore, a folha desenha no lugar", () => {
    comProvedor(
      <CustomModal visible onClose={jest.fn()}>
        <Text>conteúdo da folha</Text>
      </CustomModal>,
    );

    expect(screen.getByText("conteúdo da folha")).toBeTruthy();
  });

  it("com host, a folha é desenhada pelo host — e uma vez só", () => {
    comProvedor(
      <>
        <CustomModal visible onClose={jest.fn()}>
          <Text>conteúdo da folha</Text>
        </CustomModal>
        <OverlayHost />
      </>,
    );

    // Duas cópias significariam a folha desenhada no lugar E no host: é o
    // erro que o `hostMounted` existe para evitar
    expect(screen.getAllByText("conteúdo da folha")).toHaveLength(1);
    expect(useOverlayStore.getState().layers).toHaveLength(1);
  });

  it("o toque no botão de dentro chega — que é o que o Modal não entregava", () => {
    const onClose = jest.fn();
    comProvedor(
      <>
        <CustomModal visible onClose={onClose}>
          <Text accessibilityRole="button" onPress={onClose}>
            Entendi
          </Text>
        </CustomModal>
        <OverlayHost />
      </>,
    );

    fireEvent.press(screen.getByText("Entendi"));

    expect(onClose).toHaveBeenCalled();
  });

  it("tela desmontada não deixa camada órfã pairando sobre o app", () => {
    const { unmount } = comProvedor(
      <>
        <CustomModal visible onClose={jest.fn()}>
          <Text>conteúdo da folha</Text>
        </CustomModal>
        <OverlayHost />
      </>,
    );

    expect(useOverlayStore.getState().layers).toHaveLength(1);
    unmount();
    expect(useOverlayStore.getState().layers).toHaveLength(0);
  });

  /**
   * A catraca. O `Modal` volta fácil: é o que todo exemplo da internet usa, e
   * ele "funciona" o bastante para passar na revisão — desenha. O que ele não
   * faz é aceitar toque, e isso só aparece com o app no aparelho.
   */
  it("ninguém importa Modal do react-native", () => {
    const raiz = path.resolve(__dirname, "..", "..");
    const suspeitos: string[] = [];

    const varrer = (dir: string) => {
      for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const caminho = path.join(dir, item.name);
        if (item.isDirectory()) {
          varrer(caminho);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(item.name)) continue;
        if (caminho.includes("__tests__")) continue;
        const fonte = fs.readFileSync(caminho, "utf8");
        // `Modal` na lista de importação do react-native — o que pega
        // `import { Modal }` e `import { View, Modal, Text }` sem pegar
        // `CustomModal`, `accessibilityViewIsModal` ou a palavra em comentário
        const imports = fonte.match(
          /import\s*\{[^}]*\}\s*from\s*["']react-native["']/gs,
        );
        if (imports?.some((bloco) => /(^|[{,\s])Modal\s*(,|\})/.test(bloco))) {
          suspeitos.push(path.relative(raiz, caminho));
        }
      }
    };

    varrer(raiz);

    expect(suspeitos).toEqual([]);
  });
});
