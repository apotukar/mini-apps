FROM node:24

ARG TARGETARCH

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y \
    imagemagick \
    pngquant \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    libgbm1 \
    wget \
    unzip \
    curl \
    jq \
    ack-grep \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

RUN SHFMT_VERSION=v3.12.0 \
    && case "$TARGETARCH" in \
    amd64) ARCH=amd64 ;; \
    arm64) ARCH=arm64 ;; \
    arm)   ARCH=arm ;; \
    *) echo "Unsupported architecture: $TARGETARCH" && exit 1 ;; \
    esac \
    && curl -sSL "https://github.com/mvdan/sh/releases/download/${SHFMT_VERSION}/shfmt_${SHFMT_VERSION}_linux_${ARCH}" \
    -o /usr/local/bin/shfmt \
    && chmod +x /usr/local/bin/shfmt

RUN npm install -g npm@latest
ENV PUPPETEER_CACHE_DIR=/tmp/puppeteer-cache
RUN npx puppeteer browsers install chrome

CMD ["node", "app.js"]
