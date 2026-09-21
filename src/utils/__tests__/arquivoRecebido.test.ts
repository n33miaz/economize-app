import {
  bytesDeBase64,
  ehArquivoDeFora,
  formatoPelaUri,
  formatoPelosPrimeirosBytes,
  mimeDoFormato,
  nomeDoArquivoRecebido,
} from "../arquivoRecebido";

/** Facilita escrever assinatura binária sem contar byte a byte no teste. */
function bytesDeTexto(texto: string): Uint8Array {
  return Uint8Array.from([...texto].map((c) => c.charCodeAt(0)));
}

describe("ehArquivoDeFora", () => {
  it("reconhece o que o Android entrega", () => {
    expect(ehArquivoDeFora("content://com.android.providers/document/42")).toBe(
      true,
    );
    expect(ehArquivoDeFora("file:///storage/emulated/0/extrato.ofx")).toBe(true);
    expect(ehArquivoDeFora("CONTENT://MAIUSCULO")).toBe(true);
  });

  it("não confunde com os links do próprio app", () => {
    // A volta do conector bancário passa pelo MESMO evento `url`: se ela caísse
    // aqui, o app tentaria importar um extrato a partir de um link de conexão
    expect(ehArquivoDeFora("economize://conectar#item=abc")).toBe(false);
    expect(ehArquivoDeFora("exp+economize://reset-password?token=x")).toBe(
      false,
    );
    expect(ehArquivoDeFora("https://economize-web.onrender.com/login")).toBe(
      false,
    );
  });

  it("aguenta ausência de URL", () => {
    expect(ehArquivoDeFora(null)).toBe(false);
    expect(ehArquivoDeFora(undefined)).toBe(false);
    expect(ehArquivoDeFora("")).toBe(false);
  });
});

describe("formatoPelaUri", () => {
  it("lê a extensão de um caminho direto", () => {
    expect(formatoPelaUri("file:///sdcard/Download/extrato.ofx")).toBe("ofx");
    expect(formatoPelaUri("file:///sdcard/Download/MOVIMENTO.CSV")).toBe("csv");
    expect(formatoPelaUri("file:///sdcard/a/b/fatura.pdf")).toBe("pdf");
  });

  it("lê o caminho que o provedor de downloads embute codificado", () => {
    // É a forma real do Files do Android para um arquivo baixado
    const uri =
      "content://com.android.providers.downloads.documents/document/raw%3A%2Fstorage%2Femulated%2F0%2FDownload%2Fextrato-agosto.ofx";
    expect(formatoPelaUri(uri)).toBe("ofx");
  });

  it("devolve null quando a URI só tem número", () => {
    expect(formatoPelaUri("content://media/external/file/1234")).toBeNull();
  });

  it("ignora extensão que o servidor não lê", () => {
    expect(formatoPelaUri("file:///sdcard/foto.jpg")).toBeNull();
  });

  it("não se perde com query, fragmento ou barra sobrando", () => {
    expect(formatoPelaUri("file:///sdcard/extrato.csv?v=2")).toBe("csv");
    expect(formatoPelaUri("file:///sdcard/extrato.csv#topo")).toBe("csv");
  });
});

