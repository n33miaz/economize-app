import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";

export const fadeTransition: NativeStackNavigationOptions = {
  animation: "fade",
  animationDuration: 220,
};

export const slideRightTransition: NativeStackNavigationOptions = {
  animation: "slide_from_right",
  animationDuration: 260,
};

export const modalLikeTransition: NativeStackNavigationOptions = {
  animation: "slide_from_bottom",
  animationDuration: 280,
  presentation: "modal",
  gestureEnabled: true,
};

// Padrão único das telas efêmeras abertas da Home (Profile, Opções avançadas,
// Relatórios, Notícias, Análise): slide_from_right aqui + fade do conteúdo
// no PageContainer. About e Assistente permanecem com o modalLike acima.
export const ephemeralTransition: NativeStackNavigationOptions = {
  animation: "slide_from_right",
  animationDuration: 240,
  presentation: "card",
};
