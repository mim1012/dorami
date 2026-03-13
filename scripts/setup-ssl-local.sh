#!/bin/bash
# Run this script directly on the staging server
# Usage: bash setup-ssl-local.sh staging.doremi-live.com

set -e

DOMAIN="${1:?Domain required (e.g., staging.doremi-live.com)}"
EMAIL="${2:-admin@doremi-live.com}"
DOREMI_DIR="${3:-.}"

echo "=========================================="
echo "SSL Certificate Setup (Local)"
echo "=========================================="
echo "Domain:  $DOMAIN"
echo "Email:   $EMAIL"
echo "Dir:     $DOREMI_DIR"
echo ""

# Step 1: Check if Certbot is installed
echo "[Step 1/4] Checking Certbot..."
if ! command -v certbot &> /dev/null; then
    echo "Installing Certbot..."
    sudo apt-get update -qq
    sudo apt-get install -y certbot
else
    echo "✓ Certbot is installed"
fi
echo ""

# Step 2: Stop Nginx to free port 80
echo "[Step 2/4] Stopping Nginx temporarily..."
cd "$DOREMI_DIR"
docker compose -f docker-compose.base.yml -f docker-compose.staging.yml stop nginx || true
sleep 2
echo "✓ Nginx stopped"
echo ""

# Step 3: Issue certificate
echo "[Step 3/4] Requesting Let's Encrypt certificate..."
sudo certbot certonly \
  --standalone \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive \
  --force-renewal \
  -d "$DOMAIN"
echo "✓ Certificate issued"
echo ""

# Step 4: Copy to Docker volume
echo "[Step 4/4] Copying certificate to Docker volume..."
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"

mkdir -p "$DOREMI_DIR/nginx/ssl"

sudo cp "$CERT_DIR/fullchain.pem" "$DOREMI_DIR/nginx/ssl/"
sudo cp "$CERT_DIR/privkey.pem" "$DOREMI_DIR/nginx/ssl/"

sudo chmod 644 "$DOREMI_DIR/nginx/ssl/fullchain.pem"
sudo chmod 644 "$DOREMI_DIR/nginx/ssl/privkey.pem"
sudo chown $(id -u):$(id -g) "$DOREMI_DIR/nginx/ssl"/*

echo "✓ Certificates copied to nginx/ssl/"
echo ""

# Step 5: Restart services
echo "[Step 5/5] Restarting services with HTTPS..."
cd "$DOREMI_DIR"
docker compose -f docker-compose.base.yml -f docker-compose.staging.yml up -d

sleep 5

echo "✓ Services restarted"
echo ""

# Step 6: Verify
echo "Verifying installation..."
echo ""
echo "Certificate info:"
openssl x509 -in "$DOREMI_DIR/nginx/ssl/fullchain.pem" -text -noout | grep -A 2 "Subject:"
echo ""

echo "=========================================="
echo "✅ SSL Certificate Setup Complete!"
echo "=========================================="
echo ""
echo "Certificate location: $DOREMI_DIR/nginx/ssl/"
echo "Domain: $DOMAIN"
echo ""
echo "Test HTTPS:"
echo "  curl -I https://$DOMAIN"
echo ""
echo "Auto-renewal:"
echo "  sudo certbot certificates"
echo "  sudo certbot renew --dry-run"
echo ""

