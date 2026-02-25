server {
    listen 80;
    server_name doremi-live.com www.doremi-live.com;
    return 301 https://www.doremi-live.com$request_uri;
}

server {
    listen 443 ssl;
    server_name doremi-live.com;
    ssl_certificate /etc/letsencrypt/live/doremi-live.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/doremi-live.com/privkey.pem;
    return 301 https://www.doremi-live.com$request_uri;
}

server {
    listen 443 ssl;
    server_name www.doremi-live.com;

    ssl_certificate /etc/letsencrypt/live/doremi-live.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/doremi-live.com/privkey.pem;

    # SRS HTTP-FLV (라이브 스트림)
    # /live/live/ prefix: FLV URL 패턴(/live/live/{streamKey}.flv)에만 매칭되고
    # Next.js /live/[streamKey] 페이지 라우트와 충돌하지 않음
    location /live/live/ {
        proxy_pass http://127.0.0.1:8080/live/;
        proxy_set_header Host $host;
        proxy_buffering off;
    }

    # SRS HLS (Safari/iOS fallback)
    location /hls/ {
        proxy_pass http://127.0.0.1:8080/hls/;
        proxy_set_header Host $host;
    }

    # Socket.IO WebSocket
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }

    # 나머지 모든 요청 → Next.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
