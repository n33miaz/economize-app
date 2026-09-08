// Auditoria de dependência calibrada para o que REALMENTE vai no aparelho.
//
// `npm audit --omit=dev` sozinho reprova este projeto sempre, e por um motivo
// que não é do projeto: o `react-native` e o `expo` declaram como dependência
// de produção o próprio ferramental de build (metro, @expo/cli, dev-middleware,
// react-devtools-core). Nada disso entra no bundle — nem no site, nem no APK —
// mas o npm não tem como saber. Medido em 08/09/2026: 54 alertas, 24 altos, 2
// críticos, e nenhum deles chegava ao usuário.
//
// Uma esteira que reprova sempre não é um portão: é um alarme que todo mundo
// aprende a ignorar. Por isso a regra aqui é mais estreita e mais útil:
//
//   1. reprova quando o pacote com alerta ALTO ou CRÍTICO é uma dependência
//      DIRETA — aquilo que este repositório escolheu e pode trocar;
//   2. dispensa o que está em ACEITOS, com o motivo escrito ao lado;
//   3. imprime o resto inteiro, sem reprovar, para não esconder nada.
//
// O caso que a regra pegou no dia em que foi escrita: `axios` com SSRF e
// vazamento de credencial por URL absoluta. Esse SIM vai no aparelho — é o
// cliente HTTP do app — e foi atualizado.

import { readFileSync } from "node:fs";

/**
 * Alerta aceito, com o porquê. Entrar aqui é decisão consciente, não silêncio:
 * quem adicionar uma linha precisa escrever o motivo, e quem ler a esteira vê
 * exatamente o que está sendo tolerado.
 */
const ACEITOS = {
  expo:
    "os alertas vêm de @expo/cli e do que ele arrasta (tar, shell-quote, xmldom). " +
    "É ferramenta de build: não existe no bundle. Subir o Expo fora de um " +
    "upgrade planejado quebra o app inteiro — ver CONTRIBUTING.md",
  "react-native":
    "os alertas vêm de metro e @react-native/dev-middleware, o servidor de " +
    "desenvolvimento. Não existe no bundle de release, e a versão está " +
    "amarrada à do Expo SDK",
};

const GRAVES = new Set(["high", "critical"]);

const auditoria = JSON.parse(readFileSync(0, "utf8"));
const diretas = new Set(
  Object.keys(JSON.parse(readFileSync("package.json", "utf8")).dependencies ?? {}),
);

const vulnerabilidades = Object.values(auditoria.vulnerabilities ?? {});
const graves = vulnerabilidades.filter((v) => GRAVES.has(v.severity));
const emDiretas = graves.filter((v) => diretas.has(v.name));
const reprovam = emDiretas.filter((v) => !(v.name in ACEITOS));

console.log(
  `${vulnerabilidades.length} alerta(s); ${graves.length} alto(s)/crítico(s); ` +
    `${emDiretas.length} em dependência direta.`,
);

for (const v of emDiretas) {
  const motivo = ACEITOS[v.name];
  const titulos = (v.via ?? [])
    .map((x) => (typeof x === "string" ? x : x.title))
    .slice(0, 2)
    .join("; ");
  if (motivo) {
    console.log(`  aceito   ${v.name} (${v.severity}) — ${motivo}`);
  } else {
    console.log(`  REPROVA  ${v.name} (${v.severity}) — ${titulos}`);
  }
}

if (reprovam.length > 0) {
  console.log(
    "\n::error::dependência direta com alerta alto ou crítico: " +
      reprovam.map((v) => v.name).join(", ") +
      ". Atualize o pacote, ou justifique em ACEITOS de .github/scripts/auditar-dependencias.mjs",
  );
  process.exit(1);
}

console.log("\nNenhuma dependência direta com alerta grave sem justificativa.");
