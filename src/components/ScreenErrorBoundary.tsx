import React from "react";
import { View } from "react-native";

import ErrorState from "./ErrorState";

interface Props {
  children: React.ReactNode;
}

interface State {
  failed: boolean;
  /** Muda a cada "Tentar de novo": é o que faz a tela nascer de novo. */
  attempt: number;
}

/**
 * Limite de erro de UMA tela.
 *
 * Sem ele, uma exceção durante a renderização sobe até a raiz e o React
 * desmonta o app inteiro — sobrava a tela de abertura, sem barra de abas e
 * sem caminho de volta, por causa de um número nulo num cartão. Com ele, a
 * tela que falhou vira um aviso com "Tentar de novo" e o resto (as outras
 * abas, a navegação, a sessão) segue de pé.
 *
 * <p>É classe porque o React só oferece `getDerivedStateFromError` em
 * componente de classe. Não tenta consertar nada: remonta a tela e, se ela
 * falhar de novo, mostra o aviso de novo.
 */
export default class ScreenErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Fica no console de propósito: é o único rastro do que derrubou a tela
    console.error("Tela derrubada por erro de renderização:", error);
  }

  private retry = () => {
    this.setState((prev) => ({ failed: false, attempt: prev.attempt + 1 }));
  };

  render() {
    if (this.state.failed) {
      return (
        <View style={{ flex: 1 }}>
          <ErrorState
            title="Esta tela falhou"
            message="O resto do app segue funcionando."
            onRetry={this.retry}
          />
        </View>
      );
    }
    return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
  }
}

/**
 * Envolve uma tela no limite. Chame em escopo de módulo: o navegador precisa
 * receber sempre o MESMO componente, senão remonta a tela a cada render.
 */
export function withScreenBoundary<P extends object>(
  Screen: React.ComponentType<P>,
): React.ComponentType<P> {
  const Guarded = (props: P) => (
    <ScreenErrorBoundary>
      <Screen {...props} />
    </ScreenErrorBoundary>
  );
  Guarded.displayName = `ScreenBoundary(${Screen.displayName || Screen.name || "Tela"})`;
  return Guarded;
}
