const { withGradleProperties } = require("expo/config-plugins");

/**
 * Heap do Gradle para o build de release.
 *
 * <p>Com os 2 GB padrão o `collectReleaseDependencies` estoura o heap perto do
 * fim do build — quinze minutos de compilação perdidos no último passo. O
 * valor vivia editado à mão em `android/gradle.properties`, que é pasta
 * gerada: todo `expo prebuild` apagava a correção e o build voltava a morrer.
 */
module.exports = function withGradleJvmArgs(config) {
  return withGradleProperties(config, (gradleConfig) => {
    const key = "org.gradle.jvmargs";
    const value = "-Xmx4096m -XX:MaxMetaspaceSize=1024m";
    const existing = gradleConfig.modResults.find(
      (item) => item.type === "property" && item.key === key,
    );
    if (existing) {
      existing.value = value;
    } else {
      gradleConfig.modResults.push({ type: "property", key, value });
    }
    return gradleConfig;
  });
};
