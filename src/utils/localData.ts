import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuthStore } from "../store/authStore";
import { usePreferencesStore } from "../store/preferencesStore";

// Apaga o rastro local do app (EC-104): o storage inteiro e o estado em
// memória dos stores, terminando no logout — que troca a árvore de navegação
// para o Login. A ordem importa: com o storage limpo primeiro, cada reset
// regrava apenas os defaults, o estado de primeira instalação.
//
// A diferença para um logout comum é só o que está nas duas primeiras linhas:
// o disco inteiro (inclusive o segredo que dispensa o segundo fator neste
// aparelho) e as preferências do APARELHO, que uma troca de conta preserva.
// Tudo o que é de quem estava logado — extrato, carteira, contas, conversa,
// favoritos, carrinho — é apagado pelo `logout()`, pelo manifesto de
// `store/sessionReset`. A lista que vivia aqui, store por store, saiu: era uma
// segunda cópia do mesmo inventário, e foi com duas cópias que o `logout()` ficou
// sem limpar o extrato.
export async function clearLocalData(): Promise<void> {
  await AsyncStorage.clear();

  // reset() zera inclusive biometricChoiceMade: sem dados locais, o modal do
  // login volta a oferecer a escolha da biometria — coerente com um app recém
  // instalado
  usePreferencesStore.getState().reset();

  useAuthStore.getState().logout();
}
