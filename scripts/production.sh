#!/usr/bin/env bash
#
# Gaple - Production Management Script
# Usage: ./scripts/production.sh {setup|start|stop|restart|restart-app|build|status|ruang|logs|pull|help}
#
# Deploy ulang aman kapan saja: ruang disimpan di Redis dan dipulihkan saat app menyala lagi.
# Pemain hanya melihat "Menyambung ulang…" beberapa detik.
#

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────
APP_NAME="gaple"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"
ENV_FILE="$PROJECT_DIR/.env"
ENV_EXAMPLE="$PROJECT_DIR/.env.example"
HEALTH_URL="http://127.0.0.1:2567/kesehatan"
HEALTH_TIMEOUT=90

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ─── Helper Functions ────────────────────────────────────────────────────────
log_info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

compose() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

check_docker() {
  if ! command -v docker &>/dev/null; then
    log_error "Docker is not installed. Please install Docker first."
    exit 1
  fi
  if ! docker info &>/dev/null; then
    log_error "Docker daemon is not running. Please start Docker."
    exit 1
  fi
  if ! docker compose version &>/dev/null; then
    log_error "Docker Compose v2 plugin is not installed (docker compose)."
    exit 1
  fi
}

# Read a value from .env (empty if missing)
env_value() {
  grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d '"' || true
}

check_env() {
  if [ ! -f "$ENV_FILE" ]; then
    log_error ".env file not found at $ENV_FILE"
    log_warn "Copy .env.example to .env and fill in the values:"
    echo "  cp .env.example .env"
    exit 1
  fi
  local domain email
  domain="$(env_value DOMAIN)"
  email="$(env_value ACME_EMAIL)"
  if [ -z "$domain" ] || [ "$domain" = "gaple.example.com" ]; then
    log_error "DOMAIN is not set in .env (the domain pointing to this server, or 'localhost' for a local try)."
    exit 1
  fi
  if [ -z "$email" ] || [ "$email" = "admin@example.com" ]; then
    log_error "ACME_EMAIL is not set in .env (used for Let's Encrypt certificate notices)."
    exit 1
  fi
}

# Wait until the app answers the health endpoint
wait_healthy() {
  log_info "Waiting for app to become healthy (max ${HEALTH_TIMEOUT}s)..."
  local waited=0
  until curl -fsS "$HEALTH_URL" &>/dev/null; do
    if [ "$waited" -ge "$HEALTH_TIMEOUT" ]; then
      log_error "App did not become healthy. Check logs: $0 logs app"
      exit 1
    fi
    sleep 2
    waited=$((waited + 2))
  done
  log_ok "App is healthy."
}

# Print the number of active rooms (safe to call when the app is down)
show_rooms() {
  local body
  if body="$(curl -fsS "$HEALTH_URL" 2>/dev/null)"; then
    log_info "Active rooms: $(echo "$body" | sed -E 's/.*"ruangAktif":([0-9]+).*/\1/')"
  else
    log_warn "App is not reachable at $HEALTH_URL"
  fi
}

# ─── Commands ────────────────────────────────────────────────────────────────

cmd_setup() {
  log_info "========== Setting up $APP_NAME for production =========="

  check_docker
  if [ ! -f "$ENV_FILE" ] && [ -f "$ENV_EXAMPLE" ]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    log_warn "Created .env from .env.example. Fill in DOMAIN and ACME_EMAIL, then run setup again."
    exit 1
  fi
  check_env

  # 1. Build images
  log_info "Building Docker images..."
  compose build --pull --no-cache
  log_ok "Images built."

  # 2. Start all services (Redis first, app waits until Redis is healthy)
  log_info "Starting all services..."
  compose up -d
  log_ok "All services started."

  # 3. Wait for the app
  wait_healthy

  # 4. Show status
  cmd_status

  echo ""
  log_ok "========== Setup complete! =========="
  log_info "Site:    https://$(env_value DOMAIN)"
  log_info "Health:  $HEALTH_URL (from this server only)"
  log_info "Logs:    $0 logs"
  log_warn "Make sure ports 80 and 443 are open and DOMAIN points to this server (needed for TLS)."
}

cmd_start() {
  log_info "Starting $APP_NAME..."

  check_docker
  check_env

  compose up -d
  log_ok "All services started."

  wait_healthy
  cmd_status
}

