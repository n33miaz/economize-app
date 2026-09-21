import React from "react";
import { Pressable, Text, View } from "react-native";
import Cloud from "lucide-react-native/dist/esm/icons/cloud";
import CloudOff from "lucide-react-native/dist/esm/icons/cloud-off";
import RefreshCw from "lucide-react-native/dist/esm/icons/refresh-cw";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { formatSyncTime } from "../utils/shopping";

interface Props {
  /** Há mudança neste aparelho que o servidor ainda não viu. */
  pending: boolean;
  /** A última tentativa falhou. */
  failed: boolean;
  syncing: boolean;
  lastSyncAt: number | null;
  onSync: () => void;
}

/**
 * O que a tela diz sobre a sincronização — sem gritar.
 *
 * <p>Offline no mercado é o caso NORMAL do carrinho, não um erro. Por isso a
 * frase é "ainda não sincronizado · salvo neste aparelho": a primeira parte
 * é honesta, a segunda é a que importa para quem está com o carrinho na mão.
 * Nada aqui é vermelho; o pior caso veste o tom de atenção.
 */
export function describeSyncStatus(props: Omit<Props, "onSync">): {
  text: string;
  tone: "ok" | "warning" | "muted";
} {
  if (props.syncing) return { text: "Sincronizando…", tone: "muted" };
  if (props.pending) {
    return {
      text: "Ainda não sincronizado · salvo neste aparelho",
      tone: "warning",
    };
  }
  if (props.failed) {
    const desde = props.lastSyncAt
      ? ` · última às ${formatSyncTime(props.lastSyncAt)}`
      : "";
    return { text: `Não deu para atualizar agora${desde}`, tone: "warning" };
  }
  if (props.lastSyncAt) {
    return {
      text: `Sincronizado às ${formatSyncTime(props.lastSyncAt)}`,
      tone: "ok",
    };
  }
  return { text: "Ainda não sincronizado", tone: "muted" };
}

export default function SyncStatusLine({
  pending,
  failed,
  syncing,
  lastSyncAt,
  onSync,
}: Props) {
  const t = useTheme();
  const status = describeSyncStatus({ pending, failed, syncing, lastSyncAt });
  const cor =
    status.tone === "warning" ? t.semantic.warning : t.text.tertiary;
  const Icone = status.tone === "warning" ? CloudOff : Cloud;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginTop: spacing[4],
        minHeight: 32,
      }}
    >
      <Icone size={14} color={cor} />
      <Text
        accessibilityLiveRegion="polite"
        // Duas linhas: a 390 px, ao lado do botão, a frase inteira não cabe
        // em uma — e cortá-la em "salvo ne…" apaga justamente a parte que
        // tranquiliza
        numberOfLines={2}
        style={{
          flex: 1,
          color: cor,
          fontSize: 12,
          lineHeight: 16,
          marginLeft: spacing[2],
        }}
      >
        {status.text}
      </Text>
      <Pressable
        onPress={onSync}
        disabled={syncing}
        accessibilityRole="button"
        accessibilityLabel="Sincronizar agora"
        accessibilityState={{ disabled: syncing }}
        hitSlop={8}
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: 32,
          paddingHorizontal: spacing[3],
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: t.border.subtle,
          opacity: syncing ? 0.5 : 1,
        }}
      >
        <RefreshCw size={12} color={t.text.secondary} />
        <Text
          style={{
            color: t.text.secondary,
            fontSize: 11,
            fontWeight: "700",
            marginLeft: spacing[1],
          }}
        >
          Sincronizar
        </Text>
      </Pressable>
    </View>
  );
}
