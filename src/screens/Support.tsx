import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import CircleCheck from "lucide-react-native/dist/esm/icons/circle-check";
import Clock from "lucide-react-native/dist/esm/icons/clock";
import TriangleAlert from "lucide-react-native/dist/esm/icons/triangle-alert";
import { useFocusEffect } from "@react-navigation/native";
import Animated from "react-native-reanimated";
import Constants from "expo-constants";

import {
  type SupportSubject,
  type SupportTicket,
  closeSupportTicket,
  getSupportTickets,
  openSupportTicket,
} from "../services/api";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { useMotionPresets } from "../theme/motionPresets";
import { askConfirm } from "../store/confirmStore";
import { useToastStore } from "../store/toastStore";
import * as Haptics from "../utils/haptics";
import Card from "../components/Card";
import ErrorState from "../components/ErrorState";
import FirstTimeCard from "../components/FirstTimeCard";
import PageContainer from "../components/PageContainer";
import ScreenHeader from "../components/ScreenHeader";
import SectionTitle from "../components/SectionTitle";
import Skeleton from "../components/Skeleton";

/**
 * Falar com uma pessoa — EC-209.
 *
 * <p><b>O defeito que esta tela fecha.</b> Suporte dentro de um chat efêmero
 * some quando o app fecha: a pessoa descreve o problema, fecha, volta no dia
 * seguinte e não encontra nem o que escreveu nem se alguém leu — e desiste.
 * Do ponto de vista de quem mede chamados, desistir é indistinguível de ter o
 * problema resolvido, e é por isso que esse desenho sobrevive em tanto app.
 *
 * <p>Aqui o chamado vive no servidor. Ele sobrevive a fechar o app, trocar de
 * celular, apagar os dados locais e entrar de outro lugar — exatamente os
 * momentos em que a pessoa mais precisa provar que pediu ajuda.
 *
 * <p><b>O prazo aparece, e o atraso também.</b> A tela diz até quando
 * prometemos responder, e diz quando esse prazo passou. Esconder o atraso
 * seria fingir que está tudo no rumo para quem está esperando.
 */

/** Os assuntos, na ordem em que as pessoas os procuram. */
const ASSUNTOS: { value: SupportSubject; label: string }[] = [
  { value: "NUMERO_ERRADO", label: "Um número errado" },
  { value: "IMPORTACAO", label: "Importar extrato" },
  { value: "CONEXAO", label: "Conexão com o banco" },
  { value: "COBRANCA", label: "Plano e cobrança" },
  { value: "CONTA", label: "Conta e acesso" },
  { value: "OUTRO", label: "Outro assunto" },
];

