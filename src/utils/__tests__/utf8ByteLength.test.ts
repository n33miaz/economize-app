import { utf8ByteLength } from "../utf8ByteLength";

describe("utf8ByteLength", () => {
  it("mede texto ASCII em um byte por caractere", () => {
    expect(utf8ByteLength("senha-123")).toBe(9);
  });

  it("mede acento com os dois bytes de UTF-8", () => {
    expect(utf8ByteLength("café")).toBe(5);
  });

  it("mede emoji com quatro bytes de UTF-8", () => {
    expect(utf8ByteLength("😀")).toBe(4);
  });
});
