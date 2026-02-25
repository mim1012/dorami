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

    # SRS HTTP-FLV: /live/live/{key}.flv -> SRS (http_remux mount /live/[app]/[stream].flv)
    location /live/live/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host 127.0.0.1;
        proxy_buffering off;
        proxy_request_buffering off;
        add_header Access-Control-Allow-Origin "*" always;
    }

    # SRS HLS
    location /hls/ {
        proxy_pass http://127.0.0.1:8080/live/;
        proxy_set_header Host 127.0.0.1;
        proxy_buffering off;
        add_header Cache-Control "no-cache" always;
        add_header Access-Control-Allow-Origin "*" always;
    }

    # SRS HLS - CDN URL 중복 경로
    location /hls/hls/ {
        proxy_pass http://127.0.0.1:8080/live/;
        proxy_set_header Host 127.0.0.1;
        proxy_buffering off;
        add_header Cache-Control "no-cache" always;
        add_header Access-Control-Allow-Origin "*" always;
    }

    # 업로드 파일
    location /uploads/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Socket.IO WebSocket
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Cookie $http_cookie;
    }

    # Next.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
