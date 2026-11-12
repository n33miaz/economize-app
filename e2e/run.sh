#!/usr/bin/env bash
# Validação de ponta a ponta do Economize, inteira nesta máquina.
#
#   e2e/run.sh
#
# Sobe, nesta ordem e uma coisa por vez (a máquina tem pouca RAM):
#   1. a web (`expo export`) apontando para a API LOCAL, sem JVM no ar;
#   2. um Postgres descartável (container com dados em tmpfs, some ao parar);
#   3. a API (um JVM só, Flyway de verdade, segredo JWT de teste, CORS local);
#      (com um dublê local só para a cotação de ticker do exterior);
#   4. um servidor estático com fallback de SPA para o `dist`;
#   5. o roteiro do Playwright (WebKit, 390x664), em duas fases: o roteiro
#      inteiro sem câmbio e, com a API reiniciada COM câmbio (mesmo banco),
#      a conferência da posição em dólar convertida.
# E derruba tudo o que subiu ao sair, com sucesso ou com falha.
#
# Nada aqui fala com produção: a URL da API é inlinada no build como
# 127.0.0.1 e o roteiro aborta (e reprova) qualquer requisição a outro host.
#
# Variáveis:
#   E2E_API_DIR      checkout do economize-api (padrão: irmãos conhecidos)
#   E2E_SKIP_BUILD=1 reaproveita o `dist` da rodada anterior (mesma porta da API)
#   E2E_PG_IMAGE     imagem do Postgres (padrão: postgres:18-alpine, já local)
#   E2E_MIN_FREE_MB  memória livre mínima para subir JVM/navegador (padrão 1200)
#   E2E_API_PORT / E2E_WEB_PORT / E2E_PG_PORT  portas preferidas
#   E2E_HOLD=1       sobe a pilha (fase sem câmbio) e a segura no ar, sem rodar o
#                    roteiro, até existir e2e/artifacts/stop (para depurar à mão);
#                    E2E_HOLD=2 faz o mesmo com a API na fase com câmbio
#   Argumentos extras vão para o `playwright test` (ex.: -g "Investimentos").
set -uo pipefail

E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$E2E_DIR/.." && pwd)"
ART_DIR="$E2E_DIR/artifacts"
PG_IMAGE="${E2E_PG_IMAGE:-postgres:18-alpine}"
MIN_FREE_MB="${E2E_MIN_FREE_MB:-1200}"
PG_NAME="economize-e2e-pg-$$"
STARTED_AT=$(date +%s)

API_PID=""
WEB_PID=""
STUB_PID=""
PG_STARTED=""
KILLED=()

is_windows() { [[ "${OSTYPE:-}" == msys* || "${OSTYPE:-}" == cygwin* ]]; }

log() { printf '\n[e2e %s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() {
  printf '\n[e2e] ERRO: %s\n' "$*" >&2
  exit 1
}

# Memória física livre, em MB
free_mb() {
  if is_windows; then
    powershell -NoProfile -Command "[int]((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1KB)" | tr -d '\r'
  elif [[ -r /proc/meminfo ]]; then
    awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo
  else
    echo 999999
  fi
}

require_memory() {
  local livre
  livre="$(free_mb)"
  log "memória livre: ${livre} MB (antes de: $1)"
  ((livre >= MIN_FREE_MB)) || die "só ${livre} MB livres; preciso de ${MIN_FREE_MB} para $1. Feche algo ou ajuste E2E_MIN_FREE_MB."
}

# PID (do sistema, não o do MSYS) de quem escuta numa porta
pid_on_port() {
  if is_windows; then
    netstat -ano -p tcp | tr -d '\r' | awk -v p=":$1" '$2 ~ p"$" && $4 == "LISTENING" {print $5; exit}'
  else
    lsof -ti "tcp:$1" -sTCP:LISTEN 2>/dev/null | head -1
  fi
}

kill_tree() {
  local pid="$1" what="$2"
  [[ -n "$pid" ]] || return 0
  if is_windows; then
    taskkill //PID "$pid" //T //F >/dev/null 2>&1
  else
    kill "$pid" 2>/dev/null
  fi
  KILLED+=("$what=$pid")
}

