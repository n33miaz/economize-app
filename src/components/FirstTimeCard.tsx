import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import X from "lucide-react-native/dist/esm/icons/x";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { usePreferencesStore } from "../store/preferencesStore";

interface Props {
  /** Identidade do cartão. É por ela que o "dispensado" é lembrado. */
  id: string;
  title: string;
  /** Uma frase. Se precisar de duas, a tela está explicando demais. */
  body: string;
}

/**
 * A primeira vez de cada tela explica — EC-228.
 *
 * <p><b>O que isto NÃO é.</b> Não é tour, não é overlay, não é sequência de
 * balões numerados que sequestra o app na primeira abertura. Tour é um
 * pedágio: aparece quando a pessoa quer usar o app, e é sempre no momento
 * errado.
 *
 * <p>É um cartão que mora <b>dentro</b> da tela que ele explica, na posição
 * onde a dúvida acontece. Ele não bloqueia nada, e a pessoa que já entendeu
 * simplesmente rola por cima dele.
 *
 * <p><b>Some para sempre.</b> Dispensar é definitivo e fica guardado no
 * aparelho. Um cartão que volta depois de dispensado ensina que o X não
 * funciona — e a partir daí o usuário para de fechar qualquer coisa.
 *
 * <p>Uma frase de corpo, nunca duas. Se a tela precisa de um parágrafo para
 * ser entendida, o problema é a tela.
 */
export default function FirstTimeCard({ id, title, body }: Props) {
  const t = useTheme();
  const dismissed = usePreferencesStore((s) => s.dismissedHints);
  const dismiss = usePreferencesStore((s) => s.dismissHint);

  if (dismissed.includes(id)) return null;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing[3],
        backgroundColor: t.background.elevated,
        borderWidth: 1,
        borderColor: t.border.subtle,
        borderRadius: radius.xl,
        padding: spacing[4],
        marginBottom: spacing[4],
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: t.text.primary,
            fontSize: 13,
            fontWeight: "700",
            marginBottom: 2,
          }}
        >
          {title}
        </Text>
        <Text style={{ color: t.text.secondary, fontSize: 12, lineHeight: 17 }}>
          {body}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => dismiss(id)}
        accessibilityLabel={`Dispensar explicação: ${title}`}
        accessibilityRole="button"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={{ minHeight: 24, minWidth: 24, alignItems: "center" }}
      >
        <X size={16} color={t.text.tertiary} />
      </TouchableOpacity>
    </View>
  );
}
