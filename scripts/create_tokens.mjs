#!/usr/bin/env node

import https from 'https';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import qrcode from 'qrcode-terminal';
import express from 'express';
import { GoogleTokenWriter } from '../src/lib/google/google-token-writer.js';

dotenv.config({ override: process.env.DOTENV_OVERRIDE });

function createConfig() {
  const AUTH_TOKEN_USER_ID = process.env.AUTH_TOKEN_USER_ID;
  console.log('AUTH_TOKEN_USER_ID:', AUTH_TOKEN_USER_ID);

  const AUTH_TOKEN_KEY = process.env.AUTH_TOKEN_KEY;
  console.log('AUTH_TOKEN_KEY:', AUTH_TOKEN_KEY);

  const TOKEN_DIR = 'data/gtokens';
  if (!fs.existsSync(TOKEN_DIR)) {
    fs.mkdirSync(TOKEN_DIR, { recursive: true });
    console.log('Created token directory:', TOKEN_DIR);
  }

  const PORT = Number(process.env.PORT) || 3443;
  const GOOGLE_REDIRECT_URL =
    process.env.GOOGLE_REDIRECT_URL || `https://localhost:${PORT}/oauth2callback`;
  console.log('GOOGLE_REDIRECT_URL:', GOOGLE_REDIRECT_URL);

  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  console.log('CLIENT_ID present:', !!CLIENT_ID);
  console.log('CLIENT_SECRET present:', !!CLIENT_SECRET);
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Error: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET are missing.');
  }

  const httpsOptions = {
    key: fs.readFileSync(path.join(process.cwd(), 'certs', 'server.key')),
    cert: fs.readFileSync(path.join(process.cwd(), 'certs', 'server.crt'))
  };

  return {
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    port: PORT,
    redirectUri: GOOGLE_REDIRECT_URL,
    tokensPath: TOKEN_DIR,
    authTokenUserId: AUTH_TOKEN_USER_ID,
    authTokenKey: AUTH_TOKEN_KEY,
    httpsOptions
  };
}

function startServer() {
  const config = createConfig();
  const {
    clientId,
    clientSecret,
    redirectUri,
    tokensPath,
    port,
    httpsOptions,
    authTokenUserId,
    authTokenKey
  } = config;

  const tokenWriter = new GoogleTokenWriter({
    clientId,
    clientSecret,
    redirectUri,
    tokensPath,
    authTokenKey
  });

  const app = express();
  let server;

  app.get('/oauth2callback', async (req, res) => {
    const { code, state: stateUserId } = req.query;
    console.log('code:', code);
    console.log('userId/state:', stateUserId);

    if (!code || !stateUserId) {
      res.status(400).send('Missing parameter.');
      return;
    }

    try {
      await tokenWriter.exchangeCode(code, stateUserId);

      res
        .status(200)
        .set('Content-Type', 'text/plain; charset=utf-8')
        .send('Token saved. You can close this window.');

      if (server) {
        server.close(() => {
          console.log('OAuth server has been stopped.');
        });
      }
    } catch (err) {
      console.error('Error:', err);
      res
        .status(500)
        .set('Content-Type', 'text/plain; charset=utf-8')
        .send('Error: ' + err.message);
    }
  });

  server = https.createServer(httpsOptions, app);

  server.listen(port, '0.0.0.0', () => {
    console.log('OAuth server is running with Express.');
    console.log('Callback URL:', redirectUri);

    const authUrl = tokenWriter.buildAuthUrl(authTokenUserId);
    console.log('Login URL:', authUrl);

    console.log('QR code for the login URL:');
    qrcode.generate(authUrl, { small: true });
  });
}

startServer();
