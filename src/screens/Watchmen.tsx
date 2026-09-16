import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Eye from "lucide-react-native/dist/esm/icons/eye";
import RotateCcw from "lucide-react-native/dist/esm/icons/rotate-ccw";
import { useFocusEffect } from "@react-navigation/native";
import Animated from "react-native-reanimated";

import {
  type Watchman,
  type WatchmanNote,
  getWatchmanNotes,
  getWatchmen,
  undoSweepRun,
} from "../services/api";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { useMotionPresets } from "../theme/motionPresets";
import { askConfirm } from "../store/confirmStore";
import { useBankStore } from "../store/bankStore";
import { useToastStore } from "../store/toastStore";
import * as Haptics from "../utils/haptics";
import Card from "../components/Card";
import ErrorState from "../components/ErrorState";
import FirstTimeCard from "../components/FirstTimeCard";
import PageContainer from "../components/PageContainer";
import ScreenHeader from "../components/ScreenHeader";
import SectionTitle from "../components/SectionTitle";
import Skeleton from "../components/Skeleton";
import { formatBRL } from "../utils/money";

/**
 * Os vigias e os recados deles — EC-202.
 *
 * <p><b>O defeito que esta tela fecha, e ele era nosso.</b> Seis varreduras
 * rodam sozinhas depois de cada importação e <b>mudam os números do
 * usuário</b>: movimentação própria, aplicação e resgate, dinheiro da casa,
 * duplicatas, estornos e recorrência. Até aqui não deixavam rastro nenhum. O
 * dono abria o app, a soma tinha mudado, e não havia uma linha em lugar
 * nenhum dizendo o que aconteceu.
 *
 * <p>Cada marca sempre foi reversível linha a linha — mas ninguém sabia
 * <b>quais</b> linhas olhar. Reversível na teoria e invisível na prática é o
 * mesmo que irreversível, e é assim que alguém passa a desconfiar do app
 * inteiro.
 *
 * <p><b>A lista de quem trabalha vem primeiro, e é fixa.</b> Ela aparece
 * mesmo antes da primeira passada: um trabalhador que só se apresenta depois
 * de mexer nos números já se apresentou tarde.
 */
