/**
 * As teclas do teclado de números do app — a regra, sem a tela.
 *
 * <p>Por que existe um teclado nosso: no corredor do mercado o dono digita
 * quarenta preços. O teclado do sistema abre, a janela do Android encolhe, a
 * folha se remonta, e a cada troca entre o nome (letras) e o preço (números)
 * isso acontece de novo. O teclado do app não encolhe janela nenhuma: as
 * teclas são grandes, o botão de adicionar fica logo abaixo delas e nada se
 * mexe entre um item e o outro.
 *
 * <p>Tudo o que decide o que aparece no campo está aqui, em função pura, e
 * não dentro do componente: é o que permite provar as bordas (dois decimais,
 * uma vírgula só, apagar até o vazio) sem montar tela nenhuma.
 */

/** Centavos são dois — o terceiro toque na tecla não faz nada. */
export const MAX_DECIMAIS = 2;

/** Sete dígitos antes da vírgula: R$ 9.999.999,99 cobre qualquer compra. */
export const MAX_INTEIROS = 7;

export type Tecla =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | ","
  | "apagar"
  | "limpar";

/**
 * O que o campo passa a mostrar depois de uma tecla.
 *
 * <p>Devolve o valor ANTERIOR quando a tecla não cabe (terceiro decimal,
 * segunda vírgula, oitavo inteiro). Ignorar em silêncio é melhor que piscar
 * um erro: quem errou a tecla já viu que o número não mudou.
 */
export function digitar(atual: string, tecla: Tecla): string {
  if (tecla === "limpar") return "";
  if (tecla === "apagar") return atual.slice(0, -1);

  const partes = atual.split(",");
  const inteiros = partes[0] ?? "";
  const decimais = partes.length > 1 ? partes[1] : null;

  if (tecla === ",") {
    if (decimais !== null) return atual;
    // Vírgula em campo vazio vira "0," — ninguém quer ver ",50"
    return (inteiros === "" ? "0" : inteiros) + ",";
  }

  if (decimais !== null) {
    if (decimais.length >= MAX_DECIMAIS) return atual;
    return atual + tecla;
  }

  // Zero à esquerda não se acumula: "0" e depois "5" é 5, não 05
  if (inteiros === "0") return tecla;
  if (inteiros.length >= MAX_INTEIROS) return atual;
  return inteiros + tecla;
}

/** As teclas na ordem em que aparecem, linha por linha. */
export const LINHAS: Tecla[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [",", "0", "apagar"],
];

/** Como o leitor de tela anuncia cada tecla. */
export function rotuloDaTecla(tecla: Tecla): string {
  if (tecla === "apagar") return "Apagar o último número";
  if (tecla === "limpar") return "Limpar o valor";
  if (tecla === ",") return "Vírgula";
  return tecla;
}