cleanup() {
  local code=$?
  trap - EXIT INT TERM
  log "derrubando o que subiu"
  kill_tree "$WEB_PID" "estatico"
  kill_tree "$STUB_PID" "duble-mercado"
  kill_tree "$API_PID" "api-jvm"
  if [[ -n "$PG_STARTED" ]]; then
    docker rm -f "$PG_NAME" >/dev/null 2>&1 && KILLED+=("container=$PG_NAME")
  fi
  rm -f "$ART_DIR/web.pid" "$ART_DIR/stub.pid"
  echo "[e2e] derrubados: ${KILLED[*]:-nada}"
  echo "[e2e] tempo total: $(($(date +%s) - STARTED_AT))s"
  exit "$code"
}
trap cleanup EXIT INT TERM

wait_http() { # url, tentativas, o-que
  local i
  for ((i = 0; i < $2; i++)); do
    curl -fsS -o /dev/null --max-time 3 "$1" 2>/dev/null && return 0
    sleep 2
  done
  die "$3 não respondeu em $1"
}

mkdir -p "$ART_DIR"

# ---------------------------------------------------------------- pré-requisitos
API_DIR="${E2E_API_DIR:-}"
if [[ -z "$API_DIR" ]]; then
  for candidato in "$APP_DIR/../api-e2e" "$APP_DIR/../economize-api" "$APP_DIR/../../economize-api"; do
    if [[ -f "$candidato/pom.xml" ]]; then
      API_DIR="$(cd "$candidato" && pwd)"
      break
    fi
  done
fi
[[ -f "$API_DIR/pom.xml" ]] || die "não achei o economize-api; aponte com E2E_API_DIR"
docker info >/dev/null 2>&1 || die "o Docker não está rodando (o Postgres descartável depende dele; este script não o inicia)"
docker image inspect "$PG_IMAGE" >/dev/null 2>&1 || die "a imagem $PG_IMAGE não está local; não baixo sozinho (disco). Rode 'docker pull $PG_IMAGE' ou aponte E2E_PG_IMAGE"
[[ -d "$APP_DIR/node_modules" ]] || die "faltam as dependências do app: rode 'npm ci' em $APP_DIR"
if [[ ! -d "$E2E_DIR/node_modules" ]]; then
  log "instalando o Playwright do harness (sem baixar navegador)"
  (cd "$E2E_DIR" && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --no-audit --no-fund) || die "npm ci do e2e falhou"
fi

# ------------------------------------------------------------------------ portas
# A porta da API é inlinada no bundle: com E2E_SKIP_BUILD ela vem do build anterior
PORT_MARK="$APP_DIR/dist/.e2e-api-port"
if [[ "${E2E_SKIP_BUILD:-}" == "1" ]]; then
  [[ -f "$PORT_MARK" ]] || die "E2E_SKIP_BUILD=1 sem build anterior do e2e em dist/"
  API_PORT="$(cat "$PORT_MARK")"
  [[ "$(node "$E2E_DIR/lib/free-port.mjs" "$API_PORT")" == "$API_PORT" ]] || die "a porta $API_PORT do build anterior está ocupada; rode sem E2E_SKIP_BUILD"
else
  API_PORT="$(node "$E2E_DIR/lib/free-port.mjs" "${E2E_API_PORT:-18080}")"
fi
WEB_PORT="$(node "$E2E_DIR/lib/free-port.mjs" "${E2E_WEB_PORT:-18081}")"
PG_PORT="$(node "$E2E_DIR/lib/free-port.mjs" "${E2E_PG_PORT:-15432}")"
STUB_PORT="$(node "$E2E_DIR/lib/free-port.mjs" "${E2E_STUB_PORT:-18082}")"
API_URL="http://127.0.0.1:$API_PORT"
WEB_URL="http://127.0.0.1:$WEB_PORT"
log "API em $API_URL · web em $WEB_URL · Postgres em 127.0.0.1:$PG_PORT · API de $API_DIR"

# --------------------------------------------------------------------- 1. a web
if [[ "${E2E_SKIP_BUILD:-}" != "1" ]]; then
  require_memory "o build da web"
  log "gerando a web (expo export --clear) apontada para a API local"
  if ! (cd "$APP_DIR" && EXPO_PUBLIC_API_BASE_URL="$API_URL/api/v1" CI=1 \
    npx expo export --platform web --output-dir dist --clear) >"$ART_DIR/build.log" 2>&1; then
    tail -30 "$ART_DIR/build.log"
    die "o build da web falhou (log em e2e/artifacts/build.log)"
  fi
  echo "$API_PORT" >"$PORT_MARK"
