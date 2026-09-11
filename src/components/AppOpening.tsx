import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeOut } from "react-native-reanimated";

import BrandOpening from "./BrandOpening";
import { useOpeningStore } from "../store/openingStore";
import { useTheme } from "../theme/ThemeProvider";
import { spacing } from "../theme/ds";

/**
 * A cortina de abertura de quem já está dentro.
 *
 * <p><b>O defeito.</b> A abertura — o pote enchendo, a moeda caindo, o pote
 * subindo — só tocava na tela de Login. Quem abre o app autenticado, que é
 * quem o usa todo dia, caía direto num esqueleto cinza. A melhor peça de
 * movimento do app era vista exatamente por quem já tinha decidido usá-lo, e
 * escondida de quem já usa.
 *
 * <p><b>A regra dura, herdada do Login.</b> A animação ACOMPANHA o
 * carregamento, ela não é o motivo da espera. Quem manda no fim é o sinal da
 * Home: se os dados chegam antes de a moeda cair, a subida acontece na hora.
 *
 * <p><b>E ela tem DOIS tetos, não um.</b> O primeiro para de esperar a Home e
 * manda a animação terminar; o segundo tira a cortina da frente
 * <b>independentemente da animação</b>. A diferença não é preciosismo: esta
 * View cobre a tela inteira, e ela sai quando o {@code onSettled} do
 * Reanimated dispara. Um callback que não chega — reduzir movimento, uma
 * peculiaridade da web, o app voltando do segundo plano no meio da sequência —
 * deixaria o usuário preso atrás de uma animação parada. O segundo teto é o
 * que garante que a pior falha possível aqui seja uma animação feia, nunca um
 * app travado.
 */

/**
 * Quanto a cortina espera pela Home antes de mandar a animação terminar.
 *
 * <p>Dois segundos e meio: é o tempo em que a API de produção responde a
 * consolidação do mês em condições normais (0,1 CPU, banco em outra região).
 * Acima disso o problema é a rede, e prender a tela não melhora nada.
 */
const TETO_ESPERA_MS = 2500;

/**
 * Quanto a cortina existe, no pior caso.
 *
 * <p>A sequência do {@code BrandOpening} leva cerca de 1,4 s depois do sinal.
 * 2,5 s de espera + a sequência + folga = 4,5 s. Passado isso a cortina sai
 * seca, sem animação nenhuma.
 */
const TETO_TOTAL_MS = 4500;

export default function AppOpening({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  const done = useOpeningStore((s) => s.done);
  const ready = useOpeningStore((s) => s.ready);
  const finish = useOpeningStore((s) => s.finish);
  const [estourou, setEstourou] = useState(false);

  useEffect(() => {
    if (done) return;
    const espera = setTimeout(() => setEstourou(true), TETO_ESPERA_MS);
    // Não depende da animação: chama `finish` direto
    const total = setTimeout(finish, TETO_TOTAL_MS);
    return () => {
      clearTimeout(espera);
      clearTimeout(total);
    };
  }, [done, finish]);

  if (done) return <>{children}</>;

  return (
    <View style={{ flex: 1 }}>
      {children}
      <Animated.View
        exiting={FadeOut.duration(220)}
        style={{
          ...StyleSheetAbsoluteFill,
          backgroundColor: t.background.base,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* O nome fica ACIMA do pote, e não abaixo, por causa da coreografia:
            o pote nasce 128 px abaixo do lugar dele e sobe até lá. Embaixo,
            o nome ficava coberto pelo pote durante a espera inteira — o Login
            resolve revelando o nome só depois da subida, mas aqui a cortina
            sai junto com a subida, e o nome nunca apareceria */}
        <Text
          style={{
            color: t.text.tertiary,
            fontSize: 13,
            marginBottom: spacing[6],
          }}
        >
          Economize!
        </Text>
        <BrandOpening ready={ready || estourou} size={112} onSettled={finish} />
      </Animated.View>
    </View>
  );
}

/** `position: absolute` cobrindo o pai, sem depender do StyleSheet. */
const StyleSheetAbsoluteFill = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
