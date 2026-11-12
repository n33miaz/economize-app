// Devolve a porta pedida se estiver livre em 127.0.0.1; senão, uma livre
// escolhida pelo sistema. Uso: node free-port.mjs <porta-preferida>
import { createServer } from "node:net";

const preferred = Number(process.argv[2] ?? 0);

function tryPort(port) {
  return new Promise((ok) => {
    const s = createServer();
    s.once("error", () => ok(null));
    s.listen(port, "127.0.0.1", () => {
      const chosen = s.address().port;
      s.close(() => ok(chosen));
    });
  });
}

console.log((await tryPort(preferred)) ?? (await tryPort(0)));
