// Os ícones do lucide entram um a um por caminho profundo, e não pelo barril:
// o Metro não faz tree-shaking, então `import { X } from "lucide-react-native"`
// arrastava as ~1.770 famílias de ícone para dentro do pacote web.
//
// O caminho aponta para `dist/esm` porque o subcaminho oficial
// ("lucide-react-native/icons/x") depende do mapa de "exports", que o Metro do
// SDK 52 só resolve com unstable_enablePackageExports — uma chave global que
// mudaria a resolução de todas as outras dependências.
//
// Esta declaração existe porque o TypeScript resolve em modo node10: ele não
// enxerga `.mjs` nem o mapa de "exports", e sem ela cada `<Icon />` viraria
// `any`. O jest continua no build CJS, mapeado em package.json.
declare module "lucide-react-native/dist/esm/icons/*" {
  import type { LucideIcon } from "lucide-react-native";

  const Icon: LucideIcon;
  export default Icon;
}
