const { withAppBuildGradle } = require("expo/config-plugins");

/**
 * Assinatura de RELEASE com chave própria.
 *
 * <p><b>O problema.</b> O template do React Native assina o release com a
 * chave de DEPURAÇÃO — `signingConfig signingConfigs.debug` dentro do bloco
 * `release`, com a chave pública `androiddebugkey`/`android` que todo projeto
 * Android do mundo carrega. Duas consequências, e a segunda é a que o dono
 * sentia toda atualização: qualquer pessoa consegue assinar um "Economize!"
 * falso com a mesma chave, e o Play Protect trata APK de assinante
 * desconhecido com desconfiança — manda para análise e a instalação fica
 * parada depois de o download chegar a 100 %.
 *
 * <p><b>Por que isto é um plugin</b> e não uma edição em
 * `android/app/build.gradle`: aquela pasta é GERADA, e todo
 * `expo prebuild --clean` apaga o que estiver escrito lá. É o mesmo motivo do
 * `withGradleJvmArgs` — correção em pasta gerada é correção que se perde.
 *
 * <p><b>Os segredos não moram aqui.</b> O bloco lê quatro propriedades do
 * Gradle, que ficam em `~/.gradle/gradle.properties`, fora dos dois
 * repositórios. Sem elas o release continua caindo na chave de depuração: a
 * esteira precisa conseguir montar o APK sem ter a chave do dono, e um build
 * que quebrasse por falta de segredo transformaria o CI em refém.
 *
 * <p><b>Trocar a chave custa uma desinstalação.</b> O Android recusa atualizar
 * um app por cima de outro com assinatura diferente. O dono aceitou esse
 * preço em 21/09/2026, uma vez só — e depois dele toda atualização passa
 * direto.
 */
module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    let conteudo = gradleConfig.modResults.contents;

    const blocoDeAssinatura = `        release {
            // Chave própria quando ela existe; sem ela, o comportamento antigo.
            // Ver plugins/withReleaseSigning.js
            storeFile file(project.findProperty('ECONOMIZE_STORE_FILE') ?: 'debug.keystore')
            storePassword project.findProperty('ECONOMIZE_STORE_PASSWORD') ?: 'android'
            keyAlias project.findProperty('ECONOMIZE_KEY_ALIAS') ?: 'androiddebugkey'
            keyPassword project.findProperty('ECONOMIZE_KEY_PASSWORD') ?: 'android'
        }
`;

    // 1. o signingConfig novo entra logo depois do de depuração
    if (!conteudo.includes("ECONOMIZE_STORE_FILE")) {
      conteudo = conteudo.replace(
        /(signingConfigs \{\s*\n\s*debug \{[\s\S]*?\n {8}\}\n)/,
        `$1${blocoDeAssinatura}`,
      );
    }

    // 2. o buildType release passa a usá-lo
    conteudo = conteudo.replace(
      /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
      "$1signingConfig signingConfigs.release",
    );

    if (!conteudo.includes("signingConfig signingConfigs.release")) {
      throw new Error(
        "withReleaseSigning: não achei o bloco de release em build.gradle. " +
          "O template do Expo mudou — confira antes de publicar um APK.",
      );
    }

    gradleConfig.modResults.contents = conteudo;
    return gradleConfig;
  });
};
