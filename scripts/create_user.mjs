#!/usr/bin/env node

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { UserStore } from '../src/lib/user-store.js';

async function main() {
  const rl = readline.createInterface({ input, output });

  const username = await rl.question('Benutzername: ');
  const password = await rl.question('Passwort: ');
  const rolesInput = await rl.question('Rollen (Komma-separiert, optional): ');

  rl.close();

  const roles = rolesInput
    .split(',')
    .map(r => r.trim())
    .filter(Boolean);

  const userStore = new UserStore();
  const user = await userStore.createUser(username, password, roles);

  console.log('User angelegt:');
  console.log(JSON.stringify(user, null, 2));
}

main().catch(err => {
  console.error('Fehler beim Anlegen des Users:', err);
  process.exit(1);
});
