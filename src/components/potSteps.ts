/**
 * Os degraus em que o pote ganha uma peça nova.
 *
 * <p>Moram aqui, e não dentro de {@code PotIcon}, porque duas coisas precisam
 * deles e importar o componente só para ler números arrastaria o SVG inteiro
 * para dentro de um hook.
 *
 * <p><b>Eles são a régua do desenho, não uma cópia dela.</b> Cada valor é o
 * ponto em que uma moeda ou cédula passa a caber no pote — os mesmos
 * comparados em {@code PotIcon}. Um teste percorre o componente em cada degrau
 * e cobra que o desenho realmente mude ali: se alguém ajustar um limite no
 * componente e esquecer desta lista, a suíte reprova em vez de a animação
 * ficar com um passo morto no meio.
 */
export const POT_STEPS = [0.05, 0.15, 0.28, 0.55, 0.7, 0.9] as const;
