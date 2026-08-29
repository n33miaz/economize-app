// O mock do AsyncStorage é global, em jest.setup.js
import {
  getCycleAnchorDay,
  selectCycleAnchorDay,
  usePreferencesStore,
} from "../preferencesStore";

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

  it("começa com o ciclo no dia 1 (mês de calendário)", () => {
    expect(usePreferencesStore.getState().cycleAnchorDay).toBe(1);
    expect(getCycleAnchorDay()).toBe(1);
  });

  it("guarda a âncora do ciclo", () => {
    usePreferencesStore.getState().setCycleAnchorDay(12);
    expect(usePreferencesStore.getState().cycleAnchorDay).toBe(12);
  });

  it("prende âncora fora da faixa em vez de gravar janela impossível", () => {
    usePreferencesStore.getState().setCycleAnchorDay(0);
    expect(usePreferencesStore.getState().cycleAnchorDay).toBe(1);
    usePreferencesStore.getState().setCycleAnchorDay(99);
    expect(usePreferencesStore.getState().cycleAnchorDay).toBe(31);
  });

  it("normaliza também na leitura — o valor pode vir corrompido do disco", () => {
    usePreferencesStore.setState({ cycleAnchorDay: 0 });
    expect(selectCycleAnchorDay(usePreferencesStore.getState())).toBe(1);
    expect(getCycleAnchorDay()).toBe(1);
  });
});
