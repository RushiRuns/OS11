import { SettingsRepository } from '../../repositories/settings-repository.js';
import type { SystemInfo } from '@shared/types/settings.js';
import { app } from 'electron';

export class SettingsService {
  private repository: SettingsRepository;

  constructor(repository?: SettingsRepository) {
    this.repository = repository ?? new SettingsRepository();
  }

  public get<T>(key: string, defaultValue: T): T {
    return this.repository.get(key, defaultValue);
  }

  public set<T>(key: string, value: T): void {
    this.repository.set(key, value);
  }

  public getAll(): Record<string, unknown> {
    return this.repository.getAll();
  }

  public getSystemInfo(): SystemInfo {
    return {
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform,
    };
  }
}
