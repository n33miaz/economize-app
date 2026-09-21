import React from "react";
import { Linking, Platform } from "react-native";
import { useBankStore } from "../store/bankStore";
import { ehArquivoDeFora } from "../utils/arquivoRecebido";
import {
  navigateToStatement,
  type StatementNavigator,
} from "../routes/navigateToStatement";

/** O que este gancho precisa do container de navegação, e nada além disso. */
export interface NavegadorDeArquivo extends StatementNavigator {
  isReady?: () => boolean;
}

/**
 * A porta de entrada do "Abrir com › Economize!".
 *
 * Vive na RAIZ da navegação, e não na tela de Extrato, por duas razões: o
 * arquivo pode chegar com o app fechado (e aí quem o entrega é a URL inicial,
 * lida uma vez só, antes de qualquer tela existir) e pode chegar com a pessoa
 * deslogada (e aí ele espera a sessão em vez de se perder). A tela de Extrato
 * continua dona do envio e do que dizer sobre o resultado; aqui só se recebe,
 * se parqueia e se leva até lá.
 *
 * O mesmo evento `url` também traz a volta do conector bancário
 * (`economize://conectar#item=...`), escutada dentro da tela de Extrato. Os dois
 * caminhos não se atrapalham porque a separação é por esquema: `ehArquivoDeFora`
 * só reconhece `content://` e `file://`, que nenhum link nosso usa.
 */
export function useArquivoRecebido(
  navegador: NavegadorDeArquivo | null,
  autenticado: boolean,
): void {
  const receberArquivo = useBankStore((s) => s.receberArquivo);
  const arquivoRecebido = useBankStore((s) => s.arquivoRecebido);

  React.useEffect(() => {
    // No navegador não existe "abrir com": a URL inicial é a da própria página,
    // e escutá-la aqui só criaria um caminho que nunca dispara
    if (Platform.OS === "web") return;

    let vivo = true;
    Linking.getInitialURL()
      .then((url) => {
        if (vivo && ehArquivoDeFora(url)) receberArquivo(url as string);
      })
      .catch(() => {
        // sem URL inicial é o caso normal (o app abriu pelo ícone)
      });

    // A atividade é `singleTask`: com o app já aberto, o arquivo chega por aqui
    // e não pela URL inicial — que continuaria sendo a da abertura anterior
    const inscricao = Linking.addEventListener("url", ({ url }) => {
      if (ehArquivoDeFora(url)) receberArquivo(url);
    });

    return () => {
      vivo = false;
      inscricao.remove();
    };
  }, [receberArquivo]);

  React.useEffect(() => {
    if (!arquivoRecebido || !autenticado || !navegador) return;
    // Enquanto o container não estiver pronto, navegar é um erro silencioso; o
    // efeito roda de novo quando a sessão ou o arquivo mudarem, e a abertura
    // normal do app já deixa o container pronto antes de qualquer toque
    if (navegador.isReady && !navegador.isReady()) return;
    navigateToStatement(navegador);
  }, [arquivoRecebido, autenticado, navegador]);
}
