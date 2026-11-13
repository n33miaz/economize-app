import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  Share,
  Switch,
} from "react-native";
import Bell from "lucide-react-native/dist/esm/icons/bell";
import CircleAlert from "lucide-react-native/dist/esm/icons/circle-alert";
import Eye from "lucide-react-native/dist/esm/icons/eye";
import LifeBuoy from "lucide-react-native/dist/esm/icons/life-buoy";
import FileUp from "lucide-react-native/dist/esm/icons/file-up";
import Trash from "lucide-react-native/dist/esm/icons/trash";
import { useNavigation } from "@react-navigation/native";
import * as FileSystem from "expo-file-system";
import Animated from "react-native-reanimated";

import { APP_ROUTES } from "../routes/routeNames";
import { useTheme } from "../theme/ThemeProvider";
import { spacing } from "../theme/ds";
import { useMotionPresets } from "../theme/motionPresets";
import { askConfirm } from "../store/confirmStore";
import { useAuthStore } from "../store/authStore";
import { useUserStore } from "../store/userStore";
import { useBankStore } from "../store/bankStore";
import { useWalletStore } from "../store/walletStore";
import { useCategoriesStore } from "../store/categoriesStore";
import {
  selectCycleAnchorDay,
  usePreferencesStore,
} from "../store/preferencesStore";
import { useToastStore } from "../store/toastStore";
import * as Haptics from "../utils/haptics";
import {
  buildExportPayload,
  exportFileName,
  serializeExportPayload,
} from "../utils/exportData";
import { clearLocalData } from "../utils/localData";

import ScreenHeader from "../components/ScreenHeader";
import PageContainer from "../components/PageContainer";
import Sparkles from "lucide-react-native/dist/esm/icons/sparkles";
import { tidyStatement } from "../services/api";
import ActionRow from "../components/ActionRow";
import SectionTitle from "../components/SectionTitle";

