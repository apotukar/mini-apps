FROM node:24

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
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g npm@latest

ENV PUPPETEER_CACHE_DIR=/tmp/puppeteer-cache
RUN npx puppeteer install chrome

CMD ["node", "index.js"]
