import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";

import {
  fetchMyDataZip,
  myDataExportRequest,
  myDataFileName,
} from "../services/api";
import { downloadBlobOnWeb, saveFileOnDevice } from "./saveFile";

/**
 * "Baixar meus dados" (LGPD): o ZIP que o servidor monta com tudo da conta.
 *
 * <p>No aparelho o ZIP é baixado direto para o disco (`downloadAsync`) e só
 * então entregue pelo mesmo caminho do backup das Opções avançadas. O arquivo
 * do cache é apagado no fim, entregue ou não: são todos os dados financeiros
 * da pessoa, e não têm por que ficar esquecidos numa pasta do app.
 *
 * Devolve `false` quando a pessoa desistiu de escolher a pasta (Android).
 */
export async function downloadMyData(): Promise<boolean> {
  const fileName = myDataFileName();
  if (Platform.OS === "web") {
    downloadBlobOnWeb(await fetchMyDataZip(), fileName);
    return true;
  }
  const pasta = FileSystem.cacheDirectory;
  if (!pasta) throw new Error("Sem pasta de cache neste ambiente.");
  const destino = `${pasta}${fileName}`;
  const { url, headers } = myDataExportRequest();
  try {
    const resultado = await FileSystem.downloadAsync(url, destino, { headers });
    if (resultado.status !== 200) {
      // mesmo formato do erro do axios: quem mostra a falha lê o status dali
      throw Object.assign(new Error(`HTTP ${resultado.status}`), {
        response: { status: resultado.status },
      });
    }
    return await saveFileOnDevice({
      fileName,
      mimeType: "application/zip",
      sourceUri: destino,
    });
  } finally {
    await FileSystem.deleteAsync(destino, { idempotent: true }).catch(() => {});
  }
}
