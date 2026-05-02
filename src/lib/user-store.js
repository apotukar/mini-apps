import fs from 'node:fs';
import path from 'path';
import crypto from 'crypto';
import argon2 from 'argon2';

export class UserStore {
  constructor(options = {}) {
    const { userDir = 'data/users', hashing = {} } = options;

    this.userDir = path.isAbsolute(userDir) ? userDir : path.join(process.cwd(), userDir);

    this.hashOptions = {
      type: argon2.argon2id,
      memoryCost: hashing.memoryCost ?? 19456,
      timeCost: hashing.timeCost ?? 2,
      parallelism: hashing.parallelism ?? 1
    };

    this.ensureUserDir();
  }

  ensureUserDir() {
    if (!fs.existsSync(this.userDir)) {
      fs.mkdirSync(this.userDir, { recursive: true });
    }
  }

  userFilePath(id) {
    return path.join(this.userDir, `${id}.json`);
  }

  loadUsers() {
    this.ensureUserDir();
    const files = fs.readdirSync(this.userDir).filter(f => f.endsWith('.json'));

    return files
      .map(file => {
        try {
          const raw = fs.readFileSync(path.join(this.userDir, file), 'utf8');
          return JSON.parse(raw);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  async findUser(username, password) {
    if (!username || !password) {
      return null;
    }

    username = username.trim();

    const users = this.loadUsers();
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

  async createUser({ username, password, roles = [], firstName = '', lastName = '', email = '' }) {
    this.ensureUserDir();

    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    username = username.trim();
    firstName = firstName.trim();
    lastName = lastName.trim();
    email = email.trim();

    if (username.length < 3) {
      throw new Error('Username must be at least 3 characters long');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    const existing = this.loadUsers().find(u => u.username === username);
    if (existing) {
      throw new Error(`Username already exists: "${username}"`);
    }

    const id = crypto.randomUUID();
    const file = this.userFilePath(id);

    const passwordHash = await argon2.hash(password, this.hashOptions);

    const userData = {
      id,
      username,
      passwordHash,
      roles,
      firstName,
      lastName,
      email
    };

    fs.writeFileSync(file, JSON.stringify(userData, null, 2), 'utf8');

    return userData;
  }
}
