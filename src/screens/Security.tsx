import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Copy from "lucide-react-native/dist/esm/icons/copy";
import ShieldCheck from "lucide-react-native/dist/esm/icons/shield-check";
import ShieldOff from "lucide-react-native/dist/esm/icons/shield-off";
import TriangleAlert from "lucide-react-native/dist/esm/icons/triangle-alert";
import Animated from "react-native-reanimated";

import ErrorState from "../components/ErrorState";
import FloatingLabelInput from "../components/FloatingLabelInput";
import PageContainer from "../components/PageContainer";
import ScreenHeader from "../components/ScreenHeader";
import SectionTitle from "../components/SectionTitle";
import Skeleton from "../components/Skeleton";
import { askConfirm } from "../store/confirmStore";
import { useToastStore } from "../store/toastStore";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { useMotionPresets } from "../theme/motionPresets";
import { copyToClipboard } from "../utils/clipboard";
import {
  activateMfa,
  disableMfa,
  getMfaStatus,
  rotateMfaRecoveryCodes,
  startMfaSetup,
  type MfaSetup,
  type MfaStatus,
} from "../services/api";

/**
 * Verificação em duas etapas.
 *
 * <p>A tela tem TRÊS estados, e a separação é o que evita o pior erro possível
 * neste fluxo — trancar o dono para fora da própria conta: <b>desligado</b>,
 * <b>cadastrando</b> (segredo na tela, login ainda só com senha) e
 * <b>ligado</b>. O passo do meio só termina quando um código do aplicativo
 * confere: até lá, nada muda no login.
 */
