import React, { useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import Merge from "lucide-react-native/dist/esm/icons/merge";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import type { AccountMergeSuggestion } from "../services/api";

/**
 * "Estas duas parecem a mesma conta."
 *
 * <p><b>O defeito, medido na conta do dono em 16/09/2026.</b> Ele disse que
 * "os números parecem estar meio embaralhados". A conta do Inter existia duas
 * vezes: uma origem solta, criada pelos arquivos que ele importou, com
 * <b>1.632 dos 1.967 lançamentos</b> e nenhum saldo; e uma origem ligada,
 * trazida pelo conector, com 75 lançamentos e o saldo de R$ 250,00. O Mercado
 * Pago tinha três origens; o Nubank, duas. Toda tela que agrupa por origem
 * mostrava o mesmo banco repetido, com números que não fecham.
 *
 * <p><b>Por que o app pergunta em vez de juntar sozinho.</b> A adoção
 * automática exige nome e instituição iguais, e é estreita de propósito:
 * adotar a conta errada mistura o histórico de dois cartões, erro pior do que a
 * duplicata. Nos pares dele nada batia — "Inter ····2750" contra "BANCO INTER
 * ····2750". Afrouxar aquela regra trocaria um erro visível por um silencioso.
 * Quem sabe se são a mesma conta é o dono; o app mostra o par, diz quantos
 * lançamentos estão de cada lado e deixa a decisão com ele.
 *
 * <p><b>O card diz o que vai acontecer antes de acontecer</b>: qual conta
 * desaparece, qual fica, e quantos lançamentos mudam de lugar. Fusão é
 * irreversível pelo app, e botão irreversível sem essa frase é armadilha.
 */
export default function DuplicateAccountsCard({
  suggestions,
  onMerge,
}: {
  suggestions: AccountMergeSuggestion[];
  /** Resolve quando a fusão terminou; a tela recarrega as contas depois. */
  onMerge: (suggestion: AccountMergeSuggestion) => Promise<void>;
}) {
  const t = useTheme();
  const [juntando, setJuntando] = useState<string | null>(null);

  if (suggestions.length === 0) return null;

  return (
    <View
      style={{
        backgroundColor: t.background.surface,
        borderWidth: 1,
        borderColor: t.semantic.warning,
        borderRadius: radius["2xl"],
        padding: spacing[4],
        marginBottom: spacing[4],
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.full,
            backgroundColor: t.semantic.warningMuted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Merge size={18} color={t.semantic.warning} />
        </View>
        <View style={{ flex: 1, marginLeft: spacing[3] }}>
          <Text
            style={{ color: t.text.primary, fontSize: 15, fontWeight: "700" }}
          >
            {suggestions.length === 1
              ? "Uma conta parece estar duplicada"
              : `${suggestions.length} contas parecem estar duplicadas`}
          </Text>
          <Text
            style={{
              color: t.text.secondary,
              fontSize: 12,
              lineHeight: 17,
              marginTop: 2,
            }}
          >
            O mesmo banco entrou por arquivo e pelo conector. Enquanto forem
            duas, os totais por conta não fecham — e o saldo fica só de um lado.
          </Text>
        </View>
      </View>

      <View style={{ marginTop: spacing[4], gap: spacing[4] }}>
        {suggestions.map((s) => {
          const ocupado = juntando === s.sourceId;
          return (
            <View key={s.sourceId}>
              <Text
                style={{
                  color: t.text.tertiary,
                  fontSize: 11,
                  fontWeight: "700",
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                }}
              >
                {`Terminam em ${s.digits}`}
              </Text>

              <Text
                style={{
                  color: t.text.secondary,
                  fontSize: 13,
                  lineHeight: 19,
                  marginTop: spacing[2],
                }}
              >
                <Text style={{ color: t.text.primary, fontWeight: "700" }}>
                  {s.sourceName}
                </Text>
                {` (${contar(s.sourceTransactions)}, sem sincronização) vai virar `}
                <Text style={{ color: t.text.primary, fontWeight: "700" }}>
                  {s.targetName}
                </Text>
                {` (${contar(s.targetTransactions)}, ligada ao banco).`}
              </Text>

              <TouchableOpacity
                onPress={async () => {
                  setJuntando(s.sourceId);
                  try {
                    await onMerge(s);
                  } finally {
                    setJuntando(null);
                  }
                }}
                disabled={ocupado}
                accessibilityRole="button"
                accessibilityLabel={`Juntar ${s.sourceName} em ${s.targetName}. ${contar(
                  s.sourceTransactions,
                )} mudam de conta`}
                accessibilityState={{ disabled: ocupado, busy: ocupado }}
                activeOpacity={0.85}
                style={{
                  minHeight: 44,
                  marginTop: spacing[3],
                  borderRadius: radius.full,
                  backgroundColor: t.accent.neon,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: ocupado ? 0.7 : 1,
                }}
              >
                {ocupado ? (
                  <ActivityIndicator color={t.text.inverse} />
                ) : (
                  <Text
                    style={{
                      color: t.text.inverse,
                      fontSize: 14,
                      fontWeight: "700",
                    }}
                  >
                    Juntar as duas
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      <Text
        style={{
          color: t.text.tertiary,
          fontSize: 11,
          lineHeight: 16,
          marginTop: spacing[4],
        }}
      >
        Nada é apagado: os lançamentos mudam de conta e o histórico continua
        inteiro. O que desaparece é a origem repetida.
      </Text>
    </View>
  );
}

/** "1 lançamento" / "1.632 lançamentos" — plural e milhar na mesma frase. */
function contar(quantidade: number): string {
  const numero = quantidade.toLocaleString("pt-BR");
  return quantidade === 1 ? `${numero} lançamento` : `${numero} lançamentos`;
}
