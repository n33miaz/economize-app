import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import BadgeCheck from "lucide-react-native/dist/esm/icons/badge-check";
import CircleAlert from "lucide-react-native/dist/esm/icons/circle-alert";
import ExternalLink from "lucide-react-native/dist/esm/icons/external-link";
import KeyRound from "lucide-react-native/dist/esm/icons/key-round";
import Trash2 from "lucide-react-native/dist/esm/icons/trash-2";
import Animated from "react-native-reanimated";

import { useTheme } from "../theme/ThemeProvider";
import { spacing } from "../theme/ds";
import { useMotionPresets } from "../theme/motionPresets";
import { askConfirm } from "../store/confirmStore";
import { useToastStore } from "../store/toastStore";
import {
  hasOwnKey,
  keyIsUnreadable,
  useAiSettingsStore,
} from "../store/aiSettingsStore";
import type { AiProviderId } from "../services/api";
import * as Haptics from "../utils/haptics";

import ScreenHeader from "../components/ScreenHeader";
import PageContainer from "../components/PageContainer";
import SectionTitle from "../components/SectionTitle";
import ActionRow from "../components/ActionRow";
import FloatingLabelInput from "../components/FloatingLabelInput";
import Skeleton from "../components/Skeleton";
import ErrorState from "../components/ErrorState";

