// AsyncStorage é nativo e não existe no ambiente de teste. O mock vive aqui, e
// não em cada arquivo, porque agora qualquer componente que use `useTheme()`
// alcança o preferencesStore — e com isso o storage — pela cadeia de imports.
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// O cofre do sistema (Keychain/Keystore) também é nativo. O authStore e o
// segredo do aparelho moram nele, e quase todo store chega ao authStore pela
// API — por isso o mock é global, como o do AsyncStorage: vazio por padrão,
// cada teste diz o que há dentro
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));
