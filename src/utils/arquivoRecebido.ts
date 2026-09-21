/**
 * O arquivo que chega DE FORA do app — "Abrir com › Economize!".
 *
 * O extrato mora no e-mail ou na pasta de downloads, e até aqui a única porta
 * era o seletor de arquivos dentro da tela de Extrato: abrir o app, achar
 * Finanças, achar Extrato, tocar em Importar, navegar até a pasta. Quem acabou
 * de baixar o OFX está com ele na mão, e o Android já sabe oferecer o app
 * certo — só faltava o app aceitar.
 *
 * Este módulo é a parte PURA desse caminho: decidir se uma URL é um arquivo de
 * fora, descobrir de que formato ele é e dar a ele um nome que o servidor
 * entenda. Nada aqui toca em disco, em rede ou em navegação, porque tudo aqui
 * precisa de teste — o resto do caminho depende do Android e só se prova no
 * aparelho.
 *
 * **Por que descobrir o formato dói.** Uma URI `content://` não carrega o nome
 * do arquivo: ela é o endereço de um provedor de conteúdo, e o nome de exibição
 * vive numa coluna que só código nativo lê. Mas o servidor decide o parser
 * pela EXTENSÃO do nome que recebe (`StatementFormat.fromFilename`), e recusa
 * o que não termina em `.ofx`, `.csv`, `.xlsx`, `.pdf` ou `.txt`. Então o app
 * precisa saber o formato antes de enviar, e tem duas pistas: o que a própria
 * URI deixa escapar, e os primeiros bytes do arquivo.
 */

/** Os formatos que o servidor sabe ler. Fora desta lista ele responde 400. */
export const FORMATOS_DE_EXTRATO = [
  "ofx",
  "csv",
  "xlsx",
  "xls",
  "pdf",
  "txt",
] as const;

export type FormatoDeExtrato = (typeof FORMATOS_DE_EXTRATO)[number];

/**
 * O tipo declarado no multipart. O servidor não olha para ele (decide pela
 * extensão), mas um tipo honesto evita que uma camada no meio do caminho —
 * proxy, log, o próprio Android — trate o corpo como binário opaco.
 */
const MIME_POR_FORMATO: Record<FormatoDeExtrato, string> = {
  ofx: "application/x-ofx",
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  pdf: "application/pdf",
  txt: "text/plain",
};

export function mimeDoFormato(formato: FormatoDeExtrato): string {
  return MIME_POR_FORMATO[formato];
}

/**
 * É um arquivo vindo de fora, e não um link nosso?
 *
 * O app já escuta `Linking` para outra coisa: a volta do conector bancário,
 * que chega como `economize://conectar#item=...`. Os dois caminhos compartilham
 * o mesmo evento, então a separação tem que ser explícita — e ela é por
 * esquema, não por conteúdo: tudo que é nosso vem no esquema do app (ou em
 * `https`, na web), e um arquivo local chega em `content://` (provedor do
 * Android) ou `file://` (caminho direto, que alguns gerenciadores ainda usam).
 */
export function ehArquivoDeFora(url: string | null | undefined): boolean {
  if (!url) return false;
  const limpa = url.trim().toLowerCase();
  return limpa.startsWith("content://") || limpa.startsWith("file://");
}

/** Tira query, fragmento e barras do fim, e devolve o último pedaço do caminho. */
function ultimoPedacoDoCaminho(uri: string): string {
  let caminho = uri.split("?")[0].split("#")[0].replace(/\/+$/, "");
  // Um provedor de downloads embute o caminho real como valor codificado
  // (`.../document/raw%3A%2Fstorage%2F...%2Fextrato.ofx`): decodificar é o que
  // revela o nome. Um `%` solto no meio quebraria o decode — daí o try.
  try {
    caminho = decodeURIComponent(caminho);
  } catch {
    // segue com o texto cru: pior caso, não achamos extensão nenhuma
  }
  const pedacos = caminho.split(/[/\\:]/);
  return pedacos[pedacos.length - 1] ?? "";
}

/**
 * O formato que a própria URI entrega, quando entrega.
 *
 * Funciona com `file://` sempre e com boa parte dos `content://` de download,
 * que carregam o caminho real codificado. Um `content://media/external/file/42`
 * não diz nada — e é por isso que existe a leitura dos primeiros bytes.
 */
export function formatoPelaUri(uri: string): FormatoDeExtrato | null {
  const nome = ultimoPedacoDoCaminho(uri).toLowerCase();
  const ponto = nome.lastIndexOf(".");
  if (ponto < 0) return null;
  const extensao = nome.slice(ponto + 1);
  return (FORMATOS_DE_EXTRATO as readonly string[]).includes(extensao)
    ? (extensao as FormatoDeExtrato)
    : null;
}

const ALFABETO_BASE64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Base64 para bytes, escrito aqui de propósito.
 *
 * `atob` existe no Hermes, mas devolve uma string de code units e o caractere
 * 0x80..0xFF volta torto — e são exatamente esses que distinguem um XLSX de um
 * texto. São vinte linhas e elas cabem num teste.
 */
