import { useEffect, useRef, useState } from "react";

import {
  WAITING_STEP_MS,
  waitingLine,
  type WaitingKind,
} from "../utils/waitingLines";
import { useLoadingDeadline } from "./useLoadingDeadline";

/**
 * A legenda da vez, trocando sozinha enquanto o trabalho corre — EC-224.
 *
 * <p>Junta as duas metades: a sequência com voz (`waitingLines`) e o prazo
 * (`useLoadingDeadline`). Passado o prazo, a legenda deixa de prometer — é o
 * que separa isto do laço infinito do concorrente, que passou treze minutos
 * alternando frases sem nunca responder.
 *
 * @returns a frase, ou `null` quando não há trabalho em andamento
 */
export function useWaitingLine(
  kind: WaitingKind,
  active: boolean,
): string | null {
  const [decorrido, setDecorrido] = useState(0);
  const estourou = useLoadingDeadline(active);
  // Ref, e não estado: o instante de início não deve provocar re-render, e
  // guardá-lo em estado criaria um ciclo com o efeito que o define
  const inicio = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      inicio.current = null;
      setDecorrido(0);
      return;
    }
    inicio.current = Date.now();
    setDecorrido(0);
    const id = setInterval(() => {
      if (inicio.current !== null) setDecorrido(Date.now() - inicio.current);
    }, WAITING_STEP_MS);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return null;
  return waitingLine(kind, decorrido, estourou);
}
