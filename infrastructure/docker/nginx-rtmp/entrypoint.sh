#!/bin/bash
# Nginx RTMP Server Entrypoint Script

set -e

echo "================================"
echo "Nginx RTMP Server Starting..."
echo "================================"

# Create necessary directories
mkdir -p /tmp/hls /tmp/dash /var/log/nginx

# Set permissions
chmod -R 755 /tmp/hls /tmp/dash
chown -R www-data:www-data /tmp/hls /tmp/dash /var/log/nginx

# Environment variables (with defaults)
export BACKEND_URL="${BACKEND_URL:-http://backend:3000}"
export MAX_CONNECTIONS="${MAX_CONNECTIONS:-1000}"
export HLS_FRAGMENT_LENGTH="${HLS_FRAGMENT_LENGTH:-2s}"

echo "Configuration:"
echo "  Backend URL: $BACKEND_URL"
echo "  Max Connections: $MAX_CONNECTIONS"
echo "  HLS Fragment Length: $HLS_FRAGMENT_LENGTH"
echo "================================"

# Test nginx configuration
echo "Testing Nginx configuration..."
nginx -t

# Function to handle graceful shutdown
graceful_shutdown() {
    echo "Received shutdown signal. Stopping Nginx gracefully..."
    nginx -s quit

    # Wait for nginx to stop
    while pgrep nginx > /dev/null; do
        sleep 1
    done

    echo "Nginx stopped. Cleaning up..."
    rm -rf /tmp/hls/* /tmp/dash/*

    echo "Shutdown complete."
    exit 0
}

# Trap SIGTERM and SIGINT for graceful shutdown
trap graceful_shutdown SIGTERM SIGINT

# Start Nginx in foreground
echo "Starting Nginx..."
nginx -g 'daemon off;' &

# Wait for nginx process
NGINX_PID=$!
wait $NGINX_PID