export function bytesDeBase64(base64: string): Uint8Array {
  const limpo = base64.replace(/[^A-Za-z0-9+/]/g, "");
  const bytes: number[] = [];
  let acumulador = 0;
  let bitsJuntados = 0;
  for (const caractere of limpo) {
    const valor = ALFABETO_BASE64.indexOf(caractere);
    if (valor < 0) continue;
    acumulador = (acumulador << 6) | valor;
    bitsJuntados += 6;
    if (bitsJuntados >= 8) {
      bitsJuntados -= 8;
      bytes.push((acumulador >> bitsJuntados) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

function comecaCom(bytes: Uint8Array, assinatura: number[]): boolean {
  if (bytes.length < assinatura.length) return false;
  return assinatura.every((byte, indice) => bytes[indice] === byte);
}

/**
 * Bytes que aparecem em texto de verdade: imprimíveis, acentos, tabulação e
 * quebras de linha.
 *
 * A parte sutil é a faixa 0x80–0x9F. Ela é controle em qualquer codificação de
 * texto, e um binário costuma começar nela (um PNG abre com 0x89) — mas ela
 * também é onde caem as continuações UTF-8 de vogais acentuadas MAIÚSCULAS, e
 * extrato de banco é escrito em caixa alta: "DESCRIÇÃO" carrega 0x87 e 0x83.
 * A regra que separa os dois casos é a posição: em UTF-8 uma continuação nunca
 * vem sozinha, sempre atrás de um byte alto. Solta, é binário.
 */
function pareceTexto(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  let anteriorEraAlto = false;
  for (const byte of bytes) {
    const espacoDeLinha = byte === 0x09 || byte === 0x0a || byte === 0x0d;
    if (!espacoDeLinha) {
      if (byte < 0x20 || byte === 0x7f) return false;
      const continuacaoSolta =
        byte >= 0x80 && byte <= 0x9f && !anteriorEraAlto;
      if (continuacaoSolta) return false;
    }
    anteriorEraAlto = byte >= 0x80;
  }
  return true;
}

function comoTexto(bytes: Uint8Array): string {
  let texto = "";
  for (const byte of bytes) texto += String.fromCharCode(byte);
  return texto;
}

/**
 * O formato lido nos primeiros bytes do arquivo.
 *
 * As assinaturas: `%PDF` abre todo PDF; `PK\x03\x04` é o cabeçalho de ZIP, e um
 * XLSX é um ZIP; um OFX 1.x abre com `OFXHEADER:` e um OFX 2.x é XML com a
 * instrução `<?OFX` seguida de `<OFX>`. O que sobra e ainda é texto se decide
 * pela primeira linha: com separador repetido é planilha exportada (CSV), sem
 * separador é o extrato em texto corrido que alguns bancos mandam (TXT).
 *
 * Distinguir CSV de TXT por heurística é aceitável porque o custo de errar é
 * pequeno e visível: o servidor devolve "não consegui ler" com a mensagem dele,
 * e o seletor de arquivos continua ali, a um toque.
 */
export function formatoPelosPrimeirosBytes(
  bytes: Uint8Array,
): FormatoDeExtrato | null {
  if (comecaCom(bytes, [0x25, 0x50, 0x44, 0x46])) return "pdf";
  if (comecaCom(bytes, [0x50, 0x4b, 0x03, 0x04])) return "xlsx";
  if (!pareceTexto(bytes)) return null;

  const texto = comoTexto(bytes);
  const maiusculo = texto.toUpperCase();
  if (maiusculo.includes("OFXHEADER") || maiusculo.includes("<OFX")) {
    return "ofx";
  }

  const primeiraLinha = texto.split(/\r?\n/)[0] ?? "";
  const separadores = (primeiraLinha.match(/[;,\t]/g) ?? []).length;
  return separadores >= 2 ? "csv" : "txt";
}

function dataCurta(agora: Date): string {
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

/**
 * O nome com que o arquivo viaja.
 *
 * Quando a URI entrega um nome de verdade, ele fica: é o que aparece depois no
 * verso da linha do extrato ("veio de extrato-agosto.ofx"), e o nome que a
 * pessoa reconhece vale mais que qualquer coisa que o app invente. Quando não
 * entrega, a data serve de etiqueta — dois arquivos recebidos no mesmo dia
 * ainda colidem no nome, mas nunca nos dados: o servidor é idempotente pelo
 * hash do conteúdo, não pelo nome.
 */
export function nomeDoArquivoRecebido(
  uri: string,
  formato: FormatoDeExtrato,
  agora: Date = new Date(),
): string {
  const nome = ultimoPedacoDoCaminho(uri);
  const ponto = nome.lastIndexOf(".");
  const temNome = ponto > 0 && nome.slice(0, ponto).trim().length > 0;
  if (temNome && formatoPelaUri(uri) === formato) {
    // Barra, dois-pontos e afins já foram usados para cortar o caminho; o que
    // sobra pode ainda ter espaço ou acento, e os dois são válidos no multipart
    return nome;
  }
  return `extrato-${dataCurta(agora)}.${formato}`;
}