export default function Watchmen() {
  const t = useTheme();
  const { listItemEntering } = useMotionPresets();
  const showToast = useToastStore((s) => s.showToast);

  const [vigias, setVigias] = useState<Watchman[]>([]);
  const [recados, setRecados] = useState<WatchmanNote[]>([]);
  const [carregou, setCarregou] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [desfazendo, setDesfazendo] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [quem, oQue] = await Promise.all([getWatchmen(), getWatchmanNotes()]);
      setVigias(quem);
      setRecados(oQue);
      setErro(null);
    } catch {
      setErro("Não consegui ler o histórico dos vigias agora.");
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

  const desfazer = useCallback(
    (recado: WatchmanNote) => {
      askConfirm({
        title: `Desfazer ${recado.watchman.toLowerCase()}`,
        message:
          `${recado.message}\n\nDesfazer solta exatamente as linhas que ESTA ` +
          "passada marcou — e só elas. O que você marcou à mão continua como está.",
        confirmLabel: "Desfazer",
        onConfirm: async () => {
          setDesfazendo(recado.runId);
          try {
            await undoSweepRun(recado.runId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showToast("Passada desfeita. Os números voltaram ao que eram.", "success");
            // A Análise e a Previsão leem estes números: sem recarregar, a
            // tela seguinte mostraria o de antes
            await useBankStore.getState().fetchTransactions();
            await carregar();
          } catch {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            showToast("Não consegui desfazer agora. Tente de novo.", "error");
          } finally {
            setDesfazendo(null);
          }
        },
      });
    },
    [carregar, showToast],
  );

  return (
    <PageContainer>
      <ScreenHeader
        title="Vigias"
        subtitle="Quem trabalha no seu extrato, e o que mexeu"
        showProfileButton={false}
      />

      {!carregou ? (
        <View style={{ padding: spacing[5], gap: spacing[3] }}>
          <Skeleton height={88} borderRadius={16} />
          <Skeleton height={88} borderRadius={16} />
          <Skeleton height={88} borderRadius={16} />
        </View>
      ) : erro && recados.length === 0 && vigias.length === 0 ? (
        <ErrorState message={erro} onRetry={carregar} />
      ) : (
        <ScrollView
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
            id="vigias-o-que-sao"
            title="Por que estes números mudam sozinhos"
            body="Depois de cada extrato importado, seis varreduras tiram das somas o que nunca foi movimento — dinheiro seu trocando de conta, aplicação, repasse de casa, linha repetida e compra estornada. Aqui você vê o que cada uma fez, e desfaz se discordar."
          />
          <SectionTitle>Quem trabalha aqui</SectionTitle>
          <Text
            style={{
              color: t.text.secondary,
              fontSize: 12,
              lineHeight: 17,
              marginBottom: spacing[3],
            }}
          >
            Eles rodam sozinhos depois de cada importação de extrato, e em mais
            nenhum momento. Nada aqui apaga lançamento: o que eles fazem é tirar
            das somas o que não deveria entrar nelas.
          </Text>
          {vigias.map((vigia, indice) => (
            <Animated.View key={vigia.kind} entering={listItemEntering(indice)}>
              <Card variant="flat" padding="tight" style={{ marginBottom: spacing[2] }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Eye size={14} color={t.text.tertiary} />
                  <Text
                    style={{
                      flex: 1,
                      marginLeft: spacing[2],
                      color: t.text.primary,
                      fontSize: 14,
                      fontWeight: "700",
                    }}
                  >
                    {vigia.name}
                  </Text>
                </View>
                <Text
                  style={{
                    color: t.text.secondary,
                    fontSize: 12,
                    marginTop: spacing[1],
                  }}
                >
                  {vigia.role}
                </Text>
              </Card>
            </Animated.View>
          ))}

          <View style={{ marginTop: spacing[6] }}>
            <SectionTitle>O que eles mexeram</SectionTitle>
          </View>
          {recados.length === 0 ? (
            <Text style={{ color: t.text.secondary, fontSize: 13 }}>
              Nenhuma passada ainda. Assim que você importar um extrato, o que
              cada vigia fizer aparece aqui.
            </Text>
          ) : (
            recados.map((recado, indice) => (
              <NoteCard
                key={recado.runId}
                note={recado}
                index={indice}
                busy={desfazendo === recado.runId}
                onUndo={() => desfazer(recado)}
              />
            ))
          )}
        </ScrollView>
      )}
    </PageContainer>
  );
}

function NoteCard({
  note,
  index,
  busy,
  onUndo,
}: {
  note: WatchmanNote;
  index: number;
  busy: boolean;
  onUndo: () => void;
}) {
  const t = useTheme();
  const { listItemEntering } = useMotionPresets();

  return (
    <Animated.View entering={listItemEntering(index)}>
      <Card style={{ marginBottom: spacing[2], opacity: note.undone ? 0.6 : 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              color: t.text.primary,
              fontSize: 14,
              fontWeight: "700",
            }}
          >
            {note.watchman}
          </Text>
          <Text style={{ color: t.text.tertiary, fontSize: 11 }}>
            {quando(note.ranAt)}
          </Text>
        </View>

        <Text
          style={{
            color: t.text.secondary,
            fontSize: 13,
            lineHeight: 18,
            marginTop: spacing[2],
          }}
        >
          {note.message}
        </Text>

        {note.undone ? (
          // Desfeita continua no histórico: apagá-la esconderia que o vigia
          // errou, que é exatamente o que o histórico existe para mostrar
          <Text
            style={{
              color: t.text.tertiary,
              fontSize: 11,
              fontWeight: "700",
              marginTop: spacing[3],
            }}
          >
            Você desfez esta passada.
          </Text>
        ) : note.canUndo ? (
          <TouchableOpacity
            onPress={onUndo}
            disabled={busy}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Desfazer esta passada do ${note.watchman}`}
            accessibilityState={{ disabled: busy, busy }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              alignSelf: "flex-start",
              marginTop: spacing[3],
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[2],
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: t.border.default,
              opacity: busy ? 0.5 : 1,
            }}
          >
            {busy ? (
              <ActivityIndicator size="small" color={t.text.secondary} />
            ) : (
              <>
                <RotateCcw size={13} color={t.text.secondary} />
                <Text
                  style={{
                    marginLeft: spacing[2],
                    color: t.text.secondary,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  Desfazer
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          // Sem botão, com o motivo: botão que não faz o que promete é pior
          // do que botão nenhum
          <Text
            style={{
              color: t.text.tertiary,
              fontSize: 11,
              marginTop: spacing[3],
            }}
          >
            Este não se desfaz por aqui — a série vive na tela de Recorrências,
            que é onde ela tem descarte próprio.
          </Text>
        )}

        {note.volume != null && note.volume !== 0 && !note.undone ? (
          <Text
            style={{
              color: t.text.tertiary,
              fontSize: 11,
              marginTop: spacing[2],
            }}
          >
            Volume da passada: {formatBRL(note.volume)}
          </Text>
        ) : null}
      </Card>
    </Animated.View>
  );
}

/**
 * "há 2 horas", "ontem", "12/09".
 *
 * Relativo perto e absoluto longe: "há 340 horas" não é uma informação que
 * alguém use, e "12/09" às três da tarde de hoje também não.
 */
function quando(iso: string): string {
  const entao = new Date(iso);
  if (Number.isNaN(entao.getTime())) return "";
  const minutos = Math.floor((Date.now() - entao.getTime()) / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return entao.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