// Entrega o JSON como download de verdade: o navegador não tem o share sheet
// nativo confiável, mas Blob + âncora funciona em todos — sem lib nova
function downloadJsonOnWeb(json: string, fileName: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revogar na mesma volta do `click()` cancela o download no Safari: ele só
  // começa a ler o blob depois. Um segundo de folga basta e não vaza nada
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Entrega o JSON como ARQUIVO no aparelho, e não como texto do share sheet.
 *
 * `Share.share({ message: json })` atravessa o Binder do Android, que tem
 * teto de ~1 MB por transação: o extrato de dois anos passa disso e o app
 * morria com TransactionTooLargeException. Por isso o conteúdo vai para o
 * disco e só o endereço circula.
 *
 * - iOS: grava no cache e compartilha a URL do arquivo (o share sheet do iOS
 *   aceita `url` de arquivo local e oferece "Salvar em Arquivos").
 * - Android: o `Share` do React Native ignora `url` ali, e o `expo-sharing`
 *   (que abriria o share sheet com o arquivo) não está instalado. O caminho
 *   sem dependência nova é o Storage Access Framework do próprio
 *   expo-file-system: a pessoa escolhe a pasta (Downloads, Drive...) e o
 *   arquivo é gravado lá direto.
 *
 * Devolve `false` quando a pessoa desistiu de escolher a pasta.
 */
async function saveJsonOnDevice(json: string, fileName: string): Promise<boolean> {
  if (Platform.OS === "android") {
    const saf = FileSystem.StorageAccessFramework;
    const permissao = await saf.requestDirectoryPermissionsAsync();
    if (!permissao.granted) return false;
    // O SAF acrescenta a extensão pelo tipo: passar "x.json" viraria "x.json.json"
    const uri = await saf.createFileAsync(
      permissao.directoryUri,
      fileName.replace(/\.json$/, ""),
      "application/json",
    );
    await FileSystem.writeAsStringAsync(uri, json);
    return true;
  }
  const pasta = FileSystem.cacheDirectory;
  if (!pasta) throw new Error("Sem pasta de cache neste ambiente.");
  const fileUri = `${pasta}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, json);
  await Share.share({ title: fileName, url: fileUri });
  return true;
}

export default function AdvancedOptions() {
  const t = useTheme();
  const navigation = useNavigation();
  const { listItemEntering } = useMotionPresets();
  const { notificationsEnabled, toggleNotifications } = usePreferencesStore();
  const showToast = useToastStore((s) => s.showToast);

  const [exporting, setExporting] = useState(false);
  const [tidying, setTidying] = useState(false);

  const handleTidy = async () => {
    if (tidying) return;
    setTidying(true);
    try {
      const r = await tidyStatement();
      // Uma entrada por vigia, e o zero some da frase: listar "0 estorno(s)"
      // gasta a linha com o que não aconteceu. Somar só o que se mostra
      // também evita o pior caso — a faxina achar aplicação ou estorno e o
      // toast responder "nada a marcar", que é mentira sobre número que mudou
      const achados = [
        [r.internalMarked, "própria(s)"],
        [r.investmentMarked, "de investimento"],
        [r.familyMarked, "da casa"],
        [r.duplicatesMarked, "duplicata(s)"],
        [r.refundsMarked, "estorno(s)"],
        [r.seriesCreated + r.seriesUpdated, "recorrência(s)"],
      ] as const;
      const partes = achados
        .filter(([quantos]) => quantos > 0)
        .map(([quantos, rotulo]) => `${quantos} ${rotulo}`);
      // O número por número, e não "pronto": a faxina mexe em seis coisas
      // diferentes, e o dono precisa saber em qual delas ela mexeu
      showToast(
        partes.length === 0
          ? "Extrato já estava limpo: nada a marcar."
          : `${partes.join(", ")}.`,
        "success",
      );
      // A previsão e a Análise leem estes números: sem recarregar, a tela
      // seguinte mostraria o de antes. `force`: a faxina é escrita no servidor,
      // e a lista em cache (ou em voo) é anterior a ela
      await useBankStore.getState().fetchTransactions(true);
    } catch {
      showToast("Não consegui reprocessar agora. Tente de novo.", "error");
    } finally {
      setTidying(false);
    }
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // O pacote deve refletir o servidor, não o cache de quando cada tela
      // abriu — recarrega as quatro fontes antes de montar. Os stores engolem
      // falhas individuais (setam error), então o export segue com o que veio.
      //
      // O extrato é a exceção: na primeira carga a store tem primeiro só os
      // lançamentos recentes, e um backup com três meses no lugar de dois
      // anos é pior que nenhum — sem o histórico inteiro, não gera arquivo
      const [, historicoInteiro] = await Promise.all([
        useUserStore.getState().fetchMe(),
        useBankStore.getState().ensureHistory(),
        useWalletStore.getState().fetchTransactions(),
        useCategoriesStore.getState().fetch(),
      ]);
      if (!historicoInteiro) {
        showToast(
          "Não consegui carregar o extrato inteiro. Tente exportar de novo.",
          "error",
        );
        return;
      }
      const prefs = usePreferencesStore.getState();
      const payload = buildExportPayload({
        me: useUserStore.getState().me,
        fallbackName: useAuthStore.getState().userName,
        preferences: {
          theme: prefs.theme,
          defaultCurrency: prefs.defaultCurrency,
          language: prefs.language,
          notificationsEnabled: prefs.notificationsEnabled,
          biometricLogin: prefs.biometricLogin,
          hideBalance: prefs.hideBalance,
          cycleAnchorDay: selectCycleAnchorDay(prefs),
        },
        bankTransactions: useBankStore.getState().transactions,
        walletTransactions: useWalletStore.getState().transactions,
        categories: useCategoriesStore.getState().items,
      });
      const json = serializeExportPayload(payload);

      if (Platform.OS === "web") {
        downloadJsonOnWeb(json, exportFileName());
        showToast("Arquivo gerado — confira seus downloads.", "success");
      } else {
        const salvo = await saveJsonOnDevice(json, exportFileName());
        // Desistir da pasta não é erro: sem toast vermelho, sem vibração
        if (!salvo) return;
        if (Platform.OS === "android") {
          showToast("Arquivo salvo na pasta escolhida.", "success");
        }
      }
      Haptics.notificationAsync();
    } catch {
      showToast("Não foi possível exportar agora.", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleClearLocal = () => {
    askConfirm({
      title: "Apagar dados locais",
      message:
        "Preferências, favoritos e histórico salvos neste aparelho serão " +
        "removidos e a sessão será encerrada. Seus dados no servidor não " +
        "são afetados.",
      confirmLabel: "Apagar e sair",
      destructive: true,
      onConfirm: async () => {
        try {
          await clearLocalData();
          Haptics.notificationAsync();
          // o toast é global (fora da árvore de navegação): sobrevive à
          // troca para a tela de Login feita pelo logout
          showToast("Dados locais apagados.", "success");
        } catch {
          showToast("Não foi possível apagar os dados locais.", "error");
        }
      },
    });
  };

  return (
    <PageContainer>
      <ScreenHeader
        title="Opções avançadas"
        subtitle="Dados, notificações e suporte"
        showProfileButton={false}
      />
      <ScrollView
        contentContainerStyle={{
          padding: spacing[5],
          paddingBottom: spacing[10],
        }}
      >
        <Animated.View entering={listItemEntering(0)}>
          <SectionTitle>Dados</SectionTitle>
          <ActionRow
            Icon={FileUp}
            label="Exportar meus dados"
            description="Perfil, preferências, transações e categorias em JSON"
            onPress={handleExport}
            disabled={exporting}
            right={
              exporting ? (
                <ActivityIndicator size="small" color={t.accent.neon} />
              ) : undefined
            }
          />
          <ActionRow
            Icon={Sparkles}
            label={tidying ? "Reprocessando…" : "Reprocessar o extrato"}
            description="Marca de novo transferência própria, dinheiro da casa e linha repetida, e refaz as recorrências"
            onPress={handleTidy}
            disabled={tidying}
            right={
              tidying ? (
                <ActivityIndicator size="small" color={t.accent.neon} />
              ) : undefined
            }
          />
          {/* Ao lado do gatilho manual da MESMA faxina: quem acabou de
              reprocessar é exatamente quem quer ver o que mudou */}
          {/* EC-209: falar com uma pessoa fica junto do que é conta e ajuda */}
          <ActionRow
            Icon={LifeBuoy}
            label="Falar com uma pessoa"
            description="Chamado com prazo, que não some quando você fecha o app"
            onPress={() => navigation.navigate(APP_ROUTES.suporte as never)}
          />
          <ActionRow
            Icon={Eye}
            label="Vigias do extrato"
            description="Quem trabalha sozinho nos seus números, o que mexeu e como desfazer"
            onPress={() => navigation.navigate(APP_ROUTES.vigias as never)}
          />
          <ActionRow
            Icon={Trash}
            label="Apagar dados locais"
            description="Limpa este aparelho e encerra a sessão"
            destructive
            onPress={handleClearLocal}
          />
        </Animated.View>

        <Animated.View entering={listItemEntering(1)}>
          <SectionTitle>Notificações</SectionTitle>
          <ActionRow
            Icon={Bell}
            label="Resumo semanal"
            description="Preferência local — o envio ainda está em construção"
            right={
              <Switch
                value={notificationsEnabled}
                onValueChange={toggleNotifications}
                accessibilityLabel="Resumo semanal"
                trackColor={{
                  false: t.border.default,
                  true: t.accent.neon,
                }}
                thumbColor={t.background.base}
              />
            }
          />
        </Animated.View>

        <Animated.View entering={listItemEntering(2)}>
          <SectionTitle>Suporte</SectionTitle>
          <ActionRow
            Icon={CircleAlert}
            label="Reportar um problema"
            description="Abre seu aplicativo de e-mail"
            onPress={() =>
              Linking.openURL(
                "mailto:neemias.manso@jcgestaoderiscos.com.br?subject=Economize!%20-%20Suporte",
              )
            }
          />
        </Animated.View>
      </ScrollView>
    </PageContainer>
  );
}
