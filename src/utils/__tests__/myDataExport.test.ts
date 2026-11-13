import { Platform, Share } from "react-native";
import * as FileSystem from "expo-file-system";

import { downloadMyData } from "../myDataExport";

jest.mock("expo-file-system", () => ({
  cacheDirectory: "file:///cache/",
  downloadAsync: jest.fn(),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn().mockResolvedValue("UEsDBA=="),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: { Base64: "base64" },
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(),
    createFileAsync: jest.fn(),
  },
}));

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {},
  fetchMyDataZip: jest.fn(),
  myDataFileName: () => "economize-meus-dados-2026-11-13.zip",
  myDataExportRequest: () => ({
    url: "https://api.test/api/v1/users/me/export",
    headers: { Authorization: "Bearer t", "X-App-Version": "2.4.0" },
  }),
}));

const fs = FileSystem as unknown as {
  downloadAsync: jest.Mock;
  deleteAsync: jest.Mock;
  writeAsStringAsync: jest.Mock;
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.Mock;
    createFileAsync: jest.Mock;
  };
};

const original = Platform.OS;
const plataforma = (os: string) =>
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });

const DESTINO = "file:///cache/economize-meus-dados-2026-11-13.zip";

describe("downloadMyData no aparelho", () => {
  afterEach(() => {
    plataforma(original);
    jest.clearAllMocks();
  });

  it("baixa com a sessão e a versão, e apaga o arquivo do cache no fim", async () => {
    plataforma("ios");
    fs.downloadAsync.mockResolvedValue({ status: 200 });
    const compartilhar = jest
      .spyOn(Share, "share")
      .mockResolvedValue({ action: "sharedAction" } as never);

    await expect(downloadMyData()).resolves.toBe(true);

    expect(fs.downloadAsync).toHaveBeenCalledWith(
      "https://api.test/api/v1/users/me/export",
      DESTINO,
      { headers: { Authorization: "Bearer t", "X-App-Version": "2.4.0" } },
    );
    expect(compartilhar).toHaveBeenCalledWith(
      expect.objectContaining({ url: DESTINO }),
    );
    expect(fs.deleteAsync).toHaveBeenCalledWith(DESTINO, { idempotent: true });
  });

  it("no Android grava o ZIP binário pelo SAF, em base64", async () => {
    plataforma("android");
    fs.downloadAsync.mockResolvedValue({ status: 200 });
    fs.StorageAccessFramework.requestDirectoryPermissionsAsync.mockResolvedValue(
      { granted: true, directoryUri: "content://pasta" },
    );
    fs.StorageAccessFramework.createFileAsync.mockResolvedValue(
      "content://pasta/arquivo",
    );

    await expect(downloadMyData()).resolves.toBe(true);

    expect(fs.StorageAccessFramework.createFileAsync).toHaveBeenCalledWith(
      "content://pasta",
      "economize-meus-dados-2026-11-13",
      "application/zip",
    );
    expect(fs.writeAsStringAsync).toHaveBeenCalledWith(
      "content://pasta/arquivo",
      "UEsDBA==",
      { encoding: "base64" },
    );
    expect(fs.deleteAsync).toHaveBeenCalledWith(DESTINO, { idempotent: true });
  });

  it("resposta que não é 200 vira erro com o status, e o cache é limpo", async () => {
    plataforma("ios");
    fs.downloadAsync.mockResolvedValue({ status: 429 });

    await expect(downloadMyData()).rejects.toMatchObject({
      response: { status: 429 },
    });
    expect(fs.deleteAsync).toHaveBeenCalled();
  });
});
