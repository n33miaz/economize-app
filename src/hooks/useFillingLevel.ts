import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "react-native-reanimated";

import { POT_STEPS } from "../components/potSteps";

/**
 * O pote que enche — EC-223.
 *
 * <p><b>Por que degrau, e não interpolação contínua.</b> O pote não é um
 * tanque de líquido: o que ele mostra é uma <i>quantidade de coisas</i>. Cada
 * degrau de {@link POT_STEPS} é o instante em que uma moeda nova (ou uma
 * cédula) passa a caber lá dentro. Animar o número de forma contínua a 60 fps
 * redesenharia o SVG sessenta vezes por segundo para trocar de desenho sete —
 * o resto seriam quadros idênticos, pagos.
 *
 * <p>Então a animação anda pelos degraus: uma peça entra, depois a seguinte.
 * É literalmente "as moedas subindo até a altura do valor", e sai de graça em
 * processamento.
 *
 * <p><b>Desacelerando no fim.</b> O intervalo entre degraus cresce conforme se
 * aproxima do alvo. Um enchimento linear parece uma barra de progresso; este
 * parece alguém despejando moedas, que é a diferença entre uma animação
 * mecânica e uma que dá satisfação.
 *
 * <p><b>Sem movimento, sem espera.</b> Com "reduzir movimento" ligado no
 * aparelho, o valor final aparece no primeiro quadro — a animação é enfeite,
 * e enfeite nunca atrasa a informação.
 */

/**
 * Intervalo do primeiro degrau. Os seguintes crescem.
 *
 * Com os sete degraus de hoje, o enchimento inteiro leva cerca de 610 ms — a
 * mesma ordem de grandeza da contagem de {@code AnimatedMoney}, para que o
 * número e o pote terminem juntos em vez de um esperar o outro.
 */
const PASSO_MS = 55;

/** O quanto cada degrau é mais lento que o anterior. */
const DESACELERACAO = 1.15;

/**
 * O nível a desenhar agora.
 *
 * @param target  o nível real, de 0 a 1
 * @param animate false devolve o alvo direto — é o padrão para o pote pequeno
 *                do cabeçalho, que reaparece a cada foco e ficaria piscando
 */
export function useFillingLevel(target: number, animate: boolean): number {
  const reduzido = useReducedMotion();
  const alvo = Math.max(0, Math.min(1, Number.isFinite(target) ? target : 0));

  const [nivel, setNivel] = useState(animate && !reduzido ? 0 : alvo);
  // Guarda os timers para o desmonte não deixar nenhum de pé: um `setNivel`
  // depois do desmonte é aviso no console e, em lista, vazamento de verdade
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];

    if (!animate || reduzido) {
      setNivel(alvo);
      return;
    }

    // Só os degraus que ficam ABAIXO do alvo entram na subida; o último salto
    // é para o alvo exato, senão o pote pararia num degrau e não no valor
    const degraus = POT_STEPS.filter((passo) => passo < alvo);
    setNivel(0);

    let acumulado = 0;
    let intervalo = PASSO_MS;
    [...degraus, alvo].forEach((passo) => {
      acumulado += intervalo;
      intervalo *= DESACELERACAO;
      timers.current.push(setTimeout(() => setNivel(passo), acumulado));
    });

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [alvo, animate, reduzido]);

  return nivel;
}
