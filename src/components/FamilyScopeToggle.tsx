import React, { useEffect } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { useFamilyStore, type FamilyScope } from "../store/familyStore";
import SegmentedControl from "./SegmentedControl";

interface FamilyScopeToggleProps {
  style?: StyleProp<ViewStyle>;
}

// Largura fixa: são dois rótulos curtos, e a pílula esticada na largura da
// tela viraria uma barra — o controle é um ajuste de leitura, não a leitura
const TOGGLE_WIDTH = 168;

/**
 * Eu / Casa (EC-150). Só existe para quem tem casa: para todo mundo que não
 * tem, a Análise e o Extrato continuam exatamente como eram — nem um pixel a
 * mais. O escopo mora no `familyStore`, em memória, e é o MESMO nas duas
 * telas: trocar para "Casa" na Análise deixa o Extrato em "Casa" também,
 * porque a pergunta ("estou olhando o meu ou o nosso?") é uma só.
 *
 * Quem carrega o grupo é o próprio controle, uma vez por sessão: as telas que
 * o usam não precisam saber que a casa existe para desenhá-lo, e para quem
 * nunca abriu a tela de Família é este `fetch` que faz o alternador aparecer.
 */
export default function FamilyScopeToggle({ style }: FamilyScopeToggleProps) {
  const hasFamily = useFamilyStore((s) => s.hasFamily);
  const hasLoadedOnce = useFamilyStore((s) => s.hasLoadedOnce);
  const isLoading = useFamilyStore((s) => s.isLoading);
  const scope = useFamilyStore((s) => s.scope);
  const setScope = useFamilyStore((s) => s.setScope);
  const fetchFamily = useFamilyStore((s) => s.fetchFamily);

  useEffect(() => {
    if (!hasLoadedOnce && !isLoading) fetchFamily();
  }, [hasLoadedOnce, isLoading, fetchFamily]);

  if (!hasFamily) return null;

  return (
    <View style={[{ width: TOGGLE_WIDTH }, style]}>
      <SegmentedControl<FamilyScope>
        size="sm"
        value={scope}
        onChange={setScope}
        options={[
          { label: "Eu", value: "me" },
          { label: "Casa", value: "family" },
        ]}
      />
    </View>
  );
}
