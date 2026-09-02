import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAccountsStore } from "../store/accountsStore";
import { useAiSettingsStore } from "../store/aiSettingsStore";
import { useAuthStore } from "../store/authStore";
import { usePreferencesStore } from "../store/preferencesStore";
import { useFavoritesStore } from "../store/favoritesStore";
import { useIndicatorStore } from "../store/indicatorStore";
import { useAiStore } from "../store/aiStore";
import { useUserStore } from "../store/userStore";
import { useBankStore } from "../store/bankStore";
import { useWalletStore } from "../store/walletStore";
import { useReportsStore } from "../store/reportsStore";
import { useCategoriesStore } from "../store/categoriesStore";
import { useFamilyStore } from "../store/familyStore";

// Apaga o rastro local do app (EC-104): o storage inteiro e o estado em
// memória dos stores persistidos, terminando no logout — que troca a árvore
// de navegação para o Login. A ordem importa: com o storage limpo primeiro,
// cada reset regrava apenas os defaults, o estado de primeira instalação.
export async function clearLocalData(): Promise<void> {
  await AsyncStorage.clear();

  // reset() zera inclusive biometricChoiceMade: sem dados locais, o modal do
  // login volta a oferecer a escolha da biometria — coerente com um app recém
  // instalado
  usePreferencesStore.getState().reset();
  useFavoritesStore.setState({ favorites: [] });
  // os retratos dos favoritos (EC-105) também são persistidos: sem zerar a
  // memória, o próximo set() do store regravava o rastro apagado no disco
  useIndicatorStore.setState({ favoriteSnapshots: [] });
  useAiStore.getState().clearHistory();

  // o perfil em memória também é dado local: sem limpar, um próximo login
  // veria os dados do usuário anterior até o fetch responder
  useUserStore.setState({ me: null, error: null });

  // dado financeiro em memória é o rastro mais sensível de todos: sem estes
  // resets, um login com OUTRA conta exibiria o extrato/carteira anteriores
  // até o refetch responder (as telas pulam o skeleton quando o store tem itens)
  useBankStore.setState({ transactions: [] });
  useWalletStore.setState({ transactions: [] });
  useReportsStore.setState({ items: [] });
  useCategoriesStore.setState({ items: [] });
  // contas e faturas (EC-113) são o pior caso desta lista: guardam nome do
  // cartão, instituição e cada lançamento de cada fatura — e, por causa do
  // cache de `hasLoadedOnce`, não se corrigiriam nem depois do refetch, porque
  // refetch nenhum sai. O `logout()` abaixo repete este reset para as saídas
  // que não passam por aqui; a chamada explícita fica porque esta lista é o
  // inventário auditável do que morre com o aparelho.
  useAccountsStore.getState().reset();
  // opções de IA: provedor, modelo e os 4 últimos dígitos da chave do usuário
  useAiSettingsStore.getState().reset();
  // a casa (EC-150): nome e números de OUTRAS pessoas, mais o código de
  // convite emitido nesta sessão — o único rastro aqui que não é do dono
  useFamilyStore.getState().reset();

  useAuthStore.getState().logout();
}
