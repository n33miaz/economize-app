jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

import { usePreferencesStore } from "../preferencesStore";

describe("preferencesStore", () => {
  beforeEach(() => {
    usePreferencesStore.getState().reset();
  });

  it("starts with dark theme as default", () => {
    expect(usePreferencesStore.getState().theme).toBe("dark");
  });

  it("toggles biometric flag", () => {
    expect(usePreferencesStore.getState().biometricLogin).toBe(false);
    usePreferencesStore.getState().toggleBiometric();
    expect(usePreferencesStore.getState().biometricLogin).toBe(true);
    usePreferencesStore.getState().toggleBiometric();
    expect(usePreferencesStore.getState().biometricLogin).toBe(false);
  });

  it("updates default currency", () => {
    usePreferencesStore.getState().setDefaultCurrency("USD");
    expect(usePreferencesStore.getState().defaultCurrency).toBe("USD");
  });

  it("toggles hideBalance", () => {
    expect(usePreferencesStore.getState().hideBalance).toBe(false);
    usePreferencesStore.getState().toggleHideBalance();
    expect(usePreferencesStore.getState().hideBalance).toBe(true);
  });

  it("changes theme mode", () => {
    usePreferencesStore.getState().setTheme("light");
    expect(usePreferencesStore.getState().theme).toBe("light");
    usePreferencesStore.getState().setTheme("system");
    expect(usePreferencesStore.getState().theme).toBe("system");
  });
});
