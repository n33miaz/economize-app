import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import SyncStatusLine, { describeSyncStatus } from "../SyncStatusLine";
import { formatSyncTime } from "../../utils/shopping";

const AS_14H32 = new Date("2026-09-21T14:32:00").getTime();

describe("describeSyncStatus", () => {
  it("offline no mercado é o caso normal: a frase tranquiliza em vez de acusar", () => {
    expect(describeSyncStatus({ pending: true, failed: true, syncing: false, lastSyncAt: null })).toEqual({
      text: "Ainda não sincronizado · salvo neste aparelho",
      tone: "warning",
    });
  });

  it("sincronizando, falhou sem pendência, sincronizado e nunca", () => {
    expect(describeSyncStatus({ pending: false, failed: false, syncing: true, lastSyncAt: null }).text).toBe(
      "Sincronizando…",
    );
    expect(describeSyncStatus({ pending: false, failed: true, syncing: false, lastSyncAt: AS_14H32 }).text).toBe(
      `Não deu para atualizar agora · última às ${formatSyncTime(AS_14H32)}`,
    );
    expect(describeSyncStatus({ pending: false, failed: false, syncing: false, lastSyncAt: AS_14H32 })).toEqual({
      text: `Sincronizado às ${formatSyncTime(AS_14H32)}`,
      tone: "ok",
    });
    expect(describeSyncStatus({ pending: false, failed: false, syncing: false, lastSyncAt: null }).tone).toBe(
      "muted",
    );
  });
});

describe("SyncStatusLine", () => {
  it("o botão sincroniza, e desliga enquanto sincroniza", () => {
    const onSync = jest.fn();
    const { getByLabelText, rerender } = render(
      <SyncStatusLine pending failed={false} syncing={false} lastSyncAt={null} onSync={onSync} />,
    );
    fireEvent.press(getByLabelText("Sincronizar agora"));
    expect(onSync).toHaveBeenCalledTimes(1);

    rerender(<SyncStatusLine pending={false} failed={false} syncing lastSyncAt={null} onSync={onSync} />);
    fireEvent.press(getByLabelText("Sincronizar agora"));
    expect(onSync).toHaveBeenCalledTimes(1);
  });
});
