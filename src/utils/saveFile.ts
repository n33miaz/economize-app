import { Platform, Share } from "react-native";
import * as FileSystem from "expo-file-system";

/**
 * Entregar um arquivo à pessoa — o mesmo caminho para o backup JSON das
 * Opções avançadas e para o ZIP de "Baixar meus dados".
 */

/**
 * Web: Blob + âncora. O navegador não tem o share sheet nativo confiável, e
 * isto funciona em todos, sem lib nova.
 */
export function downloadBlobOnWeb(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revogar na mesma volta do `click()` cancela o download no Safari: ele só
  // começa a ler o blob depois. Um segundo de folga basta e não vaza nada
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface DeviceFile {
  fileName: string;
  mimeType: string;
  /** Conteúdo em texto (o backup JSON)... */
  text?: string;
  /** ...ou um arquivo já baixado no cache do app (o ZIP, que é binário). */
  sourceUri?: string;
}

/**
 * Entrega o arquivo como ARQUIVO no aparelho, e não como texto do share sheet.
 *
 * `Share.share({ message })` atravessa o Binder do Android, que tem teto de
 * ~1 MB por transação: o extrato de dois anos passa disso e o app morria com
 * TransactionTooLargeException. Por isso o conteúdo vai para o disco e só o
 * endereço circula.
 *
 * - iOS: grava no cache (ou usa o já baixado) e compartilha a URL do arquivo
 *   (o share sheet do iOS aceita `url` local e oferece "Salvar em Arquivos").
 * - Android: o `Share` do React Native ignora `url` ali, e o `expo-sharing`
 *   não está instalado. O caminho sem dependência nova é o Storage Access
 *   Framework do próprio expo-file-system: a pessoa escolhe a pasta
 *   (Downloads, Drive...) e o arquivo é gravado lá direto. Binário atravessa
 *   em base64, que é a única codificação binária do módulo.
 *
 * Devolve `false` quando a pessoa desistiu de escolher a pasta.
 */
export async function saveFileOnDevice(file: DeviceFile): Promise<boolean> {
  if (Platform.OS === "android") {
    const saf = FileSystem.StorageAccessFramework;
    const permissao = await saf.requestDirectoryPermissionsAsync();
    if (!permissao.granted) return false;
    // O SAF acrescenta a extensão pelo tipo: passar "x.json" viraria "x.json.json"
    const uri = await saf.createFileAsync(
      permissao.directoryUri,
      file.fileName.replace(/\.[a-z0-9]+$/i, ""),
      file.mimeType,
    );
    if (file.text !== undefined) {
      await FileSystem.writeAsStringAsync(uri, file.text);
    } else if (file.sourceUri) {
      const base64 = await FileSystem.readAsStringAsync(file.sourceUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.writeAsStringAsync(uri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
    return true;
  }
  let fileUri = file.sourceUri;
  if (!fileUri) {
    const pasta = FileSystem.cacheDirectory;
    if (!pasta) throw new Error("Sem pasta de cache neste ambiente.");
    fileUri = `${pasta}${file.fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, file.text ?? "");
  }
  await Share.share({ title: file.fileName, url: fileUri });
  return true;
}
