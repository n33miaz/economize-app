module.exports = {
  root: true,
  extends: ["expo"],
  ignorePatterns: ["dist/*", "mock-worklets/*", "*.config.js"],
  overrides: [
    {
      // Setup do jest roda fora do preset de teste: sem isto o `jest` global
      // do arquivo vira erro de no-undef
      files: ["jest.setup.js", "**/__tests__/**", "**/*.test.{ts,tsx}"],
      env: { jest: true },
    },
  ],
};
