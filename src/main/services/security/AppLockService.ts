import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { SettingsRepository } from '../../repositories/SettingsRepository.js';

const SERVICE_NAME = 'OS11';
const ACCOUNT_NAME = 'app_pin';

export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Perform dummy timingSafeEqual to avoid timing leak on length comparison
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export class AppLockService {
  private repository: SettingsRepository;
  private isLockedState = false;
  private keytarInstance: typeof import('keytar') | null = null;
  private fallbackPinMemory: string | null = null;

  constructor(repository?: SettingsRepository) {
    this.repository = repository ?? new SettingsRepository();
    // Default lock state on boot if lock is enabled
    const enabled = this.repository.get<boolean>('app_lock_enabled', false);
    this.isLockedState = Boolean(enabled);
  }

  private async getKeytar(): Promise<typeof import('keytar') | null> {
    if (this.keytarInstance) return this.keytarInstance;
    try {
      const mod = await import('keytar');
      this.keytarInstance = (mod as unknown as { default?: typeof import('keytar') }).default || mod;
      return this.keytarInstance;
    } catch {
      return null;
    }
  }

  private getFallbackPath(): string {
    let base = process.cwd();
    try {
      if (typeof app !== 'undefined' && app.getPath) {
        base = app.getPath('userData');
      }
    } catch {
      // Test environment
    }
    const secDir = path.join(base, 'security');
    if (!fs.existsSync(secDir)) {
      fs.mkdirSync(secDir, { recursive: true });
    }
    return path.join(secDir, 'pin.dat');
  }

  private hashFallback(pin: string): string {
    return crypto.createHash('sha256').update(`OS11_SEC_${pin}`).digest('hex');
  }

  public isEnabled(): boolean {
    return this.repository.get<boolean>('app_lock_enabled', false);
  }

  public isLocked(): boolean {
    return this.isEnabled() && this.isLockedState;
  }

  public lock(): void {
    if (this.isEnabled()) {
      this.isLockedState = true;
    }
  }

  public unlock(): void {
    this.isLockedState = false;
  }

  public async setPin(pin: string): Promise<boolean> {
    if (!pin || pin.length < 4) {
      throw new Error('PIN must be at least 4 digits');
    }

    const keytar = await this.getKeytar();
    if (keytar && typeof keytar.setPassword === 'function') {
      try {
        await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, pin);
        this.repository.set('app_lock_enabled', true);
        this.isLockedState = false;
        return true;
      } catch {
        // Fallback below
      }
    }

    // Encrypted/hashed local fallback for environments without OS keychain
    const fallbackPath = this.getFallbackPath();
    const hashed = this.hashFallback(pin);
    fs.writeFileSync(fallbackPath, hashed, 'utf8');
    this.fallbackPinMemory = pin;
    this.repository.set('app_lock_enabled', true);
    this.isLockedState = false;
    return true;
  }

  public async verifyPin(input: string): Promise<boolean> {
    if (!input) return false;

    const keytar = await this.getKeytar();
    let storedPin: string | null = null;

    if (keytar && typeof keytar.getPassword === 'function') {
      try {
        storedPin = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
      } catch {
        // Fall back
      }
    }

    if (storedPin !== null) {
      const match = constantTimeEqual(input, storedPin);
      if (match) {
        this.isLockedState = false;
      }
      return match;
    }

    // Check fallback
    if (this.fallbackPinMemory !== null) {
      const match = constantTimeEqual(input, this.fallbackPinMemory);
      if (match) {
        this.isLockedState = false;
      }
      return match;
    }

    const fallbackPath = this.getFallbackPath();
    if (fs.existsSync(fallbackPath)) {
      const storedHash = fs.readFileSync(fallbackPath, 'utf8').trim();
      const inputHash = this.hashFallback(input);
      const match = constantTimeEqual(inputHash, storedHash);
      if (match) {
        this.isLockedState = false;
      }
      return match;
    }

    return false;
  }

  public async setEnabled(enabled: boolean, currentPin?: string): Promise<boolean> {
    if (enabled) {
      if (!currentPin) {
        throw new Error('PIN required to enable App Lock');
      }
      return await this.setPin(currentPin);
    }

    // Disabling
    if (currentPin) {
      const ok = await this.verifyPin(currentPin);
      if (!ok) {
        throw new Error('Incorrect PIN');
      }
    }

    const keytar = await this.getKeytar();
    if (keytar && typeof keytar.deletePassword === 'function') {
      try {
        await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
      } catch {
        // Ignore
      }
    }

    const fallbackPath = this.getFallbackPath();
    if (fs.existsSync(fallbackPath)) {
      try {
        fs.unlinkSync(fallbackPath);
      } catch {
        // Ignore
      }
    }
    this.fallbackPinMemory = null;

    this.repository.set('app_lock_enabled', false);
    this.isLockedState = false;
    return true;
  }

  public getStatus(): { isEnabled: boolean; isLocked: boolean; hasBiometrics: boolean } {
    return {
      isEnabled: this.isEnabled(),
      isLocked: this.isLocked(),
      hasBiometrics: false, // Biometrics fallback flag
    };
  }
}

export default AppLockService;