cmd_stop() {
  log_info "Stopping $APP_NAME..."

  check_docker
  check_env
  show_rooms

  # Volumes (Redis data, certificates) are kept; rooms resume on the next start.
  compose down
  log_ok "All services stopped. Rooms are kept in Redis."
}

cmd_restart() {
  log_info "Restarting $APP_NAME..."

  check_docker
  check_env
  show_rooms

  compose down
  compose up -d
  log_ok "All services restarted."

  wait_healthy
  cmd_status
}

cmd_restart_app() {
  log_info "Restarting app container only (no rebuild)..."

  check_docker
  check_env
  show_rooms

  compose restart app
  log_ok "App container restarted."

  wait_healthy
  show_rooms
}

cmd_build() {
  log_info "Rebuilding and restarting app container..."

  check_docker
  check_env
  show_rooms

  # Build first, so the old app keeps serving while the image builds.
  compose build app
  compose up -d --force-recreate --no-deps app
  log_ok "App container rebuilt and restarted."

  wait_healthy
  cmd_status
}

cmd_status() {
  check_env
  log_info "Service status:"
  echo ""
  compose ps
  echo ""
  show_rooms
}

cmd_rooms() {
  check_docker
  show_rooms
}

cmd_logs() {
  local SERVICE="${1:-}"
  local LINES="${2:-100}"

  check_env
  if [ -n "$SERVICE" ]; then
    compose logs -f --tail="$LINES" "$SERVICE"
  else
    compose logs -f --tail="$LINES"
  fi
}

cmd_pull() {
  log_info "Pulling latest code and rebuilding..."

  check_docker
  check_env

  cd "$PROJECT_DIR"

  # Pull latest code
  log_info "Pulling latest code from git..."
  git pull origin "$(git rev-parse --abbrev-ref HEAD)"
  log_ok "Code updated."

  # Rebuild and restart app only
  cmd_build
}

cmd_help() {
  echo ""
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║             Gaple - Production Management                ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo ""
  echo "Usage: $0 <command> [options]"
  echo ""
  echo "Commands:"
  echo "  setup          First-time setup (.env check, build, start, wait healthy)"
  echo "  start          Start all services"
  echo "  stop           Stop all services (rooms stay in Redis)"
  echo "  restart        Restart all services (down + up)"
  echo "  restart-app    Restart only the app container (no rebuild)"
  echo "  build          Rebuild & recreate the app container only"
  echo "  status         Show containers status and active rooms"
  echo "  ruang          Show active rooms (check before maintenance)"
  echo "  logs [svc] [n] Follow logs (optional: service name, tail lines)"
  echo "  pull           Git pull + rebuild app container"
  echo "  help           Show this help"
  echo ""
  echo "Services: app, redis, caddy"
  echo ""
  echo "Examples:"
  echo "  $0 setup                  # First-time production setup"
  echo "  $0 start                  # Start all containers"
  echo "  $0 restart                # Full restart"
  echo "  $0 restart-app            # Quick app-only restart"
  echo "  $0 build                  # Rebuild app after code changes"
  echo "  $0 ruang                  # How many rooms are active right now"
  echo "  $0 logs                   # Follow all logs"
  echo "  $0 logs app               # Follow only app logs"
  echo "  $0 logs app 500           # Follow app logs (last 500 lines)"
  echo "  $0 pull                   # Git pull + rebuild"
  echo ""
  echo "Never run 'docker compose down -v': it deletes the Redis volume and every room."
  echo ""
}

# ─── Main ────────────────────────────────────────────────────────────────────
COMMAND="${1:-help}"
shift || true

case "$COMMAND" in
  setup)       cmd_setup ;;
  start)       cmd_start ;;
  stop)        cmd_stop ;;
  restart)     cmd_restart ;;
  restart-app) cmd_restart_app ;;
  build)       cmd_build ;;
  status)      cmd_status ;;
  ruang)       cmd_rooms ;;
  logs)        cmd_logs "$@" ;;
  pull)        cmd_pull ;;
  help|--help|-h) cmd_help ;;
  *)
    log_error "Unknown command: $COMMAND"
    cmd_help
    exit 1
    ;;
esac
