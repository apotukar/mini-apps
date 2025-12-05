import fs from 'node:fs';
import path from 'path';
import crypto from 'crypto';
import argon2 from 'argon2';

function userDir() {
  return path.join(process.cwd(), '.data', 'users');
}

function ensureUserDir() {
  const dir = userDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadUsers() {
  ensureUserDir();
  const dir = userDir();

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

  return files
    .map(file => {
      const filePath = path.join(dir, file);
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export async function findUser(users, username, password) {
  const matches = users.filter(u => u.username === username);

  if (matches.length > 1) {
    throw new Error(`Duplicate username detected: "${username}"`);
  }

  if (matches.length === 0) {
    return null;
  }

  const user = matches[0];
  if (!user.passwordHash) {
    return null;
  }

  const ok = await argon2.verify(user.passwordHash, password);
  return ok ? user : null;
}

// TODO: check if user already exists
export async function createUser(username, password, roles = []) {
  ensureUserDir();

  const id = crypto.randomUUID();
  const file = path.join(userDir(), `${id}.json`);

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });

  const userData = { id, username, passwordHash, roles };

  fs.writeFileSync(file, JSON.stringify(userData, null, 2), 'utf8');

  return userData;
}
