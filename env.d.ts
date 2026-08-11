declare namespace NodeJS {
  interface ProcessEnv {
    // URL base da API, incluindo /api/v1 — ver .env.example
    EXPO_PUBLIC_API_BASE_URL?: string;
  }
}