fi
# Sem a variável inlinada o app cai na URL de PRODUÇÃO. Não sigo sem esta prova.
grep -rqF "$API_URL/api/v1" "$APP_DIR/dist/_expo/static/js" ||
  die "o bundle não aponta para $API_URL; recuso continuar (cairia em produção)"

# ----------------------------------------------------------------- 2. o Postgres
log "subindo Postgres descartável ($PG_IMAGE, dados em tmpfs)"
MSYS_NO_PATHCONV=1 docker run -d --rm --name "$PG_NAME" --memory 256m \
  -e POSTGRES_DB=economize -e POSTGRES_USER=economize -e POSTGRES_PASSWORD=economize \
  --tmpfs /var/lib/postgresql \
  -p "127.0.0.1:$PG_PORT:5432" "$PG_IMAGE" >/dev/null || die "não subi o Postgres"
PG_STARTED=1
for ((i = 0; i < 40; i++)); do
  docker exec "$PG_NAME" pg_isready -q -h 127.0.0.1 -U economize -d economize 2>/dev/null && break
  sleep 1
done
# o entrypoint reinicia o servidor uma vez depois do initdb: confirmo de novo
sleep 2
docker exec "$PG_NAME" pg_isready -q -h 127.0.0.1 -U economize -d economize || die "o Postgres não ficou pronto"

# --------------------------------------------------------------------- 3. a API
log "compilando a API (maven offline)"
if ! (cd "$API_DIR" && MAVEN_OPTS="-Xmx384m" mvn -o -q -DskipTests compile \
  dependency:build-classpath -Dmdep.includeScope=runtime \
  -Dmdep.outputFile=target/e2e-classpath.txt) >"$ART_DIR/api-build.log" 2>&1; then
  tail -30 "$ART_DIR/api-build.log"
  die "a API não compilou (log em e2e/artifacts/api-build.log)"
fi

# O classpath não cabe na linha de comando do Windows: vai por arquivo de argumentos
if is_windows; then SEP=";"; else SEP=":"; fi
to_native() { if is_windows; then cygpath -m "$1"; else echo "$1"; fi; }
ARGFILE="$API_DIR/target/e2e-java.args"
printf -- '-cp\n"%s%s%s"\n' "$(to_native "$API_DIR/target/classes")" "$SEP" \
  "$(tr -d '\r\n' <"$API_DIR/target/e2e-classpath.txt" | tr '\\' '/')" >"$ARGFILE"

# Dublê de mercado: cotação de ticker do exterior (sempre) e câmbio (só para a
# fase em que a API é apontada para ele)
node "$E2E_DIR/lib/market-stub.mjs" "$STUB_PORT" "$ART_DIR/stub.pid" >"$ART_DIR/stub.log" 2>&1 &
wait_http "http://127.0.0.1:$STUB_PORT/q/l/?s=vt.us" 15 "o dublê de mercado"
STUB_PID="$(cat "$ART_DIR/stub.pid" 2>/dev/null || pid_on_port "$STUB_PORT")"

