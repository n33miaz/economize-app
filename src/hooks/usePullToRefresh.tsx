import React, { useCallback, useState } from "react";
import { RefreshControl } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import * as Haptics from "../utils/haptics";

/**
 * Puxar para atualizar, igual em toda tela.
 *
 * <p><b>Por que um hook e não `<RefreshControl>` solto.</b> Cada tela que o
 * escrevia à mão escolhia a própria cor, o próprio estado de "atualizando" e
 * o próprio jeito de evitar a chamada dupla. Resultado: spinner âmbar numa
 * tela e cinza na outra, e telas que disparavam duas requisições quando o
 * dedo escorregava.
 *
 * <p><b>O toque tátil na hora certa.</b> O retorno vem quando a atualização
 * <i>termina</i>, não quando começa — vibrar no gesto seria confirmar que o
 * dedo funcionou, coisa que o próprio movimento do spinner já diz. Vibrar no
 * fim é a informação que o usuário não tem de outro jeito: acabou.
 *
 * @param onRefresh o que recarregar. Pode ser assíncrono; o spinner espera.
 */
export function usePullToRefresh(onRefresh: () => void | Promise<unknown>) {
  const t = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const disparar = useCallback(async () => {
    // Dedo que escorrega dispara duas vezes; a segunda não faz nada
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Falha de recarga não é erro deste hook: quem chamou já mostra o
      // próprio estado de erro, e um toast a mais aqui seria aviso em dobro
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, refreshing]);

  const control = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={disparar}
      tintColor={t.accent.neon}
      colors={[t.accent.neon]}
      progressBackgroundColor={t.background.elevated}
    />
  );

  return { refreshing, control, refresh: disparar };
}
