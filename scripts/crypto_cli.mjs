#!/usr/bin/env node

import { Command } from 'commander';
import { CryptoTokenCipher } from '../src/lib/crypto/crypto-token-cipher.js';

const program = new Command();

program
  .name('crypto-cli')
  .description('CLI zum Verschlüsseln und Entschlüsseln von Passwörtern')
  .version('1.0.0');

program
  .command('encrypt')
  .description('Verschlüsselt ein Passwort')
  .argument('<password>', 'Das zu verschlüsselnde Passwort')
  .option(
    '-k, --key <key>',
    'Der Verschlüsselungsschlüssel (Base64 kodiert)',
    process.env.ENCRYPTION_KEY // -> node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  )
  .action((password, options) => {
    const key = options.key;
    if (!key) {
      console.error('Encryption key is required.');
      process.exit(1);
    }

    try {
      const cipher = new CryptoTokenCipher(key);
      const encrypted = cipher.encrypt(password);
      console.log('Verschlüsseltes Passwort:', encrypted);
    } catch (error) {
      console.error('Fehler:', error.message);
      process.exit(1);
    }
  });

program
  .command('decrypt')
  .description('Entschlüsselt ein Passwort')
  .argument('<encryptedPassword>', 'Das zu entschlüsselnde Passwort (Base64-kodiert)')
  .option(
    '-k, --key <key>',
    'Der Verschlüsselungsschlüssel (Base64 kodiert)',
    process.env.ENCRYPTION_KEY
  )
  .action((encryptedPassword, options) => {
    const key = options.key;
    if (!key) {
      console.error('Encryption key is required.');
      process.exit(1);
    }

    try {
      const cipher = new CryptoTokenCipher(key);
      const decrypted = cipher.decrypt(encryptedPassword);
      console.log('Entschlüsseltes Passwort:', decrypted);
    } catch (error) {
      console.error('Fehler:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
