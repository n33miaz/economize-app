import { createContext } from "react";

/**
 * Altura da barra de abas de baixo, sem o inset da borda do aparelho.
 *
 * <p>84 dá folga para o ícone da Home (28, ~30 no pico do pop) mais o rótulo,
 * dentro do `overflow: hidden` da barra. Com 70 o rótulo era cortado sempre
 * que não havia barra de gestos para somar.
 */
export const BOTTOM_BAR_HEIGHT = 84;

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
 * rodar</b> só por causa desse import. O app já desenha a própria barra e já
 * sabe a altura dela: usar o número que ele mesmo calculou não custa
 * dependência nenhuma.
 *
 * <p>`undefined` é a resposta para "não estou sob uma barra" — é o que o
 * desktop (onde navega o trilho lateral) e as telas de pilha recebem.
 */
export const TabBarHeightContext = createContext<number | undefined>(undefined);
