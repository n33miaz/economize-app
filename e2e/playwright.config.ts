import { defineConfig } from "@playwright/test";

// Quem sobe a pilha e define estas duas variáveis é o `run.sh`
const webUrl = process.env.E2E_WEB_URL;
if (!webUrl || !process.env.E2E_API_URL) {
  throw new Error("Rode pelo e2e/run.sh: faltam E2E_WEB_URL e E2E_API_URL.");
}

export default defineConfig({
  testDir: "./tests",
  // `.e2e.ts` de propósito: o jest do app casa `*.spec.ts` e `*.test.ts`
  testMatch: /.*\.e2e\.ts$/,
  outputDir: "./artifacts/test-results",
  // Um roteiro só, em série, numa página só: a sessão nasce pelo formulário
  // e os passos dependem um do outro, como dependem para quem usa o app
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["json", { outputFile: "./artifacts/resultado.json" }]],
  use: {
    baseURL: webUrl,
    // WebKit porque o alvo do dono é o Safari do iPhone 12. Viewport (390x664),
    // tema e fuso ficam em tests/apoio.ts, junto do contexto que o roteiro abre
    browserName: "webkit",
    trace: "off",
    video: "off",
  },
});
