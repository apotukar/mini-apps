#!/usr/bin/env node

import https from 'https';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import qrcode from 'qrcode-terminal';
import chalk from 'chalk';
import express from 'express';
import { GoogleTokenWriter } from '../helpers/google/google-token-writer.js';

dotenv.config({ override: process.env.DOTENV_OVERRIDE });

function createConfig() {
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const PORT = Number(process.env.PORT) || 3443;
  const GOOGLE_REDIRECT_URL =
    process.env.GOOGLE_REDIRECT_URL || `https://localhost:${PORT}/oauth2callback`;
  const TOKEN_DIR = '.data/gtokens';

  console.log('CLIENT_ID present:', !!CLIENT_ID);
  console.log('CLIENT_SECRET present:', !!CLIENT_SECRET);
  console.log('PORT:', PORT);
  console.log('TOKEN_DIR:', TOKEN_DIR);

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Fehler: GOOGLE_CLIENT_ID oder GOOGLE_CLIENT_SECRET fehlen.');
  }

  if (!fs.existsSync(TOKEN_DIR)) {
    fs.mkdirSync(TOKEN_DIR, { recursive: true });
    console.log('Token-Verzeichnis erstellt:', TOKEN_DIR);
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
    httpsOptions
  };
}

function startServer(userId) {
  const config = createConfig();
  const { clientId, clientSecret, redirectUri, tokensPath, port, httpsOptions } = config;
  const tokenWriter = new GoogleTokenWriter({ clientId, clientSecret, redirectUri, tokensPath });

  const app = express();
  let server;

  app.get('/oauth2callback', async (req, res) => {
    const { code, state: stateUserId } = req.query;
    console.log('code:', code);
    console.log('userId/state:', stateUserId);

    if (!code || !stateUserId) {
      res.status(400).send('missing param');
      return;
    }

    try {
      await tokenWriter.exchangeCode(code, stateUserId);

      res
        .status(200)
        .set('Content-Type', 'text/plain; charset=utf-8')
        .send('Token gespeichert. Du kannst dieses Fenster schließen.');

      if (server) {
        server.close(() => {
          console.log('OAuth Server wurde beendet.');
        });
      }
    } catch (err) {
      console.error('Fehler:', err);
      res
        .status(500)
        .set('Content-Type', 'text/plain; charset=utf-8')
        .send('Fehler: ' + err.message);
    } finally {
      if (server) {
        server.close(() => {
          console.log('OAuth Server wurde beendet.');
        });
      }
    }
  });

  server = https.createServer(httpsOptions, app);

  server.listen(port, '0.0.0.0', () => {
    console.log('OAuth Server läuft mit Express.');
    console.log('Callback URL:', redirectUri);

    const authUrl = tokenWriter.buildAuthUrl(userId);
    console.log('Login URL:', chalk.blue.underline(authUrl));

    console.log('QR-Code für die Login-URL:');
    qrcode.generate(authUrl, { small: true });
  });
}

startServer('apotukar');
