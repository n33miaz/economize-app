// Grava public/version.json com o commit que está sendo publicado.
//
// Para que serve: a conferência pós-deploy (.github/workflows/conferir-producao.yml)
// consulta /version.json no site e espera ver o commit juntado — é assim que ela
// sabe que o Render terminou de publicar o build NOVO, e não está servindo o velho.
//
// Por que no `postinstall`: o buildCommand do Render é
// `npm ci && npx expo export ...` e o `npm ci` roda o postinstall do projeto.
// Pendurar aqui dispensa mexer no buildCommand (que só muda no painel se o
// blueprint for sincronizado). O `expo export` copia public/ para dist/.
//
// O Render expõe RENDER_GIT_COMMIT também no build de site estático. Fora dele
// (máquina local, esteira) o valor é "local". O arquivo é gerado, não versionado
// (ver .gitignore). O npm roda o postinstall na raiz do projeto, daí o cwd.
// Nada aqui pode derrubar a instalação: falhou, só avisa.
const fs = require("fs");
const path = require("path");

try {
  const commit = (process.env.RENDER_GIT_COMMIT || "").trim() || "local";
  const destino = path.join(process.cwd(), "public", "version.json");
  const conteudo = { commit, builtAt: new Date().toISOString() };
  fs.writeFileSync(destino, JSON.stringify(conteudo) + "\n");
  console.log(`version.json: ${commit}`);
} catch (erro) {
  console.warn(`version.json não gravado: ${erro.message}`);
}
