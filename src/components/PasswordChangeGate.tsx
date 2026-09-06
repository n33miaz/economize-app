import React, { useEffect } from "react";
import { View } from "react-native";

import ChangePassword from "../screens/ChangePassword";
import { useAuthStore } from "../store/authStore";
import { useUserStore } from "../store/userStore";
import { useTheme } from "../theme/ThemeProvider";

interface Props {
  children: React.ReactNode;
}

/**
 * Senha provisória: nada do app antes de trocá-la.
 *
 * <p>Uma conta criada por outra pessoa nasce com uma senha que o dono não
 * escolheu e que alguém mais conhece. Deixar essa conta navegar normalmente
 * seria dizer "só você entra aqui" sabendo que não é verdade — então a troca
 * não é um aviso que se pode dispensar, é a única tela disponível.
 *
 * <p>Quem manda é o SERVIDOR ({@code GET /users/me}), e não uma decisão local:
 * fosse do app, bastaria entrar por outro cliente para pular a troca.
 */
export default function PasswordChangeGate({ children }: Props) {
  const t = useTheme();
  const token = useAuthStore((s) => s.token);
  const me = useUserStore((s) => s.me);
  const isLoading = useUserStore((s) => s.isLoading);
  const fetchMe = useUserStore((s) => s.fetchMe);

  useEffect(() => {
    // Uma vez por sessão: as telas que precisam do perfil já chamam de novo, e
    // repetir aqui a cada render viraria uma requisição por quadro
    if (token && !me && !isLoading) fetchMe();
  }, [token, me, isLoading, fetchMe]);

  if (!token) return <>{children}</>;

  // Enquanto a resposta não chega, o app segue: a pendência é rara, e prender
  // TODA abertura num spinner por causa dela cobraria o preço no lugar errado.
  // O servidor continua sendo a autoridade — a tela aparece assim que a
  // resposta chegar.
  if (!me?.mustChangePassword) return <>{children}</>;

  return (
    <View style={{ flex: 1, backgroundColor: t.background.base }}>
      <ChangePassword forced />
    </View>
  );
}
