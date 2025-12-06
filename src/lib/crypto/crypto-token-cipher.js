import crypto from 'crypto';

export class CryptoTokenCipher {
  constructor(key) {
    if (!key) {
      throw new Error('Encryption key is missing.');
    }

    if (typeof key === 'string') {
      key = Buffer.from(key, 'base64');
    }

    if (!Buffer.isBuffer(key) || key.length !== 32) {
      throw new Error(
        'Invalid key: must be a 32-byte Buffer or a base64 string representing 32 bytes.'
      );
    }

    this.key = key;
    this.algorithm = 'aes-256-gcm';
    this.ivLength = 12;
  }

  encrypt(text) {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);

    const tag = cipher.getAuthTag();

    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decrypt(base64) {
    const data = Buffer.from(base64, 'base64');

    const iv = data.subarray(0, this.ivLength);
    const tag = data.subarray(this.ivLength, this.ivLength + 16);
    const encrypted = data.subarray(this.ivLength + 16);

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return decrypted.toString('utf8');
  }
}
