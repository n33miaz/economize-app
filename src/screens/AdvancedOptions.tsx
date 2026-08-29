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
import FileUp from "lucide-react-native/dist/esm/icons/file-up";
import Info from "lucide-react-native/dist/esm/icons/info";
import Trash2 from "lucide-react-native/dist/esm/icons/trash-2";
import { useNavigation } from "@react-navigation/native";
import Animated from "react-native-reanimated";

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
  URL.revokeObjectURL(url);
}

export default function AdvancedOptions() {
  const t = useTheme();
  const navigation = useNavigation();
  const { listItemEntering } = useMotionPresets();
  const { notificationsEnabled, toggleNotifications } = usePreferencesStore();
  const showToast = useToastStore((s) => s.showToast);

  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // O pacote deve refletir o servidor, não o cache de quando cada tela
      // abriu — recarrega as quatro fontes antes de montar. Os stores engolem
      // falhas individuais (setam error), então o export segue com o que veio.
      await Promise.all([
        useUserStore.getState().fetchMe(),
        useBankStore.getState().fetchTransactions(),
        useWalletStore.getState().fetchTransactions(),
        useCategoriesStore.getState().fetch(),
      ]);
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
        await Share.share({
          title: exportFileName(),
          message: json,
        });
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
        showInfoButton={false}
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
            Icon={Trash2}
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

        <Animated.View entering={listItemEntering(3)}>
          <SectionTitle>Sobre</SectionTitle>
          <ActionRow
            Icon={Info}
            label="Sobre o Economize!"
            description="Versão, time e agradecimentos"
            onPress={() => navigation.navigate("Sobre" as never)}
          />
        </Animated.View>
      </ScrollView>
    </PageContainer>
  );
}
