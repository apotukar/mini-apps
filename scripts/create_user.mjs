#!/usr/bin/env node

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { UserStore } from '../src/lib/user-store.js';

async function main() {
  const rl = readline.createInterface({ input, output });

  const username = (await rl.question('Benutzername: ')).trim();
  const password = (await rl.question('Passwort: ')).trim();
  const firstName = (await rl.question('Vorname: ')).trim();
  const lastName = (await rl.question('Nachname: ')).trim();
  const email = (await rl.question('E-Mail: ')).trim();
  const rolesInput = await rl.question('Rollen (Komma-separiert, optional): ');

  rl.close();

  const roles = rolesInput
    .split(',')
    .map(r => r.trim())
    .filter(Boolean);

  const userStore = new UserStore();

  const user = await userStore.createUser({
    username,
    password,
    roles,
    firstName,
    lastName,
    email
  });

  console.log('User angelegt:');
  console.log(JSON.stringify(user, null, 2));
}

main().catch(err => {
  console.error('Fehler beim Anlegen des Users:', err.message || err);
  process.exit(1);
});