export default function Security() {
  const t = useTheme();
  const { listItemEntering } = useMotionPresets();
  const showToast = useToastStore((s) => s.showToast);

  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [working, setWorking] = useState(false);

  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [code, setCode] = useState("");
  // Os códigos aparecem UMA vez; enquanto estão na tela, o usuário precisa
  // conseguir copiá-los antes de sair
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [password, setPassword] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(false);
    try {
      setStatus(await getMfaStatus());
    } catch {
      setErro(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const comecarCadastro = async () => {
    setWorking(true);
    try {
      setSetup(await startMfaSetup());
      setCode("");
    } catch {
      showToast("Não foi possível começar o cadastro.", "error");
    } finally {
      setWorking(false);
    }
  };

  const confirmar = async () => {
    if (code.trim().length !== 6) return;
    setWorking(true);
    try {
      const codes = await activateMfa(code.trim());
      setRecoveryCodes(codes);
      setSetup(null);
      setCode("");
      await carregar();
      showToast("Verificação em duas etapas ativada.", "success");
    } catch {
      showToast("Código inválido. Confira o relógio do aparelho.", "error");
    } finally {
      setWorking(false);
    }
  };

  const girarCodigos = async () => {
    setWorking(true);
    try {
      setRecoveryCodes(await rotateMfaRecoveryCodes());
      await carregar();
    } catch {
      showToast("Não foi possível gerar códigos novos.", "error");
    } finally {
      setWorking(false);
    }
  };

  const desligar = () => {
    if (!password) {
      showToast("Digite sua senha para desligar.", "warning");
      return;
    }
    askConfirm({
      title: "Desligar a verificação em duas etapas",
      message:
        "Sua conta volta a ser protegida apenas pela senha. Os códigos de recuperação são apagados.",
      confirmLabel: "Desligar",
      destructive: true,
      onConfirm: async () => {
        setWorking(true);
        try {
          await disableMfa(password);
          setPassword("");
          setRecoveryCodes(null);
          await carregar();
          showToast("Verificação em duas etapas desligada.", "success");
        } catch {
          showToast("Senha incorreta.", "error");
        } finally {
          setWorking(false);
        }
      },
    });
  };

  /** No aparelho não há área de transferência: o texto fica selecionável. */
  const copiar = async (texto: string, aviso: string) => {
    if (await copyToClipboard(texto)) showToast(aviso, "success");
    else showToast("Toque e segure sobre o texto para copiar.", "info");
  };

  return (
    <PageContainer>
      <ScreenHeader
        title="Segurança"
        subtitle="Verificação em duas etapas"
        showBackButton
      />
      <ScrollView
        contentContainerStyle={{ padding: spacing[5], paddingBottom: spacing[8] }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ gap: spacing[3] }}>
            <Skeleton height={110} borderRadius={radius.xl} />
            <Skeleton height={72} borderRadius={radius.xl} />
            <Skeleton height={72} borderRadius={radius.xl} />
          </View>
        ) : erro ? (
          <ErrorState
            message="Não conseguimos ler o estado da sua segurança."
            onRetry={carregar}
          />
        ) : (
          <>
            <Animated.View entering={listItemEntering(0)}>
              <View
                style={{
                  backgroundColor: t.background.elevated,
                  borderRadius: radius.xl,
                  borderWidth: 1,
                  borderColor: status?.enabled
                    ? t.semantic.success
                    : t.border.default,
                  padding: spacing[5],
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[4],
                }}
              >
                {status?.enabled ? (
                  <ShieldCheck size={28} color={t.semantic.success} />
                ) : (
                  <ShieldOff size={28} color={t.text.tertiary} />
                )}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: t.text.primary,
                      fontSize: 16,
                      fontWeight: "700",
                    }}
                  >
                    {status?.enabled ? "Ativada" : "Desligada"}
                  </Text>
                  <Text
                    style={{
                      color: t.text.secondary,
                      fontSize: 13,
                      marginTop: 2,
                    }}
                  >
                    {status?.enabled
                      ? `Restam ${status.recoveryCodesRemaining} códigos de recuperação.`
                      : "Só a senha protege sua conta hoje."}
                  </Text>
                </View>
              </View>
            </Animated.View>

            {recoveryCodes && (
              <Animated.View
                entering={listItemEntering(1)}
                style={{ marginTop: spacing[6] }}
              >
                <SectionTitle>Guarde estes códigos</SectionTitle>
                <View
                  style={{
                    backgroundColor: t.background.elevated,
                    borderRadius: radius.xl,
                    borderWidth: 1,
                    borderColor: t.semantic.warning,
                    padding: spacing[5],
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      gap: spacing[3],
                      marginBottom: spacing[4],
                    }}
                  >
                    <TriangleAlert size={20} color={t.semantic.warning} />
                    <Text
                      style={{
                        color: t.text.secondary,
                        fontSize: 13,
                        lineHeight: 19,
                        flex: 1,
                      }}
                    >
                      Cada código entra uma vez e serve para quando você perder
                      o aparelho do autenticador. Esta é a única vez que eles
                      aparecem — nem o servidor consegue mostrá-los de novo.
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: spacing[2],
                    }}
                  >
                    {recoveryCodes.map((item) => (
                      <Text
                        key={item}
                        accessibilityLabel={`Código de recuperação ${item}`}
                        style={{
                          color: t.text.primary,
                          fontSize: 14,
                          fontWeight: "700",
                          letterSpacing: 1,
                          backgroundColor: t.background.surface,
                          borderRadius: radius.md,
                          paddingHorizontal: spacing[3],
                          paddingVertical: spacing[2],
                        }}
                      >
                        {item}
                      </Text>
                    ))}
                  </View>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Copiar códigos de recuperação"
                    onPress={() =>
                      copiar(recoveryCodes.join("\n"), "Códigos copiados.")
                    }
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing[2],
                      marginTop: spacing[4],
                    }}
                  >
                    <Copy size={16} color={t.accent.neon} />
                    <Text
                      style={{
                        color: t.accent.neon,
                        fontWeight: "700",
                        fontSize: 14,
                      }}
                    >
                      Copiar todos
                    </Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}

            {!status?.enabled && !setup && (
              <Animated.View
                entering={listItemEntering(2)}
                style={{ marginTop: spacing[6] }}
              >
                <Text
                  style={{
                    color: t.text.secondary,
                    fontSize: 14,
                    lineHeight: 20,
                    marginBottom: spacing[4],
                  }}
                >
                  Com a verificação ligada, entrar passa a exigir um código de
                  6 dígitos gerado no seu celular — mesmo para quem descobrir
                  sua senha. Funciona com Google Authenticator, Authy, 1Password
                  ou qualquer aplicativo de autenticação.
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Ativar verificação em duas etapas"
                  disabled={working}
                  onPress={comecarCadastro}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: t.accent.neon,
                    borderRadius: radius.full,
                    paddingVertical: spacing[4],
                    alignItems: "center",
                    opacity: working ? 0.7 : 1,
                  }}
                >
                  {working ? (
                    <ActivityIndicator color={t.text.inverse} />
                  ) : (
                    <Text
                      style={{
                        color: t.text.inverse,
                        fontWeight: "700",
                        fontSize: 15,
                      }}
                    >
                      Ativar
                    </Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            )}

            {setup && (
              <Animated.View
                entering={listItemEntering(2)}
                style={{ marginTop: spacing[6] }}
              >
                <SectionTitle>Cadastre no seu autenticador</SectionTitle>
                <Text
                  style={{
                    color: t.text.secondary,
                    fontSize: 14,
                    lineHeight: 20,
                    marginBottom: spacing[4],
                  }}
                >
                  Abra o aplicativo de autenticação, escolha "adicionar conta" e
                  digite a chave abaixo. Depois confirme com o código de 6
                  dígitos que ele mostrar.
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Copiar chave ${setup.secret}`}
                  onPress={() => copiar(setup.secret, "Chave copiada.")}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: t.background.elevated,
                    borderRadius: radius.xl,
                    borderWidth: 1,
                    borderColor: t.border.default,
                    padding: spacing[4],
                    marginBottom: spacing[5],
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing[3],
                  }}
                >
                  <Text
                    selectable
                    style={{
                      color: t.text.primary,
                      fontSize: 15,
                      fontWeight: "700",
                      letterSpacing: 2,
                      flex: 1,
                    }}
                  >
                    {setup.secret}
                  </Text>
                  <Copy size={18} color={t.accent.neon} />
                </TouchableOpacity>

                <View style={{ marginBottom: spacing[5] }}>
                  <FloatingLabelInput
                    label="Código de 6 dígitos"
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                  />
                </View>

                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Confirmar e ativar"
                  disabled={working || code.trim().length !== 6}
                  onPress={confirmar}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: t.accent.neon,
                    borderRadius: radius.full,
                    paddingVertical: spacing[4],
                    alignItems: "center",
                    opacity: working || code.trim().length !== 6 ? 0.5 : 1,
                  }}
                >
                  {working ? (
                    <ActivityIndicator color={t.text.inverse} />
                  ) : (
                    <Text
                      style={{
                        color: t.text.inverse,
                        fontWeight: "700",
                        fontSize: 15,
                      }}
                    >
                      Confirmar e ativar
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Cancelar cadastro"
                  onPress={() => {
                    setSetup(null);
                    setCode("");
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ marginTop: spacing[4], alignItems: "center" }}
                >
                  <Text style={{ color: t.text.secondary, fontWeight: "600" }}>
                    Cancelar
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {status?.enabled && (
              <Animated.View
                entering={listItemEntering(3)}
                style={{ marginTop: spacing[6] }}
              >
                <SectionTitle>Gerenciar</SectionTitle>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Gerar novos códigos de recuperação"
                  disabled={working}
                  onPress={girarCodigos}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: t.background.elevated,
                    borderRadius: radius.xl,
                    borderWidth: 1,
                    borderColor: t.border.default,
                    padding: spacing[4],
                    marginBottom: spacing[5],
                  }}
                >
                  <Text style={{ color: t.text.primary, fontWeight: "700" }}>
                    Gerar novos códigos de recuperação
                  </Text>
                  <Text
                    style={{
                      color: t.text.secondary,
                      fontSize: 13,
                      marginTop: 2,
                    }}
                  >
                    O lote anterior deixa de valer por inteiro.
                  </Text>
                </TouchableOpacity>

                <Text
                  style={{
                    color: t.text.secondary,
                    fontSize: 14,
                    lineHeight: 20,
                    marginBottom: spacing[3],
                  }}
                >
                  Para desligar, confirme com sua senha — não com um código.
                  Quem está com seu celular na mão tem o autenticador ali; a
                  senha é o que essa pessoa não tem.
                </Text>
                <View style={{ marginBottom: spacing[4] }}>
                  <FloatingLabelInput
                    label="Sua senha"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Desligar verificação em duas etapas"
                  disabled={working}
                  onPress={desligar}
                  activeOpacity={0.85}
                  style={{
                    borderRadius: radius.full,
                    borderWidth: 1,
                    borderColor: t.semantic.danger,
                    paddingVertical: spacing[4],
                    alignItems: "center",
                    opacity: working ? 0.6 : 1,
                  }}
                >
                  <Text
                    style={{ color: t.semantic.danger, fontWeight: "700" }}
                  >
                    Desligar
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>
    </PageContainer>
  );
}
