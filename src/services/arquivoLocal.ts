import * as FileSystem from "expo-file-system";

/**
 * A metade do "Abrir com" que toca em disco.
 *
 * Fica separada da lógica (`utils/arquivoRecebido.ts`) por um motivo prático:
 * o que está aqui depende do Android de verdade e só se prova no aparelho,
 * enquanto o que está lá se prova em teste. Manter a fronteira nítida deixa o
 * store testável sem simular sistema de arquivos — ele simula ESTE módulo.
 */

/** Quantos bytes bastam para reconhecer a assinatura de qualquer formato aceito. */
export const BYTES_PARA_RECONHECER = 512;

/**
 * Traz o arquivo do provedor de conteúdo para um caminho nosso.
 *
 * Uma URI `content://` é um endereço emprestado: quem a entregou concedeu
 * permissão de leitura para esta abertura do app, e ela pode ser revogada
 * assim que a tela que a cedeu morrer. Copiar primeiro é o que garante que o
 * upload — que pode esperar a rede, e o servidor aceita até três minutos — não
 * vá buscar um arquivo que não existe mais no meio do caminho.
 */
export async function copiarParaCache(uri: string): Promise<string> {
  const pasta = FileSystem.cacheDirectory;
  if (!pasta) throw new Error("Sem pasta de cache neste ambiente.");
  const destino = `${pasta}extrato-recebido-${Date.now()}`;
  await FileSystem.copyAsync({ from: uri, to: destino });
  return destino;
}

/**
 * Os primeiros bytes, em base64.
 *
 * `position` e `length` só existem na leitura em base64 — em texto o módulo lê
 * o arquivo inteiro, e um extrato de ano fechado passa de um megabyte. Como só
 * queremos a assinatura, ler meio quilobyte é o suficiente e não paga por um
 * arquivo grande.
 */
export async function lerInicioEmBase64(
  uri: string,
  bytes: number = BYTES_PARA_RECONHECER,
): Promise<string> {
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
    position: 0,
    length: bytes,
  });
}
