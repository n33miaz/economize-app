import { describeCoverage, readReserve } from "../invoiceReserve";
import type { AccountInvoice, InvoiceReserve } from "../../services/api";

const fatura = (total: number, open = false): AccountInvoice => ({
  reference: "2026-09",
  periodStart: "2026-08-09",
  periodEnd: "2026-09-08",
  closingDate: "2026-09-08",
  dueDate: "2026-09-14",
  total,
  purchasesTotal: total,
  refundsTotal: 0,
  paymentsTotal: 0,
  transactionCount: 2,
  open,
  reserve: null,
  transactions: [],
});

const reserva = (amount: number): InvoiceReserve => ({
  id: "r1",
  amount,
  heldInAccountId: null,
  heldInAccountName: null,
  note: null,
});

describe("leitura da reserva de fatura", () => {
  it("sem reserva não há o que ler", () => {
    expect(readReserve(fatura(641.14))).toBeNull();
  });

  it("o valor exato cobre a fatura", () => {
    const leitura = readReserve(fatura(641.14), reserva(641.14));
    expect(leitura).toEqual({
      coverage: "COVERED",
      percent: 100,
      missing: 0,
      extra: 0,
    });
    expect(describeCoverage(leitura!)).toBe("cobre a fatura");
  });

  it("um centavo de diferença ainda é 'o valor exato'", () => {
    // Quem separa "o valor da fatura" digita o número que viu na tela; um
    // arredondamento não pode virar "falta R$ 0,01"
    expect(readReserve(fatura(641.14), reserva(641.13))?.coverage).toBe("COVERED");
    expect(readReserve(fatura(641.14), reserva(641.15))?.coverage).toBe("COVERED");
  });

  it("metade separada cobre metade, e diz quanto falta", () => {
    const leitura = readReserve(fatura(641.14), reserva(320.57));
    expect(leitura?.coverage).toBe("PARTIAL");
    expect(leitura?.percent).toBe(50);
    expect(leitura?.missing).toBe(320.57);
    expect(describeCoverage(leitura!)).toBe("cobre 50%");
  });

  it("sobra numa fatura FECHADA é sobra", () => {
    const leitura = readReserve(fatura(300), reserva(400));
    expect(leitura?.coverage).toBe("SURPLUS");
    expect(leitura?.extra).toBe(100);
    expect(describeCoverage(leitura!)).toBe("sobra");
  });

  it("sobra numa fatura EM ABERTO é adiantamento, não sobra", () => {
    // A fatura ainda cresce até fechar: chamar de sobra prometeria um troco
    // que pode não existir
    const leitura = readReserve(fatura(300, true), reserva(400));
    expect(leitura?.coverage).toBe("AHEAD");
    expect(describeCoverage(leitura!)).toBe("adiantado");
  });

  it("fatura zerada não divide por zero", () => {
    const leitura = readReserve(fatura(0), reserva(100));
    expect(leitura?.coverage).toBe("SURPLUS");
    expect(leitura?.percent).toBe(100);
    expect(leitura?.extra).toBe(100);
  });

  it("reserva de valor não positivo é como não ter reserva", () => {
    expect(readReserve(fatura(100), reserva(0))).toBeNull();
  });
});
