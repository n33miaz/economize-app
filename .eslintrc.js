// Mesma lista de extensões do eslint-config-expo (base + variantes de
// plataforma, nesta ordem de prioridade) acrescida de ".mjs": os ícones do
// lucide entram por caminho profundo e o arquivo publicado é .mjs, que o
// resolvedor do plugin de import não procura sozinho
const BASE_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".d.ts"];
const PLATFORM_SUBEXTENSIONS = [".android", ".ios", ".web", ".native", ""];
const RESOLVER_EXTENSIONS = [
  ...PLATFORM_SUBEXTENSIONS.flatMap((platform) =>
    BASE_EXTENSIONS.map((extension) => `${platform}${extension}`),
  ),
  ".mjs",
];

module.exports = {
  root: true,
  extends: ["expo"],
  ignorePatterns: ["dist/*", "mock-worklets/*", "*.config.js"],
  overrides: [
    {
      files: ["**/*.ts", "**/*.tsx"],
      settings: {
        "import/resolver": { node: { extensions: RESOLVER_EXTENSIONS } },
      },
    },
    {
      // Setup do jest roda fora do preset de teste: sem isto o `jest` global
      // do arquivo vira erro de no-undef
      files: ["jest.setup.js", "**/__tests__/**", "**/*.test.{ts,tsx}"],
      env: { jest: true },
    },
  ],
};
