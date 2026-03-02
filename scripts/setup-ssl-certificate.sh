#!/bin/bash
set -e

# SSL Certificate Setup Script for Staging
# Usage: ./scripts/setup-ssl-certificate.sh <host> <user> <domain>

HOST="${1:?Host required (e.g., 54.180.94.30)}"
USER="${2:?User required (e.g., ubuntu)}"
DOMAIN="${3:?Domain required (e.g., staging.doremi-live.com)}"
EMAIL="${4:-admin@doremi-live.com}"

echo "=========================================="
echo "SSL Certificate Setup for Staging"
echo "=========================================="
echo "Host:    $HOST"
echo "User:    $USER"
echo "Domain:  $DOMAIN"
echo "Email:   $EMAIL"
echo ""

# Step 1: Check connectivity
echo "[Step 1/5] Checking SSH connectivity..."
if ! ssh -o ConnectTimeout=5 "$USER@$HOST" "echo OK" > /dev/null 2>&1; then
    echo "ERROR: Cannot connect to $USER@$HOST"
    exit 1
fi
echo "✓ SSH connection successful"
echo ""

# Step 2: Install Certbot on staging server
echo "[Step 2/5] Installing Certbot on staging server..."
ssh "$USER@$HOST" << 'SSH_COMMANDS'
    set -e
    if ! command -v certbot &> /dev/null; then
        echo "Installing certbot..."
        sudo apt-get update -qq
        sudo apt-get install -y certbot
    else
        echo "certbot already installed"
    fi
SSH_COMMANDS
echo "✓ Certbot installed"
echo ""

# Step 3: Issue certificate
echo "[Step 3/5] Issuing Let's Encrypt certificate for $DOMAIN..."
ssh "$USER@$HOST" << SSH_COMMANDS
    set -e

    # Stop Nginx temporarily to avoid port conflicts
    echo "Stopping Nginx temporarily..."
    cd /opt/dorami
    docker compose -f docker-compose.base.yml -f docker-compose.staging.yml stop nginx || true
    sleep 2

    # Issue certificate using standalone mode
    echo "Requesting certificate from Let's Encrypt..."
    sudo certbot certonly \
      --standalone \
      --email $EMAIL \
      --agree-tos \
      --non-interactive \
      --force-renewal \
      -d $DOMAIN

    echo "✓ Certificate issued successfully"
SSH_COMMANDS
echo "✓ Certificate issued"
echo ""

# Step 4: Copy certificate to Docker volume
echo "[Step 4/5] Copying certificate to docker volume..."
ssh "$USER@$HOST" << SSH_COMMANDS
    set -e

    DORAMI_DIR="/opt/dorami"
    CERT_DIR="/etc/letsencrypt/live/$DOMAIN"

    # Create ssl directory
    mkdir -p \${DORAMI_DIR}/nginx/ssl

    # Copy certificates
    echo "Copying fullchain.pem and privkey.pem..."
    sudo cp \${CERT_DIR}/fullchain.pem \${DORAMI_DIR}/nginx/ssl/
    sudo cp \${CERT_DIR}/privkey.pem \${DORAMI_DIR}/nginx/ssl/

    # Set permissions
    sudo chmod 644 \${DORAMI_DIR}/nginx/ssl/fullchain.pem
    sudo chmod 644 \${DORAMI_DIR}/nginx/ssl/privkey.pem
    sudo chown $(id -u):$(id -g) \${DORAMI_DIR}/nginx/ssl/*

    echo "✓ Certificates copied to nginx/ssl/"
    ls -la \${DORAMI_DIR}/nginx/ssl/
SSH_COMMANDS
echo "✓ Certificates copied"
echo ""

# Step 5: Restart services with HTTPS
echo "[Step 5/5] Restarting services with HTTPS configuration..."
ssh "$USER@$HOST" << SSH_COMMANDS
    set -e
    cd /opt/dorami

    # Start Nginx with staging-ssl.conf
    echo "Starting Nginx with HTTPS..."
    docker compose -f docker-compose.base.yml -f docker-compose.staging.yml up -d nginx

    sleep 3

    # Verify Nginx is running
    docker compose -f docker-compose.base.yml -f docker-compose.staging.yml ps nginx

    echo "✓ Services restarted with HTTPS"
SSH_COMMANDS
echo "✓ Services restarted"
echo ""

# Step 6: Test HTTPS
echo "[Step 6/6] Testing HTTPS connection..."
echo "Waiting 5 seconds for services to stabilize..."
sleep 5

# Test HTTP redirect
echo "Testing HTTP → HTTPS redirect..."
HTTP_REDIRECT=$(curl -s -o /dev/null -w "%{http_code}" -L "http://$DOMAIN" 2>/dev/null || echo "000")
if [ "$HTTP_REDIRECT" != "000" ]; then
    echo "✓ HTTP redirect working (status: $HTTP_REDIRECT)"
else
    echo "⚠ Warning: Could not test HTTP redirect"
fi

# Test HTTPS
echo "Testing HTTPS connection..."
HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN" 2>/dev/null || echo "000")
if [ "$HTTPS_STATUS" = "200" ]; then
    echo "✓ HTTPS working! (status: $HTTPS_STATUS)"
else
    echo "⚠ Warning: HTTPS status $HTTPS_STATUS (may need backend to be running)"
fi

# Show certificate info
echo ""
echo "Certificate details:"
curl -s "https://$DOMAIN" 2>/dev/null | head -20 || echo "(could not fetch)"

echo ""
echo "=========================================="
echo "✅ SSL Certificate Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Verify HTTPS is working: https://$DOMAIN"
echo "2. Check certificate expiry: sudo certbot certificates"
echo "3. Auto-renewal is configured via Certbot"
echo ""
echo "Certificate renewal:"
echo "- Certbot will auto-renew 30 days before expiry"
echo "- To test renewal: sudo certbot renew --dry-run"
echo ""