export default function Support() {
  const t = useTheme();
  const { listItemEntering } = useMotionPresets();
  const showToast = useToastStore((s) => s.showToast);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [carregou, setCarregou] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [assunto, setAssunto] = useState<SupportSubject>("NUMERO_ERRADO");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setTickets(await getSupportTickets());
      setErro(null);
    } catch {
      setErro("Não consegui carregar seus chamados agora.");
    } finally {
      setCarregando(false);
      setCarregou(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const enviar = async () => {
    if (enviando) return;
    if (mensagem.trim().length === 0) {
      setErroEnvio("Conte o que aconteceu — sem isso ninguém consegue ajudar.");
      return;
    }
    setEnviando(true);
    setErroEnvio(null);
    try {
      await openSupportTicket({
        subject: assunto,
        message: mensagem.trim(),
        // A versão viaja junto: sem ela, o primeiro retorno é sempre "qual
        // versão você usa?", e essa ida e volta custa um dia
        appVersion: Constants.expoConfig?.version ?? null,
        screen: "Suporte",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMensagem("");
      showToast("Chamado aberto. Ele fica guardado aqui.", "success");
      await carregar();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const detalhe = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErroEnvio(detalhe ?? "Não consegui abrir o chamado agora. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  };

  const encerrar = (ticket: SupportTicket) => {
    askConfirm({
      title: "Encerrar chamado",
      message:
        "Ele sai da fila de espera e continua no seu histórico — encerrar não apaga o que " +
        "você escreveu.",
      confirmLabel: "Encerrar",
      onConfirm: async () => {
        try {
          await closeSupportTicket(ticket.id);
          await carregar();
          showToast("Chamado encerrado.", "success");
        } catch {
          showToast("Não consegui encerrar agora. Tente de novo.", "error");
        }
      },
    });
  };

  return (
    <PageContainer>
      <ScreenHeader
        title="Falar com uma pessoa"
        subtitle="Com prazo, e sem sumir quando o app fecha"
        showInfoButton={false}
        showProfileButton={false}
      />

      {!carregou ? (
        <View style={{ padding: spacing[5], gap: spacing[3] }}>
          <Skeleton height={140} borderRadius={16} />
          <Skeleton height={88} borderRadius={16} />
        </View>
      ) : erro && tickets.length === 0 ? (
        <ErrorState message={erro} onRetry={carregar} />
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: spacing[5], paddingBottom: spacing[10] }}
          refreshControl={
            <RefreshControl
              refreshing={carregando}
              onRefresh={carregar}
              tintColor={t.accent.neon}
              colors={[t.accent.neon]}
            />
          }
        >
          <FirstTimeCard
            id="suporte-o-que-e"
            title="Seu chamado não some"
            body="Ele fica guardado no servidor, não neste aparelho: você pode fechar o app, trocar de celular ou entrar de outro lugar e ele continua aqui, com a data em que prometemos responder."
          />

          <SectionTitle>Abrir um chamado</SectionTitle>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing[2],
              marginBottom: spacing[3],
            }}
          >
            {ASSUNTOS.map((item) => {
              const ativo = assunto === item.value;
              return (
                <TouchableOpacity
                  key={item.value}
                  onPress={() => setAssunto(item.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: ativo }}
                  accessibilityLabel={item.label}
                  style={{
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                    borderRadius: radius.full,
                    borderWidth: 1,
                    borderColor: ativo ? t.accent.neon : t.border.subtle,
                    backgroundColor: t.background.elevated,
                  }}
                >
                  <Text
                    style={{
                      color: ativo ? t.accent.neon : t.text.secondary,
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            value={mensagem}
            onChangeText={setMensagem}
            multiline
            maxLength={2000}
            accessibilityLabel="O que aconteceu"
            placeholder="Conte o que aconteceu. Se for sobre um número, diga qual tela e qual período."
            placeholderTextColor={t.text.tertiary}
            style={{
              color: t.text.primary,
              fontSize: 14,
              minHeight: 110,
              textAlignVertical: "top",
              borderWidth: 1,
              borderColor: t.border.subtle,
              borderRadius: radius.lg,
              padding: spacing[3],
            }}
          />

          {erroEnvio ? (
            <Text style={{ color: t.semantic.danger, fontSize: 12, marginTop: spacing[2] }}>
              {erroEnvio}
            </Text>
          ) : null}

          <TouchableOpacity
            onPress={enviar}
            disabled={enviando}
            accessibilityRole="button"
            accessibilityLabel="Abrir o chamado"
            accessibilityState={{ disabled: enviando, busy: enviando }}
            style={{
              height: 48,
              borderRadius: radius.xl,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: t.accent.neon,
              opacity: enviando ? 0.5 : 1,
              marginTop: spacing[3],
            }}
          >
            {enviando ? (
              <ActivityIndicator size="small" color={t.text.inverse} />
            ) : (
              <Text style={{ color: t.text.inverse, fontWeight: "700", fontSize: 14 }}>
                Abrir chamado
              </Text>
            )}
          </TouchableOpacity>

          <View style={{ marginTop: spacing[6] }}>
            <SectionTitle>Seus chamados</SectionTitle>
          </View>

          {tickets.length === 0 ? (
            <Text style={{ color: t.text.secondary, fontSize: 13 }}>
              Você ainda não abriu nenhum chamado.
            </Text>
          ) : (
            tickets.map((ticket, indice) => (
              <Animated.View key={ticket.id} entering={listItemEntering(indice)}>
                <TicketCard ticket={ticket} onClose={() => encerrar(ticket)} />
              </Animated.View>
            ))
          )}
        </ScrollView>
      )}
    </PageContainer>
  );
}

function TicketCard({
  ticket,
  onClose,
}: {
  ticket: SupportTicket;
  onClose: () => void;
}) {
  const t = useTheme();

  const assunto =
    ASSUNTOS.find((item) => item.value === ticket.subject)?.label ?? "Outro assunto";

  const { Icon, cor, frase } = estadoDo(ticket, t);

  return (
    <Card style={{ marginBottom: spacing[2] }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Icon size={13} color={cor} />
        <Text
          style={{
            flex: 1,
            marginLeft: spacing[2],
            color: t.text.primary,
            fontSize: 13,
            fontWeight: "700",
          }}
          numberOfLines={1}
        >
          {assunto}
        </Text>
        <Text style={{ color: cor, fontSize: 11, fontWeight: "700" }}>{frase}</Text>
      </View>

      <Text
        style={{
          color: t.text.secondary,
          fontSize: 12,
          lineHeight: 17,
          marginTop: spacing[2],
        }}
      >
        {ticket.message}
      </Text>

      {ticket.answer ? (
        <View
          style={{
            marginTop: spacing[3],
            paddingTop: spacing[3],
            borderTopWidth: 1,
            borderTopColor: t.border.subtle,
          }}
        >
          <Text style={{ color: t.text.tertiary, fontSize: 11, fontWeight: "700" }}>
            Resposta
          </Text>
          <Text
            style={{
              color: t.text.primary,
              fontSize: 12,
              lineHeight: 17,
              marginTop: 2,
            }}
          >
            {ticket.answer}
          </Text>
        </View>
      ) : null}

      {ticket.status !== "CLOSED" ? (
        <TouchableOpacity
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={`Encerrar o chamado sobre ${assunto.toLowerCase()}`}
          style={{ alignSelf: "flex-start", marginTop: spacing[3] }}
        >
          <Text style={{ color: t.text.tertiary, fontSize: 12, fontWeight: "700" }}>
            Já resolvi — encerrar
          </Text>
        </TouchableOpacity>
      ) : null}
    </Card>
  );
}

/** O estado do chamado em uma palavra, um ícone e uma cor. */
function estadoDo(ticket: SupportTicket, t: ReturnType<typeof useTheme>) {
  if (ticket.status === "CLOSED") {
    return { Icon: CircleCheck, cor: t.text.tertiary, frase: "encerrado" };
  }
  if (ticket.status === "ANSWERED") {
    return { Icon: CircleCheck, cor: t.semantic.success, frase: "respondido" };
  }
  // Esconder o atraso seria fingir que está tudo no rumo para quem espera
  if (ticket.overdue) {
    return { Icon: TriangleAlert, cor: t.semantic.warning, frase: "atrasado" };
  }
  return { Icon: Clock, cor: t.text.tertiary, frase: `até ${diaMes(ticket.respondBy)}` };
}

/** "15/09" — dia e mês bastam para um prazo de dois dias úteis. */
function diaMes(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${pad(data.getDate())}/${pad(data.getMonth() + 1)}`;
}
