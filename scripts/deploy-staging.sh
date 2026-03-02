#!/bin/bash
# ================================
# Dorami Staging Deployment Script
# ================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Dorami Staging Deployment${NC}"
echo -e "${GREEN}================================${NC}"

# Check if .env.staging exists
if [ ! -f "$PROJECT_DIR/.env.staging" ]; then
    echo -e "${RED}Error: .env.staging file not found!${NC}"
    echo -e "${YELLOW}Please copy .env.staging.example to .env.staging and configure it:${NC}"
    echo "  cp .env.staging.example .env.staging"
    echo "  nano .env.staging"
    exit 1
fi

# Load environment variables
set -a
source "$PROJECT_DIR/.env.staging"
set +a

# docker compose uses base + staging overlay for deterministic parity
compose() {
    docker-compose -f "$PROJECT_DIR/docker-compose.base.yml" -f "$PROJECT_DIR/docker-compose.staging.yml" --env-file "$PROJECT_DIR/.env.staging" "$@"
}

# Function to show help
show_help() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  build       Build all Docker images"
    echo "  up          Start all services"
    echo "  down        Stop all services"
    echo "  restart     Restart all services"
    echo "  logs        Show logs (follow mode)"
    echo "  status      Show service status"
    echo "  db-migrate  Run database migrations"
    echo "  db-seed     Seed the database"
    echo "  ssl-init    Initialize SSL certificates (Let's Encrypt)"
    echo "  ssl-renew   Renew SSL certificates"
    echo "  cleanup     Remove all containers, volumes, and images"
    echo ""
}

# Build images
build() {
    echo -e "${YELLOW}Building Docker images...${NC}"
    compose build
    echo -e "${GREEN}Build complete!${NC}"
}

# Start services
up() {
    echo -e "${YELLOW}Starting services...${NC}"
    compose up -d
    echo -e "${GREEN}Services started!${NC}"
    echo ""
    status
}

# Start with proxy (for SSL)
up_with_proxy() {
    echo -e "${YELLOW}Starting services with nginx proxy...${NC}"
    compose --profile with-proxy up -d
    echo -e "${GREEN}Services started with proxy!${NC}"
}

# Stop services
down() {
    echo -e "${YELLOW}Stopping services...${NC}"
    compose down
    echo -e "${GREEN}Services stopped!${NC}"
}

# Restart services
restart() {
    down
    up
}

# Show logs
logs() {
    compose logs -f
}

# Show status
status() {
    echo -e "${YELLOW}Service Status:${NC}"
    compose ps
}

# Run database migrations
db_migrate() {
    echo -e "${YELLOW}Running database migrations...${NC}"
    compose exec backend npx prisma migrate deploy
    echo -e "${GREEN}Migrations complete!${NC}"
}

# Seed database
db_seed() {
    echo -e "${YELLOW}Seeding database...${NC}"
    compose exec backend npx prisma db seed
    echo -e "${GREEN}Seeding complete!${NC}"
}

# Initialize SSL certificates
ssl_init() {
    if [ -z "$DOMAIN" ]; then
        echo -e "${RED}Error: DOMAIN not set in .env.staging${NC}"
        exit 1
    fi

    echo -e "${YELLOW}Initializing SSL certificates for $DOMAIN...${NC}"

    # Start nginx temporarily for ACME challenge
    compose --profile with-proxy up -d nginx-proxy

    # Get certificate
    compose run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email admin@$DOMAIN \
        --agree-tos \
        --no-eff-email \
        -d $DOMAIN

    echo -e "${GREEN}SSL certificates initialized!${NC}"
    echo -e "${YELLOW}Please update nginx config to enable HTTPS and restart.${NC}"
}

# Renew SSL certificates
ssl_renew() {
    echo -e "${YELLOW}Renewing SSL certificates...${NC}"
    compose run --rm certbot renew
    compose exec nginx-proxy nginx -s reload
    echo -e "${GREEN}SSL certificates renewed!${NC}"
}

# Cleanup everything
cleanup() {
    echo -e "${RED}WARNING: This will remove all containers, volumes, and images!${NC}"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        compose down -v --rmi all
        echo -e "${GREEN}Cleanup complete!${NC}"
    else
        echo "Cancelled."
    fi
}

# Main
case "$1" in
    build)
        build
        ;;
    up)
        up
        ;;
    up-proxy)
        up_with_proxy
        ;;
    down)
        down
        ;;
    restart)
        restart
        ;;
    logs)
        logs
        ;;
    status)
        status
        ;;
    db-migrate)
        db_migrate
        ;;
    db-seed)
        db_seed
        ;;
    ssl-init)
        ssl_init
        ;;
    ssl-renew)
        ssl_renew
        ;;
    cleanup)
        cleanup
        ;;
    *)
        show_help
        ;;
esac
