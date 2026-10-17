import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { runMigrations } from '../../src/main/migrations/runner.js';
import { ObjectiveRepository } from '../../src/main/repositories/ObjectiveRepository.js';
import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { ProjectRepository } from '../../src/main/repositories/ProjectRepository.js';

describe('Integration: ObjectiveRepository (Step 4)', () => {
  let db: Database.Database;
  let tempMigrationsDir: string;
  let repo: ObjectiveRepository;
  let taskRepo: TaskRepository;
  let projectRepo: ProjectRepository;

  const realMigrationsDir = path.resolve(__dirname, '../../src/main/migrations');

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    tempMigrationsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'os11-okr-repo-test-'));
    const files = fs.readdirSync(realMigrationsDir).filter((f) => f.endsWith('.sql'));
    for (const f of files) {
      fs.copyFileSync(path.join(realMigrationsDir, f), path.join(tempMigrationsDir, f));
    }
    runMigrations(db, tempMigrationsDir);

    repo = new ObjectiveRepository(db);
    taskRepo = new TaskRepository(db);
    projectRepo = new ProjectRepository(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
    if (fs.existsSync(tempMigrationsDir)) {
      fs.rmSync(tempMigrationsDir, { recursive: true, force: true });
    }
  });

  it('loadAll returns empty arrays initially', () => {
    const data = repo.loadAll();
    expect(data.objectives).toEqual([]);
    expect(data.keyResults).toEqual([]);
    expect(data.checkIns).toEqual([]);
    expect(data.habitLogs).toEqual([]);
  });

  it('creates and updates an objective', () => {
    const created = repo.createObjective({
      title: 'Launch Version 2.0',
      period_start: '2026-10-01',
      period_end: '2026-12-31',
    });
    expect(created.id).toBeDefined();
    expect(created.title).toBe('Launch Version 2.0');
    expect(created.period_kind).toBe('quarter');
    expect(created.cadence).toBe('weekly');
    expect(created.status).toBe('active');
    expect(created.completed_at).toBeNull();

    // Rejects invalid date range
    expect(() => {
      repo.createObjective({
        title: 'Bad range',
        period_start: '2026-12-31',
        period_end: '2026-10-01',
      });
    }).toThrow();

    // Update objective status to completed sets completed_at
    const updated = repo.updateObjective(created.id, {
      status: 'completed',
    });
    expect(updated.status).toBe('completed');
    expect(updated.completed_at).toBeTruthy();

    // Revert status clears completed_at
    const resumed = repo.updateObjective(created.id, {
      status: 'active',
    });
    expect(resumed.status).toBe('active');
    expect(resumed.completed_at).toBeNull();

    // Valid period update
    const periodUpdated = repo.updateObjective(created.id, {
      period_start: '2027-01-01',
      period_end: '2027-03-31',
      period_kind: 'quarter',
    });
    expect(periodUpdated.period_start).toBe('2027-01-01');
    expect(periodUpdated.period_end).toBe('2027-03-31');
    expect(periodUpdated.period_kind).toBe('quarter');

    // Invalid period update (end before start) throws error
    expect(() => {
      repo.updateObjective(created.id, {
        period_start: '2027-05-01',
        period_end: '2027-04-01',
      });
    }).toThrow('Objective period_end must be greater than or equal to period_start.');
  });

  it('creates and validates key results for all 3 kinds', () => {
    const obj = repo.createObjective({
      title: 'Objective for KRs',
      period_start: '2026-10-01',
      period_end: '2026-12-31',
    });

    // Metric KR
    const metricKR = repo.createKeyResult({
      objective_id: obj.id,
      title: 'NPS Score',
      kind: 'metric',
      start_value: 20,
      target_value: 50,
      unit: 'pts',
    });
    expect(metricKR.current_value).toBe(20);
    expect(metricKR.sort_order).toBe(1000);

    // Metric KR rejects start_value == target_value
    expect(() => {
      repo.createKeyResult({
        objective_id: obj.id,
        title: 'Invalid Metric',
        kind: 'metric',
        start_value: 10,
        target_value: 10,
      });
    }).toThrow();

    // Habit KR
    const habitKR = repo.createKeyResult({
      objective_id: obj.id,
      title: 'Workout 4x/week',
      kind: 'habit',
      target_value: 4,
    });
    expect(habitKR.start_value).toBe(0);
    expect(habitKR.current_value).toBe(0);
    expect(habitKR.target_value).toBe(4);
    expect(habitKR.sort_order).toBe(2000);

    // Habit KR rejects target_value outside 1..7
    expect(() => {
      repo.createKeyResult({
        objective_id: obj.id,
        title: 'Daily Workout',
        kind: 'habit',
        target_value: 8,
      });
    }).toThrow();

    // Work KR
    const workKR = repo.createKeyResult({
      objective_id: obj.id,
      title: 'Finish onboarding flow',
      kind: 'work',
    });
    expect(workKR.start_value).toBe(0);
    expect(workKR.target_value).toBe(0);
    expect(workKR.current_value).toBe(0);
    expect(workKR.sort_order).toBe(3000);
  });

  it('records check-ins and supports undo', () => {
    const obj = repo.createObjective({
      title: 'Objective Checkin',
      period_start: '2026-10-01',
      period_end: '2026-12-31',
    });

    const kr = repo.createKeyResult({
      objective_id: obj.id,
      title: 'Revenue',
      kind: 'metric',
      start_value: 1000,
      target_value: 5000,
      unit: '$',
    });

    const result = repo.recordCheckIns([
      {
        keyResultId: kr.id,
        value: 2500,
        status: 'on_track',
        note: 'Solid month',
      },
    ], '2026-10-15');

    expect(result.checkIns).toHaveLength(1);
    expect(result.checkIns[0].value).toBe(2500);
    expect(result.checkIns[0].checked_in_on).toBe('2026-10-15');
    expect(result.undoState.entryIds).toHaveLength(1);

    const updatedKR = repo.getKeyResultById(kr.id);
    expect(updatedKR?.current_value).toBe(2500);
    expect(updatedKR?.status).toBe('on_track');

    // Undo check-in
    const undoneKRs = repo.undoCheckIns(result.undoState);
    expect(undoneKRs).toHaveLength(1);
    expect(undoneKRs[0].current_value).toBe(1000);
    expect(undoneKRs[0].status).toBeNull();

    const krAfterUndo = repo.getKeyResultById(kr.id);
    expect(krAfterUndo?.current_value).toBe(1000);
    expect(krAfterUndo?.status).toBeNull();
  });

  it('toggles habit logs', () => {
    const obj = repo.createObjective({
      title: 'Objective Habit',
      period_start: '2026-10-01',
      period_end: '2026-12-31',
    });

    const habitKR = repo.createKeyResult({
      objective_id: obj.id,
      title: 'Read Book',
      kind: 'habit',
      target_value: 5,
    });

    // 1st toggle: insert
    const toggle1 = repo.toggleHabitLog(habitKR.id, '2026-10-15');
    expect(toggle1.state).toBe(true);

    const logsAfter1 = repo.loadAll().habitLogs;
    expect(logsAfter1).toHaveLength(1);
    expect(logsAfter1[0].log_date).toBe('2026-10-15');

    // 2nd toggle: remove
    const toggle2 = repo.toggleHabitLog(habitKR.id, '2026-10-15');
    expect(toggle2.state).toBe(false);

    const logsAfter2 = repo.loadAll().habitLogs;
    expect(logsAfter2).toHaveLength(0);
  });

  it('deletes and restores an objective including linked tasks and projects', () => {
    const obj = repo.createObjective({
      title: 'Objective To Delete',
      period_start: '2026-10-01',
      period_end: '2026-12-31',
    });

    const kr = repo.createKeyResult({
      objective_id: obj.id,
      title: 'KR 1',
      kind: 'work',
    });

    const task = taskRepo.create({
      title: 'Task linked to KR',
      key_result_id: kr.id,
    });

    const project = projectRepo.create({
      name: 'Project linked to KR',
      key_result_id: kr.id,
    });

    repo.toggleHabitLog(kr.id, '2026-10-15');

    // Delete objective
    const deleteResult = repo.deleteObjective(obj.id);
    expect(deleteResult.clearedTaskIds).toContain(task.id);
    expect(deleteResult.clearedProjectIds).toContain(project.id);
    expect(repo.getObjectiveById(obj.id)).toBeNull();
    expect(repo.getKeyResultById(kr.id)).toBeNull();

    // Verify task and project were detached
    expect(taskRepo.getById(task.id)?.key_result_id).toBeNull();
    expect(projectRepo.getById(project.id)?.key_result_id).toBeNull();

    // Restore objective from snapshot
    const restoreResult = repo.restoreObjective(deleteResult.snapshot);
    expect(restoreResult.taskLinks).toHaveLength(1);
    expect(restoreResult.projectLinks).toHaveLength(1);

    // Verify objective and KR are restored
    expect(repo.getObjectiveById(obj.id)).toBeTruthy();
    expect(repo.getKeyResultById(kr.id)).toBeTruthy();

    // Verify task and project links are restored
    expect(taskRepo.getById(task.id)?.key_result_id).toBe(kr.id);
    expect(projectRepo.getById(project.id)?.key_result_id).toBe(kr.id);
  });

  it('updateKeyResult with resetHistory wipes check-ins, logs, and resets current_value', () => {
    const obj = repo.createObjective({
      title: 'Objective Reset',
      period_start: '2026-10-01',
      period_end: '2026-12-31',
    });

    const kr = repo.createKeyResult({
      objective_id: obj.id,
      title: 'Reset Metric',
      kind: 'metric',
      start_value: 0,
      target_value: 100,
    });

    repo.recordCheckIns([{ keyResultId: kr.id, value: 75, status: 'on_track' }], '2026-10-10');
    expect(repo.getKeyResultById(kr.id)?.current_value).toBe(75);

    repo.updateKeyResult(kr.id, {
      start_value: 10,
      target_value: 110,
      resetHistory: true,
    });

    const resetKR = repo.getKeyResultById(kr.id);
    expect(resetKR?.start_value).toBe(10);
    expect(resetKR?.current_value).toBe(10);
    expect(resetKR?.status).toBeNull();

    const allData = repo.loadAll();
    const krCheckIns = allData.checkIns.filter((c) => c.key_result_id === kr.id);
    expect(krCheckIns).toHaveLength(0);
  });
});