/** Chip de modelo: a lista vem do servidor e qualquer outro valor responde 400. */
function ModelChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`px-3 py-2 rounded-xl border mr-2 mb-2 ${
        selected ? "bg-accent border-accent" : "bg-elevated border-border"
      }`}
    >
      <Text
        className={`text-xs font-bold ${
          selected ? "text-background" : "text-textSecondary"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function AiSettings() {
  const t = useTheme();
  const { listItemEntering } = useMotionPresets();
  const showToast = useToastStore((s) => s.showToast);

  const {
    catalog,
    settings,
    isLoading,
    hasLoadedOnce,
    error,
    isSaving,
    isTesting,
    testResult,
    load,
    save,
    remove,
    test,
    clearTestResult,
  } = useAiSettingsStore();

  const [provider, setProvider] = useState<AiProviderId | null>(null);
  const [model, setModel] = useState<string>("");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    load();
  }, [load]);

  // Abre já no provedor em vigor: quem só quer trocar o modelo não deveria
  // ter de reencontrar o próprio provedor na lista
  useEffect(() => {
    if (!settings || provider) return;
    setProvider(settings.provider);
    setModel(settings.model);
  }, [settings, provider]);

  const selected = useMemo(
    () => catalog?.providers.find((p) => p.id === provider) ?? null,
    [catalog, provider],
  );

  const onPickProvider = (id: AiProviderId) => {
    const next = catalog?.providers.find((p) => p.id === id);
    if (!next) return;
    Haptics.selectionAsync();
    setProvider(id);
    // Modelo do provedor anterior não existe no novo: manter devolveria 400
    setModel(next.defaultModel);
    clearTestResult();
  };

  const handleTest = async () => {
    if (!provider || !apiKey.trim()) return;
    Haptics.selectionAsync();
    const result = await test({ provider, model, apiKey: apiKey.trim() });
    if (result?.ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (result) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const handleSave = async () => {
    if (!provider || !apiKey.trim()) return;
    const ok = await save(provider, model, apiKey.trim());
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // O campo esvazia porque a chave não volta da API: deixar o texto na
      // tela sugeriria que ele é o que está gravado, e ninguém consegue conferir
      setApiKey("");
      showToast("Chave salva. O assistente passa a usar a sua.", "success");
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleRemove = () => {
    askConfirm({
      title: "Remover sua chave?",
      message:
        "O assistente volta a usar a chave do servidor. A sua é apagada e precisa ser cadastrada de novo.",
      confirmLabel: "Remover",
      destructive: true,
      onConfirm: async () => {
        const ok = await remove();
        if (ok) {
          setApiKey("");
          showToast("Chave removida.", "success");
        }
      },
    });
  };

  const byokOff = hasLoadedOnce && catalog?.byokAvailable === false;
  const própria = hasOwnKey(settings);
  const ilegível = keyIsUnreadable(settings);

  return (
    <PageContainer>
      <ScreenHeader
        title="Opções de IA"
        subtitle="Escolha o provedor e use a sua própria chave"
        showInfoButton={false}
        showProfileButton={false}
      />
      <ScrollView
        contentContainerStyle={{ padding: spacing[5], paddingBottom: spacing[10] }}
        keyboardShouldPersistTaps="handled"
      >
        {isLoading && !hasLoadedOnce ? (
          <View>
            <Skeleton width="100%" height={92} borderRadius={20} />
            <View className="h-4" />
            <Skeleton width="100%" height={180} borderRadius={20} />
          </View>
        ) : error && !hasLoadedOnce ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <>
            <Animated.View entering={listItemEntering(0)}>
              <SectionTitle>Em uso agora</SectionTitle>
              <View className="bg-elevated border border-border rounded-2xl p-4">
                <Text className="text-textPrimary font-bold text-base">
                  {própria ? "Sua chave" : "Chave do servidor"}
                </Text>
                <Text className="text-textSecondary font-regular text-sm mt-1">
                  {settings
                    ? `${settings.provider} · ${settings.model}`
                    : "—"}
                  {própria && settings?.keyLast4
                    ? ` · final ${settings.keyLast4}`
                    : ""}
                </Text>
                {ilegível ? (
                  // Não é erro do usuário: a chave-mestra do servidor mudou.
                  // Dizer isso evita que ele fique testando a mesma chave boa
                  <View className="flex-row items-start mt-3">
                    <CircleAlert size={16} color={t.semantic.danger} />
                    <Text className="text-danger font-regular text-xs ml-2 flex-1">
                      Sua chave não pôde ser lida com a configuração atual do
                      servidor. Cadastre-a novamente.
                    </Text>
                  </View>
                ) : null}
              </View>
            </Animated.View>

            {byokOff ? (
              <Animated.View entering={listItemEntering(1)} className="mt-6">
                <View className="bg-elevated border border-border rounded-2xl p-4">
                  <Text className="text-textSecondary font-regular text-sm">
                    Este servidor não aceita chave própria no momento. O
                    assistente continua funcionando com a chave do servidor.
                  </Text>
                </View>
              </Animated.View>
            ) : (
              <>
                <Animated.View entering={listItemEntering(1)} className="mt-6">
                  <SectionTitle>Provedor</SectionTitle>
                  <View className="flex-row flex-wrap">
                    {catalog?.providers.map((p) => (
                      <ModelChip
                        key={p.id}
                        label={p.label}
                        selected={p.id === provider}
                        onPress={() => onPickProvider(p.id)}
                      />
                    ))}
                  </View>
                </Animated.View>

                {selected ? (
                  <Animated.View entering={listItemEntering(2)} className="mt-5">
                    <SectionTitle>Modelo</SectionTitle>
                    <View className="flex-row flex-wrap">
                      {selected.models.map((m) => (
                        <ModelChip
                          key={m}
                          label={m}
                          selected={m === model}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setModel(m);
                            clearTestResult();
                          }}
                        />
                      ))}
                    </View>

                    <View className="mt-4">
                      <FloatingLabelInput
                        label="Sua chave do provedor"
                        value={apiKey}
                        onChangeText={(v) => {
                          setApiKey(v);
                          clearTestResult();
                        }}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>

                    <Pressable
                      onPress={() => Linking.openURL(selected.apiKeyUrl)}
                      className="flex-row items-center mt-2"
                      accessibilityRole="link"
                    >
                      <ExternalLink size={14} color={t.text.tertiary} />
                      <Text className="text-textTertiary font-regular text-xs ml-2">
                        Emitir uma chave em {selected.label}
                      </Text>
                    </Pressable>

                    {testResult ? (
                      <View className="flex-row items-start mt-4">
                        {testResult.ok ? (
                          <BadgeCheck size={16} color={t.semantic.success} />
                        ) : (
                          <CircleAlert size={16} color={t.semantic.danger} />
                        )}
                        <Text
                          className={`font-regular text-xs ml-2 flex-1 ${
                            testResult.ok ? "text-success" : "text-danger"
                          }`}
                        >
                          {testResult.message}
                          {testResult.ok
                            ? ` (${testResult.latencyMs} ms)`
                            : ""}
                        </Text>
                      </View>
                    ) : null}

                    {error ? (
                      <Text className="text-danger font-regular text-xs mt-3">
                        {error}
                      </Text>
                    ) : null}

                    <View className="flex-row mt-5">
                      <Pressable
                        onPress={handleTest}
                        disabled={!apiKey.trim() || isTesting || isSaving}
                        accessibilityRole="button"
                        className={`flex-1 h-12 rounded-2xl items-center justify-center border border-border mr-3 ${
                          !apiKey.trim() || isTesting ? "opacity-50" : ""
                        }`}
                      >
                        {isTesting ? (
                          <ActivityIndicator color={t.text.secondary} />
                        ) : (
                          <Text className="text-textPrimary font-bold text-sm">
                            Testar
                          </Text>
                        )}
                      </Pressable>
                      <Pressable
                        onPress={handleSave}
                        disabled={!apiKey.trim() || isSaving || isTesting}
                        accessibilityRole="button"
                        className={`flex-1 h-12 rounded-2xl items-center justify-center bg-accent ${
                          !apiKey.trim() || isSaving ? "opacity-50" : ""
                        }`}
                      >
                        {isSaving ? (
                          <ActivityIndicator color={t.background.base} />
                        ) : (
                          <Text className="text-background font-bold text-sm">
                            Salvar
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  </Animated.View>
                ) : null}

                {própria ? (
                  <Animated.View entering={listItemEntering(3)} className="mt-7">
                    <SectionTitle>Sua chave</SectionTitle>
                    <ActionRow
                      Icon={Trash2}
                      label="Remover minha chave"
                      description="Volta a usar a chave do servidor"
                      destructive
                      onPress={handleRemove}
                      disabled={isSaving}
                    />
                  </Animated.View>
                ) : null}

                <Animated.View entering={listItemEntering(4)} className="mt-7">
                  <View className="flex-row items-start">
                    <KeyRound size={14} color={t.text.tertiary} />
                    <Text className="text-textTertiary font-regular text-xs ml-2 flex-1">
                      Sua chave é guardada cifrada e nunca volta em nenhuma tela
                      — só os quatro últimos caracteres. O consumo é cobrado
                      pelo provedor, direto na sua conta.
                    </Text>
                  </View>
                </Animated.View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </PageContainer>
  );
}
