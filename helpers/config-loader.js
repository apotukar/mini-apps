import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

export function loadConfig(configFile = 'config.json') {
  const rootDir = process.cwd();
  dotenv.config({ path: path.join(rootDir, '.env'), override: process.env.DOTENV_OVERRIDE });
  const configPath = path.join(rootDir, configFile);
  const raw = fs.readFileSync(configPath, 'utf8');
  const rawConfig = JSON.parse(raw);

  const config = applyEnvPlaceholders(rawConfig);
  return config;
}

function applyEnvPlaceholders(obj) {
  const result = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = value.replace(/\$\{([^}]+)\}/g, (_, envName) => {
        return process.env[envName] ?? '';
      });
    } else if (value && typeof value === 'object') {
      result[key] = applyEnvPlaceholders(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
