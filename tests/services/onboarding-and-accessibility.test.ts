import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { IdentityRepository } from '../../src/main/repositories/IdentityRepository.js';
import { SettingsRepository } from '../../src/main/repositories/SettingsRepository.js';
import { SettingsService } from '../../src/main/services/settings/SettingsService.js';
import { getTagShape, getTagShapeClass } from '../../src/shared/utils/tag-shape.js';
import { getIsoWeek, getMonthString } from '../../src/renderer/features/review/ReviewManager.js';

describe('Phase 18: Onboarding, Accessibility & Polish', () => {
  let db: Database.Database;
  let identityRepo: IdentityRepository;
  let settingsRepo: SettingsRepository;
  let settingsService: SettingsService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const schemaPath = path.resolve(__dirname, '../../src/main/migrations/0001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);

    identityRepo = new IdentityRepository(db);
    settingsRepo = new SettingsRepository(db);
    settingsService = new SettingsService(settingsRepo);
  });

  describe('Identity Layer (Step 2 of Onboarding)', () => {
    it('creates and returns default local identity if none exists', () => {
      const identity = identityRepo.get();
      expect(identity).toBeDefined();
      expect(identity.id).toBeTruthy();
      expect(identity.display_name).toBe('Local User');
    });

    it('updates display name and avatar emoji correctly', () => {
      identityRepo.get(); // ensure created
      identityRepo.updateIdentity('Cosmic Explorer', '🚀');

      const updated = identityRepo.get();
      expect(updated.display_name).toBe('Cosmic Explorer');
      expect(updated.avatar_emoji).toBe('🚀');
    });

    it('preserves existing emoji when only updating display name', () => {
      identityRepo.get();
      identityRepo.updateIdentity('Alice', '🦉');
      identityRepo.updateDisplayName('Alice Smith');

      const updated = identityRepo.get();
      expect(updated.display_name).toBe('Alice Smith');
      expect(updated.avatar_emoji).toBe('🦉');
    });
  });

  describe('Color-blind Accessibility Tag Shapes', () => {
    it('returns deterministic shapes for various tag identifiers', () => {
      const shape1 = getTagShape('work');
      const shape2 = getTagShape('work');
      expect(shape1).toBe(shape2);
      expect(['circle', 'square', 'triangle']).toContain(shape1);

      // Empty fallback
      expect(getTagShape('')).toBe('circle');
    });

    it('maps tag shapes to proper CSS classes', () => {
      const shapeClass = getTagShapeClass('personal');
      expect(['tagDotShapeCircle', 'tagDotShapeSquare', 'tagDotShapeTriangle']).toContain(shapeClass);
    });
  });

  describe('Recurring Review System Scheduling Logic', () => {
    it('computes standard ISO week strings', () => {
      const fixedDate = new Date('2026-09-18T17:30:00Z'); // Friday in September 2026
      const weekStr = getIsoWeek(fixedDate);
      expect(weekStr).toMatch(/^\d{4}-W\d{2}$/);
    });

    it('computes standard month strings', () => {
      const fixedDate = new Date('2026-09-01T09:00:00Z');
      const monthStr = getMonthString(fixedDate);
      expect(monthStr).toBe('2026-09');
    });
  });

  describe('Phase 18 Settings Integration', () => {
    it('initializes and saves onboarding completion state', () => {
      expect(settingsService.get('onboarding_completed', false)).toBe(false);

      settingsService.set('onboarding_completed', true);
      expect(settingsService.get('onboarding_completed', false)).toBe(true);
    });

    it('manages weekly and monthly review settings', () => {
      settingsService.set('weekly_review_enabled', true);
      settingsService.set('weekly_review_time', '16:30');
      settingsService.set('monthly_review_enabled', true);

      expect(settingsService.get('weekly_review_enabled', false)).toBe(true);
      expect(settingsService.get('weekly_review_time', '')).toBe('16:30');
      expect(settingsService.get('monthly_review_enabled', false)).toBe(true);
    });
  });
});
