/**
 * A nota fiscal do mercado, lida do QR code do cupom.
 *
 * <p><b>O pedido do dono (21/09/2026), no meio do mercado:</b> <i>"não estou
 * conseguindo anexar a nf na última transação"</i>. Não existia nada: nem
 * rota, nem tela, nem botão.
 *
 * <p><b>O que dá para saber sem consultar ninguém.</b> O QR do cupom carrega a
 * CHAVE DE ACESSO de 44 dígitos, e ela não é um número opaco — é um registro
 * com campos fixos. Dela saem, offline e de graça: o estado, o mês de
 * emissão, o <b>CNPJ de quem emitiu</b>, o modelo, a série e o número da nota.
 * Mais um dígito verificador que prova que a chave foi digitada ou lida certo.
 *
 * <p><b>O que NÃO dá.</b> Os itens da nota não estão na chave. Eles moram no
 * portal da Secretaria da Fazenda do estado, cada um com o seu endereço e boa
 * parte com captcha — é projeto separado, e prometer item a item a partir
 * daqui seria mentira. O total só vem quando a nota foi emitida em
 * contingência (fora do ar), e aí ele viaja no próprio QR.
 *
 * <p><b>Por que a chave já vale muito.</b> Ela identifica a nota de forma
 * única: guardá-la impede anexar a mesma nota duas vezes, prova de qual loja
 * foi a compra pelo CNPJ, e dá o número que a pessoa vê impresso no cupom
 * para conferir com o olho.
 */

/** Uma chave de acesso tem exatamente isto. */
export interface NotaFiscal {
  /** Os 44 dígitos, sem formatação. */
  chave: string;
  /** Sigla do estado que autorizou, ou null para código desconhecido. */
  uf: string | null;
  /** Ano com quatro dígitos e mês, da emissão. */
  ano: number;
  mes: number;
  /** CNPJ de quem emitiu, só dígitos. */
  cnpj: string;
  /** 65 = cupom (NFC-e), 55 = nota (NF-e). */
  modelo: string;
  serie: number;
  numero: number;
  /** Só existe quando a nota foi emitida em contingência; nulo no caso comum. */
  total: number | null;
}

const UFS: Record<string, string> = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP",
  "17": "TO", "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB",
  "26": "PE", "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES",
  "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS", "50": "MS",
  "51": "MT", "52": "GO", "53": "DF",
};

/**
 * O dígito verificador da chave — módulo 11 com pesos de 2 a 9 girando da
 * direita para a esquerda.
 *
 * <p>É ele que separa "a pessoa leu o QR" de "a pessoa digitou 44 dígitos e
 * errou um". Sem esta conta, um dígito trocado viraria uma nota inexistente
 * guardada para sempre.
 */
export function digitoVerificador(primeiros43: string): number | null {
  if (!/^\d{43}$/.test(primeiros43)) return null;
  let soma = 0;
  let peso = 2;
  for (let i = primeiros43.length - 1; i >= 0; i--) {
    soma += Number(primeiros43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto === 0 || resto === 1 ? 0 : 11 - resto;
}

export function chaveValida(chave: string): boolean {
  const limpa = somenteDigitos(chave);
  if (limpa.length !== 44) return false;
  const esperado = digitoVerificador(limpa.slice(0, 43));
  return esperado !== null && esperado === Number(limpa[43]);
}

function somenteDigitos(texto: string): string {
  return (texto || "").replace(/\D/g, "");
}

/**
 * Acha a chave dentro do que o leitor devolveu.
 *
 * <p>O conteúdo do QR varia por estado: uns mandam a URL de consulta com a
 * chave no parâmetro `p` (seguida de outros campos separados por `|`), outros
 * usam `chNFe`, e há leitor que entrega só os 44 dígitos. Todos caem aqui.
 */
export function extrairChave(conteudo: string): string | null {
  if (!conteudo) return null;
  const texto = conteudo.trim();

  const porParametro = texto.match(/[?&](?:p|chNFe|chave)=([^&\s]+)/i);
  if (porParametro) {
    const candidata = somenteDigitos(porParametro[1].split("|")[0]);
    if (candidata.length === 44) return candidata;
  }

  // Último recurso: 44 dígitos seguidos em qualquer lugar do texto. Cobre o
  // leitor que entrega a chave crua e o cupom com a chave escrita por extenso
  const cru = somenteDigitos(texto);
  if (cru.length === 44) return cru;
  const embutida = cru.match(/\d{44}/);
  return embutida ? embutida[0] : null;
}

/**
 * O total, quando o QR o carrega.
 *
 * <p>Só a emissão em CONTINGÊNCIA (o caixa sem internet) põe valor no QR: o
 * layout vira `chave|versao|ambiente|destinatario|emissao|vNF|vICMS|...`. Na
 * emissão normal esses campos não existem, e insistir em ler a sexta posição
 * devolveria o pedaço errado como se fosse dinheiro.
 */
export function totalDoQr(conteudo: string): number | null {
  const parametro = (conteudo || "").match(/[?&]p=([^&\s]+)/i);
  if (!parametro) return null;
  const campos = parametro[1].split("|");
  // 0=chave 1=versão 2=ambiente 3=destinatário 4=emissão 5=vNF
  if (campos.length < 7) return null;
  const bruto = campos[5];
  if (!/^\d+(\.\d{1,2})?$/.test(bruto)) return null;
  const valor = Number(bruto);
  return isFinite(valor) && valor > 0 ? valor : null;
}

/** Lê tudo o que a chave e o QR contam. Nulo quando não há chave válida. */
export function lerNotaFiscal(conteudo: string): NotaFiscal | null {
  const chave = extrairChave(conteudo);
  if (!chave || !chaveValida(chave)) return null;

  const aa = Number(chave.slice(2, 4));
  return {
    chave,
    uf: UFS[chave.slice(0, 2)] ?? null,
    // A chave guarda o ano com dois dígitos. 2000+ é a única leitura possível:
    // a nota eletrônica não existia antes disso
    ano: 2000 + aa,
    mes: Number(chave.slice(4, 6)),
    cnpj: chave.slice(6, 20),
    modelo: chave.slice(20, 22),
    serie: Number(chave.slice(22, 25)),
    numero: Number(chave.slice(25, 34)),
    total: totalDoQr(conteudo),
  };
}

/** "12.345.678/0001-95" */
export function formatarCnpj(cnpj: string): string {
  const d = somenteDigitos(cnpj);
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** "Cupom nº 123456 · série 2 · SP · 09/2026" — o que a tela mostra. */
export function descreverNota(nota: NotaFiscal): string {
  const tipo = nota.modelo === "65" ? "Cupom" : nota.modelo === "55" ? "Nota" : "Documento";
  const partes = [`${tipo} nº ${nota.numero}`, `série ${nota.serie}`];
  if (nota.uf) partes.push(nota.uf);
  partes.push(`${String(nota.mes).padStart(2, "0")}/${nota.ano}`);
  return partes.join(" · ");
}

/** A chave em blocos de quatro, como ela vem impressa no cupom. */
export function formatarChave(chave: string): string {
  return (somenteDigitos(chave).match(/.{1,4}/g) ?? []).join(" ");
}
