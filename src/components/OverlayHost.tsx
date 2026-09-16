import React, { useEffect } from "react";
import { View } from "react-native";

import { useOverlayStore } from "../store/overlayStore";
import { boxNone } from "../utils/pointerEvents";

/**
 * Desenha as folhas do app acima de tudo — inclusive da barra de abas.
 *
 * <p>Fica DENTRO do `NavigationContainer` e DEPOIS do navegador: dentro para
 * que o conteúdo continue enxergando o contexto de navegação, depois para
 * ficar por cima da barra de baixo. Desenhar a folha na própria tela, que era
 * a alternativa óbvia, deixava o botão do rodapé escondido atrás das abas —
 * medido no emulador.
 *
 * <p>`box-none` na camada de fora: onde não há folha aberta, o toque atravessa
 * e chega no app normalmente. O que bloqueia a interação é o fundo escuro de
 * cada folha, e só enquanto ela existe.
 *
 * <p>O porquê de tudo isto (o `Modal` do Android sem toque na nova
 * arquitetura) está em `store/overlayStore.ts`.
 */
export default function OverlayHost() {
  const layers = useOverlayStore((s) => s.layers);
  const registerHost = useOverlayStore((s) => s.registerHost);
  const unregisterHost = useOverlayStore((s) => s.unregisterHost);

  useEffect(() => {
    registerHost();
    return unregisterHost;
  }, [registerHost, unregisterHost]);

  if (layers.length === 0) return null;

  return (
    <View
      style={[
        { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
        boxNone,
      ]}
    >
      {layers.map((camada) => (
        <View
          key={camada.id}
          style={[
            { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
            boxNone,
          ]}
        >
          {camada.node}
        </View>
      ))}
    </View>
  );
}