# Sobe a API. O primeiro argumento é a fase ("sem-cambio" ou "com-cambio"):
# a API guarda cotação e câmbio em cache por dezenas de minutos, então a única
# forma honesta de ver a MESMA posição sem e com câmbio é reiniciar a JVM
# entre as fases, com o mesmo banco.
start_api() {
  local fase="$1" extra=()
  if [[ "$fase" == "com-cambio" ]]; then
    extra+=("--awesome.api.url=http://127.0.0.1:$STUB_PORT/awesome")
  fi
  require_memory "a JVM da API ($fase)"
  log "subindo a API ($fase)"
  (
    cd "$API_DIR" || exit 1
    # Segredos de teste, gerados aqui e válidos só para esta subida
    export PORT="$API_PORT"
    export CORS_ALLOWED_ORIGINS="$WEB_URL"
    export DB_URL="jdbc:postgresql://127.0.0.1:$PG_PORT/economize"
    export DB_USER=economize DB_PASSWORD=economize
    JWT_SECRET="e2e-$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
    SECRET_ENCRYPTION_KEY="$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64"))')"
    export JWT_SECRET SECRET_ENCRYPTION_KEY
    export BRAPI_TOKEN=token-de-teste
    exec java -Xmx384m -XX:+UseSerialGC -Dfile.encoding=UTF-8 "@$(to_native "$ARGFILE")" \
      br.com.economize.EconomizeApiApplication \
      "--spring.config.additional-location=file:$(to_native "$E2E_DIR/api.properties")" \
      "--economize.market.stooq-url=http://127.0.0.1:$STUB_PORT/q/l/" \
      ${extra[@]+"${extra[@]}"}
  ) >"$ART_DIR/api-$fase.log" 2>&1 &
  local bash_pid=$! i
  for ((i = 0; i < 90; i++)); do
    curl -fsS -o /dev/null --max-time 3 "$API_URL/actuator/health" 2>/dev/null && break
    if ! kill -0 "$bash_pid" 2>/dev/null; then
      tail -40 "$ART_DIR/api-$fase.log"
      die "a API morreu na subida (log em e2e/artifacts/api-$fase.log)"
    fi
    sleep 2
  done
  API_PID="$(pid_on_port "$API_PORT")"
  if [[ -z "$API_PID" ]]; then
    tail -40 "$ART_DIR/api-$fase.log"
    kill "$bash_pid" 2>/dev/null
    die "a API não subiu em 180s"
  fi
  log "API no ar (pid $API_PID, $fase)"
}

stop_api() {
  kill_tree "$API_PID" "api-jvm"
  API_PID=""
  local i
  for ((i = 0; i < 20; i++)); do
    [[ -z "$(pid_on_port "$API_PORT")" ]] && return 0
    sleep 1
  done
  die "a porta $API_PORT não foi liberada pela API anterior"
}

# Roda uma fase do roteiro; devolve o código do Playwright
run_fase() { # fase, arquivo, argumentos extras do playwright
  local fase="$1" arquivo="$2"
  shift 2
  require_memory "o navegador ($fase)"
  log "rodando o roteiro ($fase)"
  (cd "$E2E_DIR" && E2E_WEB_URL="$WEB_URL" E2E_API_URL="$API_URL" E2E_FASE="$fase" \
    npx playwright test "$arquivo" "$@")
}

FASE_INICIAL="sem-cambio"
[[ "${E2E_HOLD:-}" == "2" ]] && FASE_INICIAL="com-cambio"
start_api "$FASE_INICIAL"

# ---------------------------------------------------------------- 4. o estático
node "$E2E_DIR/lib/static-server.mjs" "$APP_DIR/dist" "$WEB_PORT" "$ART_DIR/web.pid" >"$ART_DIR/web.log" 2>&1 &
wait_http "$WEB_URL/" 15 "o servidor estático"
WEB_PID="$(cat "$ART_DIR/web.pid" 2>/dev/null || pid_on_port "$WEB_PORT")"
log "web no ar (pid $WEB_PID)"

# ----------------------------------------------------------------- 5. o roteiro
if [[ -n "${E2E_HOLD:-}" ]]; then
  rm -f "$ART_DIR/stop"
  log "pilha no ar ($FASE_INICIAL). Rode: E2E_WEB_URL=$WEB_URL E2E_API_URL=$API_URL E2E_FASE=$FASE_INICIAL npx playwright test"
  log "para derrubar: touch e2e/artifacts/stop"
  until [[ -f "$ART_DIR/stop" ]]; do sleep 2; done
  rm -f "$ART_DIR/stop"
  exit 0
fi

# Fase 1: o roteiro inteiro, sem câmbio
run_fase "sem-cambio" "roteiro.e2e.ts" "$@"
RESULT=$?
log "roteiro (sem-cambio) terminou com código $RESULT"
[[ "$RESULT" -eq 0 ]] || exit "$RESULT"

# Fase 2: a mesma conta, depois de a API reiniciar COM câmbio
stop_api
start_api "com-cambio"
run_fase "com-cambio" "cambio.e2e.ts" "$@"
RESULT=$?
log "roteiro (com-cambio) terminou com código $RESULT (relatório em e2e/artifacts/)"
exit "$RESULT"
