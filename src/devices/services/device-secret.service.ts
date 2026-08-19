import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';

@Injectable()
export class DeviceSecretService {
  private readonly pepper: string;

  constructor() {
    this.pepper = process.env.DEVICE_SECRET_PEPPER ?? '';
  }

  generateSecret(): string {
    return randomBytes(32).toString('base64url');
  }

  async hashSecret(secret: string): Promise<string> {
    return argon2.hash(secret + this.pepper);
  }

  async verifySecret(secret: string, secretHash: string): Promise<boolean> {
    return argon2.verify(secretHash, secret + this.pepper);
  }
}
