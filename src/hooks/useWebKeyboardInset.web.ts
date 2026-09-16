import { useEffect, useState } from "react";

/**
 * Abaixo disto não é teclado. O Safari do iPhone encolhe e estica o viewport
 * visual em alguns pixels quando a barra de endereço recolhe ao rolar; um
 * teclado virtual tem sempre mais de 200. O piso evita que a folha "pule"
 * a cada rolagem por causa de uma diferença que não é teclado.
 */
const KEYBOARD_FLOOR_PX = 40;

/**
 * Altura do teclado virtual no navegador, em px de CSS — zero quando fechado.
 *
 * <p>Na web o `KeyboardAvoidingView` não faz nada: o navegador não avisa o
 * app que um teclado abriu. O que ele expõe é o `window.visualViewport`, que
 * ENCOLHE quando o teclado sobe enquanto `window.innerHeight` fica do mesmo
 * tamanho. A diferença entre os dois é o teclado. Foi assim que a folha de
 * nova transação passou a subir junto com o campo em foco no iPhone, em vez
 * de deixá-lo escondido atrás das teclas.
 *
 * <p>O `scale` entra na conta porque, com zoom de pinça, o viewport visual
 * também encolhe — mas em px de CSS multiplicados pelo zoom ele volta a ter o
 * tamanho da janela, e a diferença dá zero. Sem isso, dar zoom abria um
 * "teclado" imaginário debaixo da folha.
 *
 * <p>Tudo dentro de `try`: em navegador sem `visualViewport` (ou em ambiente
 * de teste sem DOM) o hook simplesmente devolve zero, que é o comportamento
 * de antes dele existir.
 */
export function useWebKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    try {
      const viewport = window.visualViewport;
      if (!viewport) return undefined;

      const medir = () => {
        const escala = viewport.scale || 1;
        const diferenca =
          window.innerHeight - Math.round(viewport.height * escala);
        setInset(diferenca >= KEYBOARD_FLOOR_PX ? diferenca : 0);
      };

      medir();
      viewport.addEventListener("resize", medir);
      return () => viewport.removeEventListener("resize", medir);
    } catch {
      // Sem DOM utilizável não há teclado a medir: fica o zero inicial
      return undefined;
    }
  }, []);

  return inset;
}
