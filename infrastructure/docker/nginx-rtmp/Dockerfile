# DEPRECATED: Replaced by SRS (infrastructure/docker/srs/).
# Kept for rollback reference only. Do not use for new deployments.
#
# Nginx RTMP Server for Live Streaming
# Base: Ubuntu 22.04
# Modules: Nginx 1.25+, RTMP module, FFmpeg

FROM ubuntu:22.04

LABEL maintainer="Live Commerce Team"
LABEL description="Nginx RTMP server with LL-HLS transcoding"

# Environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV NGINX_VERSION=1.25.3
ENV RTMP_MODULE_VERSION=1.2.2

# Install dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpcre3 \
    libpcre3-dev \
    libssl-dev \
    zlib1g-dev \
    wget \
    git \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Download and compile Nginx with RTMP module
WORKDIR /tmp
RUN wget http://nginx.org/download/nginx-${NGINX_VERSION}.tar.gz && \
    tar -zxvf nginx-${NGINX_VERSION}.tar.gz && \
    git clone https://github.com/arut/nginx-rtmp-module.git && \
    cd nginx-${NGINX_VERSION} && \
    ./configure \
        --prefix=/etc/nginx \
        --sbin-path=/usr/sbin/nginx \
        --conf-path=/etc/nginx/nginx.conf \
        --error-log-path=/var/log/nginx/error.log \
        --http-log-path=/var/log/nginx/access.log \
        --pid-path=/var/run/nginx.pid \
        --lock-path=/var/run/nginx.lock \
        --with-http_ssl_module \
        --with-http_realip_module \
        --with-http_addition_module \
        --with-http_sub_module \
        --with-http_dav_module \
        --with-http_flv_module \
        --with-http_mp4_module \
        --with-http_gunzip_module \
        --with-http_gzip_static_module \
        --with-http_random_index_module \
        --with-http_secure_link_module \
        --with-http_stub_status_module \
        --with-http_auth_request_module \
        --with-threads \
        --with-stream \
        --with-stream_ssl_module \
        --with-http_slice_module \
        --with-file-aio \
        --with-http_v2_module \
        --add-module=../nginx-rtmp-module && \
    make -j$(nproc) && \
    make install && \
    cd .. && \
    rm -rf nginx-${NGINX_VERSION} nginx-${NGINX_VERSION}.tar.gz nginx-rtmp-module

# Create necessary directories
RUN mkdir -p /tmp/hls /tmp/dash /var/log/nginx /etc/nginx/conf.d

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf
COPY rtmp.conf /etc/nginx/rtmp.conf

# Copy startup script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose ports
EXPOSE 1935 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8080/stat || exit 1

# Start Nginx
ENTRYPOINT ["/entrypoint.sh"]