describe("bytesDeBase64", () => {
  it("devolve os bytes crus, inclusive acima de 0x7f", () => {
    // "PK\x03\x04" — o cabeçalho de ZIP, que é o começo de todo XLSX
    expect([...bytesDeBase64("UEsDBA==")]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    // 0xff e 0xfe não sobrevivem a um decode que passe por string de texto
    expect([...bytesDeBase64("//4=")]).toEqual([0xff, 0xfe]);
  });

  it("ignora quebra de linha e preenchimento", () => {
    expect([...bytesDeBase64("UEsD\nBA==")]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("devolve vazio para entrada vazia", () => {
    expect(bytesDeBase64("").length).toBe(0);
  });
});

describe("formatoPelosPrimeirosBytes", () => {
  it("reconhece PDF pela assinatura", () => {
    expect(formatoPelosPrimeirosBytes(bytesDeTexto("%PDF-1.7\n%..."))).toBe(
      "pdf",
    );
  });

  it("reconhece XLSX pelo cabeçalho de ZIP", () => {
    const bytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    expect(formatoPelosPrimeirosBytes(bytes)).toBe("xlsx");
  });

  it("reconhece OFX 1.x pelo cabeçalho de texto", () => {
    const ofx = "OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\n";
    expect(formatoPelosPrimeirosBytes(bytesDeTexto(ofx))).toBe("ofx");
  });

  it("reconhece OFX 2.x, que é XML", () => {
    const ofx = '<?xml version="1.0"?>\n<?OFX OFXHEADER="200"?>\n<OFX>';
    expect(formatoPelosPrimeirosBytes(bytesDeTexto(ofx))).toBe("ofx");
  });

  it("chama de CSV o texto cuja primeira linha tem separadores", () => {
    const csv = "Data;Descricao;Valor\n01/08/2026;Mercado;-120,50\n";
    expect(formatoPelosPrimeirosBytes(bytesDeTexto(csv))).toBe("csv");
  });

  it("chama de TXT o texto corrido", () => {
    const txt = "EXTRATO DE CONTA CORRENTE\nPeriodo de 01/08 a 31/08\n";
    expect(formatoPelosPrimeirosBytes(bytesDeTexto(txt))).toBe("txt");
  });

  it("devolve null para binário desconhecido", () => {
    // Assinatura de PNG: o 0x89 solto é controle em qualquer codificação
    const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    expect(formatoPelosPrimeirosBytes(bytes)).toBeNull();
  });

  it("aceita extrato em caixa alta com acento, que passa pela mesma faixa", () => {
    // "DESCRIÇÃO;VALOR" em UTF-8: o Ç é 0xC3 0x87 e o Ã é 0xC3 0x83 — os dois
    // com continuação na faixa de controle, mas atrás de um byte alto
    const bytes = Uint8Array.from([
      0x44, 0x45, 0x53, 0x43, 0x52, 0x49, 0xc3, 0x87, 0xc3, 0x83, 0x4f, 0x3b,
      0x56, 0x41, 0x4c, 0x4f, 0x52, 0x3b, 0x44, 0x41, 0x54, 0x41,
    ]);
    expect(formatoPelosPrimeirosBytes(bytes)).toBe("csv");
  });

  it("aceita o mesmo texto em ISO-8859-1, que os bancos ainda usam", () => {
    // "DESCRIÇÃO;VALOR;DATA" em latin-1: Ç é 0xC7 e Ã é 0xC3, fora da faixa
    const bytes = Uint8Array.from([
      0x44, 0x45, 0x53, 0x43, 0x52, 0x49, 0xc7, 0xc3, 0x4f, 0x3b, 0x56, 0x41,
      0x4c, 0x4f, 0x52, 0x3b, 0x44, 0x41, 0x54, 0x41,
    ]);
    expect(formatoPelosPrimeirosBytes(bytes)).toBe("csv");
  });

  it("devolve null para arquivo vazio", () => {
    expect(formatoPelosPrimeirosBytes(new Uint8Array())).toBeNull();
  });
});

describe("nomeDoArquivoRecebido", () => {
  const agora = new Date(2026, 8, 21); // 21/09/2026, mês é zero-based

  it("mantém o nome de verdade quando a URI o entrega", () => {
    const uri =
      "content://com.android.providers.downloads.documents/document/raw%3A%2Fstorage%2Femulated%2F0%2FDownload%2Fextrato-agosto.ofx";
    expect(nomeDoArquivoRecebido(uri, "ofx", agora)).toBe("extrato-agosto.ofx");
  });

  it("inventa um nome datado quando a URI não diz nada", () => {
    expect(
      nomeDoArquivoRecebido("content://media/external/file/1234", "ofx", agora),
    ).toBe("extrato-2026-09-21.ofx");
  });

  it("usa o formato reconhecido nos bytes quando ele contradiz a URI", () => {
    // O provedor devolveu ".bin"; os bytes disseram OFX. O servidor escolhe o
    // leitor pela extensão do nome, então quem manda é o que foi reconhecido
    expect(
      nomeDoArquivoRecebido("file:///sdcard/baixado.bin", "ofx", agora),
    ).toBe("extrato-2026-09-21.ofx");
  });

  it("não aceita nome que é só extensão", () => {
    expect(nomeDoArquivoRecebido("file:///sdcard/.ofx", "ofx", agora)).toBe(
      "extrato-2026-09-21.ofx",
    );
  });
});

describe("mimeDoFormato", () => {
  it("dá um tipo honesto para cada formato aceito", () => {
    expect(mimeDoFormato("ofx")).toBe("application/x-ofx");
    expect(mimeDoFormato("csv")).toBe("text/csv");
    expect(mimeDoFormato("pdf")).toBe("application/pdf");
  });
});
