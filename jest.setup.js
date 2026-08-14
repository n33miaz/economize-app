// AsyncStorage é nativo e não existe no ambiente de teste. O mock vive aqui, e
// não em cada arquivo, porque agora qualquer componente que use `useTheme()`
// alcança o preferencesStore — e com isso o storage — pela cadeia de imports.
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));
