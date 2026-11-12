import { createContext } from "react";

/**
 * A ILHA: a barra de abas deixou de ser uma faixa encostada no rodapé.
 *
 * <p>Escolha do dono em 16/09/2026, no comparador antes-e-depois: <i>"ilha
 * flutuante que se esconde ao rolar"</i>. A barra virou um bloco arredondado de
 * 64 px, afastado das três bordas, com o conteúdo passando por baixo — e ela
 * some quando a pessoa rola para baixo, devolvendo a tela inteira para ler.
 *
 * <p>Isso importa mais aqui do que parece: o alvo declarado é o <b>Safari de um
 * iPhone 12 com a barra de busca em cima</b>, onde sobram <b>664 px</b> de
 * altura útil, não os 844 da tela. Cada faixa fixa custa uma fração grande do
 * que a pessoa vê sem rolar.
 */
export const ILHA_ALTURA = 64;

/** Respiro entre a ilha e a borda de baixo (ou a barra de gestos). */
export const ILHA_RESPIRO = 12;

/** Afastamento lateral da ilha. */
export const ILHA_LATERAL = 14;

/**
 * Quanto a barra ocupa, do ponto de vista de quem precisa afastar conteúdo
 * do rodapé.
 *
 * <p>Era 84 — a altura da faixa antiga, que empurrava a cena inteira para
 * cima. Agora a ilha flutua sobre o conteúdo, então o número é só o quanto ela
 * cobre: a própria altura mais o respiro de baixo. O nome continua o mesmo de
 * propósito — quem consome isto quer saber "quanto reservar no rodapé", e a
 * resposta segue sendo uma só.
 */
export const BOTTOM_BAR_HEIGHT = ILHA_ALTURA + ILHA_RESPIRO;

/** Inset inferior da área segura, saneado: ausente, NaN ou negativo vale zero. */
const insetSeguro = (insetBottom: number | null | undefined): number =>
  typeof insetBottom === "number" && Number.isFinite(insetBottom) && insetBottom > 0
    ? insetBottom
    : 0;

/**
 * A que distância da borda de baixo a ilha é desenhada.
 *
 * <p>É a ÚNICA fonte da posição da ilha — a barra usa isto no `bottom` dela,
 * e `ilhaCoverage` (o que as listas reservam) é derivado daqui. Eram duas
 * contas: a ilha subia pelo inset real, e o contexto de altura só somava o
 * inset no iOS e na web. Num Android de borda a borda com 24 px de inset a
 * ilha cobria 100 px e as listas reservavam 92.
 */
export const ilhaBottom = (insetBottom: number | null | undefined): number =>
  insetSeguro(insetBottom) + ILHA_RESPIRO;

/** Quanto a ilha cobre do rodapé da cena: até o topo dela, a partir da borda. */
export const ilhaCoverage = (insetBottom: number | null | undefined): number =>
  ilhaBottom(insetBottom) + ILHA_ALTURA;

/**
 * Quanto a barra de abas ocupa na cena — ou `undefined` quando não há barra.
 *
 * <p><b>O defeito que isto corrige.</b> O botão do assistente sempre somou
 * `insets.bottom` ao respiro do rodapé. Numa tela de pilha está certo: o
 * rodapé é a borda do aparelho, e a barra de gestos do iPhone come 34 px dali.
 * Dentro de uma ABA, não: a barra inferior já paga esse inset (é ela que
 * encosta na borda), mas o contexto de área segura da cena continua devolvendo
 * os 34 mesmo assim. Medido em 16/09/2026 na web a 390 px com inset de 34
 * emulado: na Home o botão flutuava 54 px acima da barra, contra 20 numa tela
 * de pilha — o dobro do respiro, e visivelmente solto sobre o calendário.
 *
 * <p><b>Por que um contexto nosso, e não o `BottomTabBarHeightContext` do
 * React Navigation.</b> Importá-lo puxa o índice de `@react-navigation/bottom-tabs`,
 * e o índice arrasta o `createBottomTabNavigator`, que na versão instalada
 * chama um `createScreenFactory` que o `@react-navigation/native@7.3.18`
 * (travado de propósito — ver `utils/__tests__/pinnedStack.test.ts`) não
 * exporta. Em produção o bundler resolve o build compilado e nada quebra; no
 * Jest, que transforma o pacote a partir do `src`, <b>dez suítes deixavam de
 * montar</b>. Um contexto de uma linha custa menos que esse acoplamento.
 */
export const TabBarHeightContext = createContext<number | undefined>(undefined);
