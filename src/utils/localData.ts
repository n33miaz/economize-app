import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuthStore } from "../store/authStore";
import { usePreferencesStore } from "../store/preferencesStore";
import { clearPersonalData } from "../store/sessionReset";

// Apaga o rastro local do app (EC-104): o storage inteiro e o estado em
// memória dos stores, terminando no logout — que troca a árvore de navegação
// para o Login. A ordem importa: com o storage limpo primeiro, cada reset
// regrava apenas os defaults, o estado de primeira instalação.
//
// A diferença para um logout comum: o disco inteiro (inclusive o segredo que
// dispensa o segundo fator neste aparelho), as preferências do APARELHO, e o
// que é da pessoa e só existe aqui — a conversa com o Nino, os favoritos —,
// que um logout comum guarda para a volta dela. O cache do servidor (extrato,
// carteira, contas, carrinho) é apagado pelo `logout()`, pelo manifesto de
// `store/sessionReset`. A lista que vivia aqui, store por store, saiu: era uma
// segunda cópia do mesmo inventário, e foi com duas cópias que o `logout()` ficou
// sem limpar o extrato.
export async function clearLocalData(): Promise<void> {
  await AsyncStorage.clear();

  // reset() zera inclusive biometricChoiceMade: sem dados locais, o modal do
  // login volta a oferecer a escolha da biometria — coerente com um app recém
  // instalado
  usePreferencesStore.getState().reset();

  // "Apagar dados locais" não espera a próxima pessoa para decidir: apaga
  // agora, e esquece quem foi a última — senão o `set` do logout abaixo
  // regravaria no disco recém-limpo o rastro de quem usou o aparelho
  clearPersonalData();
  useAuthStore.setState({ lastUserKey: null });

  useAuthStore.getState().logout();
}
