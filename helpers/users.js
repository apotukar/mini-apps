import fs from 'node:fs';
import path from 'path';
import crypto from 'crypto';

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
      } catch (error) {
        console.log(`Error loading user file ${filePath}: ${error.message}`);
        return null;
      }
    })
    .filter(Boolean);
}

export function findUser(users, username, password) {
  return users.find(u => u.username === username && u.password === password);
}

export function createUser(username, password, roles = []) {
  ensureUserDir();

  const id = crypto.randomUUID();
  const file = path.join(userDir(), `${id}.json`);

  const userData = { id, username, password, roles };

  fs.writeFileSync(file, JSON.stringify(userData, null, 2), 'utf8');

  return userData;
}
