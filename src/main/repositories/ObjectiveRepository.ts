import { BaseRepository } from './base-repository.js';
import type {
  Objective,
  CreateObjectivePayload,
  UpdateObjectivePayload,
  ObjectiveDeleteResult,
  ObjectiveRestoreResult,
  ObjectiveUndoSnapshot,
} from '../../shared/types/Objective.js';
import type {
  KeyResult,
  KRCheckIn,
  KRHabitLog,
  CreateKeyResultPayload,
  UpdateKeyResultPayload,
  CheckInEntryPayload,
  CheckInUndoState,
  KeyResultDeleteResult,
} from '../../shared/types/KeyResult.js';
import { SettingsRepository } from './SettingsRepository.js';
import { getEffectiveToday } from '../../shared/utils/date.js';
import { v4 as uuidv4 } from 'uuid';

export class ObjectiveRepository extends BaseRepository {
  private getToday(): string {
    try {
      const settingsRepo = new SettingsRepository(this.db);
      const dayStartsAt = settingsRepo.get<string>('day_starts_at', '08:00');
      return getEffectiveToday(dayStartsAt);
    } catch {
      return getEffectiveToday('08:00');
    }
  }

  private hasTable(name: string): boolean {
    try {
      const row = this.db.prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?"
      ).get(name);
      return !!row;
    } catch {
      return false;
    }
  }

  // --- Objectives ---

  public getAllObjectives(): Objective[] {
    if (!this.hasTable('objectives')) {
      return [];
    }
    const stmt = this.db.prepare(`
      SELECT * FROM objectives
      ORDER BY period_end ASC, created_at ASC
    `);
    return stmt.all() as Objective[];
  }

  public getObjectiveById(id: string): Objective | null {
    const stmt = this.db.prepare(`
      SELECT * FROM objectives WHERE id = ?
    `);
    const res = stmt.get(id) as Objective | undefined;
    return res ?? null;
  }

  public createObjective(payload: CreateObjectivePayload): Objective {
    if (!payload.title || typeof payload.title !== 'string' || payload.title.trim().length === 0) {
      throw new Error('Objective title is required.');
    }
    if (!payload.period_start || !payload.period_end) {
      throw new Error('Objective period_start and period_end are required.');
    }
    if (payload.period_end < payload.period_start) {
      throw new Error('Objective period_end must be greater than or equal to period_start.');
    }

    const id = payload.id ?? uuidv4();
    const now = new Date().toISOString();
    const periodKind = payload.period_kind ?? 'quarter';
    const cadence = payload.cadence ?? 'weekly';
    const status = payload.status ?? 'active';
    const areaId = payload.area_id ?? null;

    const record: Objective = {
      id,
      title: payload.title.trim(),
      notes: payload.notes ?? null,
      area_id: areaId,
      period_kind: periodKind,
      period_start: payload.period_start,
      period_end: payload.period_end,
      cadence,
      status,
      completed_at: status === 'completed' ? now : null,
      created_at: now,
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO objectives (
        id, title, notes, area_id, period_kind,
        period_start, period_end, cadence, status,
        completed_at, created_at, updated_at
      ) VALUES (
        @id, @title, @notes, @area_id, @period_kind,
        @period_start, @period_end, @cadence, @status,
        @completed_at, @created_at, @updated_at
      )
    `);

    stmt.run(record);
    return record;
  }

  public updateObjective(id: string, payload: UpdateObjectivePayload): Objective {
    const current = this.getObjectiveById(id);
    if (!current) {
      throw new Error(`Objective not found: ${id}`);
    }

    const newStart = payload.period_start !== undefined ? payload.period_start : current.period_start;
    const newEnd = payload.period_end !== undefined ? payload.period_end : current.period_end;
    if (newEnd < newStart) {
      throw new Error('Objective period_end must be greater than or equal to period_start.');
    }

    const now = new Date().toISOString();
    let completedAt = current.completed_at;
    if (payload.status !== undefined) {
      if (payload.status === 'completed' && current.status !== 'completed') {
        completedAt = payload.completed_at ?? now;
      } else if (payload.status !== 'completed' && current.status === 'completed') {
        completedAt = null;
      } else if (payload.completed_at !== undefined) {
        completedAt = payload.completed_at;
      }
    } else if (payload.completed_at !== undefined) {
      completedAt = payload.completed_at;
    }

    const updated: Objective = {
      ...current,
      title: payload.title !== undefined ? payload.title.trim() : current.title,
      notes: payload.notes !== undefined ? payload.notes : current.notes,
      area_id: payload.area_id !== undefined ? payload.area_id : current.area_id,
      period_kind: payload.period_kind !== undefined ? payload.period_kind : current.period_kind,
      period_start: newStart,
      period_end: newEnd,
      cadence: payload.cadence !== undefined ? payload.cadence : current.cadence,
      status: payload.status !== undefined ? payload.status : current.status,
      completed_at: completedAt,
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      UPDATE objectives SET
        title = @title,
        notes = @notes,
        area_id = @area_id,
        period_kind = @period_kind,
        period_start = @period_start,
        period_end = @period_end,
        cadence = @cadence,
        status = @status,
        completed_at = @completed_at,
        updated_at = @updated_at
      WHERE id = @id
    `);

    stmt.run(updated);
    return updated;
  }

  public deleteObjective(id: string): ObjectiveDeleteResult {
    const deleteTx = this.db.transaction(() => {
      const objective = this.getObjectiveById(id);
      if (!objective) {
        throw new Error(`Objective not found: ${id}`);
      }

      const keyResults = this.getKeyResultsByObjectiveId(id);

      const checkIns = this.db.prepare(`
        SELECT * FROM kr_check_ins
        WHERE key_result_id IN (SELECT id FROM key_results WHERE objective_id = ?)
        ORDER BY checked_in_on DESC, created_at DESC
      `).all(id) as KRCheckIn[];

      const habitLogs = this.db.prepare(`
        SELECT * FROM kr_habit_logs
        WHERE key_result_id IN (SELECT id FROM key_results WHERE objective_id = ?)
        ORDER BY log_date ASC
      `).all(id) as KRHabitLog[];

      const taskRows = this.db.prepare(`
        SELECT id, key_result_id FROM tasks
        WHERE key_result_id IN (SELECT id FROM key_results WHERE objective_id = ?)
      `).all(id) as Array<{ id: string; key_result_id: string }>;

      const projectRows = this.db.prepare(`
        SELECT id, key_result_id FROM projects
        WHERE key_result_id IN (SELECT id FROM key_results WHERE objective_id = ?)
      `).all(id) as Array<{ id: string; key_result_id: string }>;

      this.db.prepare(`
        UPDATE tasks SET key_result_id = NULL
        WHERE key_result_id IN (SELECT id FROM key_results WHERE objective_id = ?)
      `).run(id);

      this.db.prepare(`
        UPDATE projects SET key_result_id = NULL
        WHERE key_result_id IN (SELECT id FROM key_results WHERE objective_id = ?)
      `).run(id);

      this.db.prepare(`DELETE FROM objectives WHERE id = ?`).run(id);

      const snapshot: ObjectiveUndoSnapshot = {
        objective,
        keyResults,
        checkIns,
        habitLogs,
        taskLinks: taskRows.map((t) => ({ resourceId: t.id, keyResultId: t.key_result_id })),
        projectLinks: projectRows.map((p) => ({ resourceId: p.id, keyResultId: p.key_result_id })),
      };

      return {
        snapshot,
        clearedTaskIds: taskRows.map((t) => t.id),
        clearedProjectIds: projectRows.map((p) => p.id),
      };
    });

    return deleteTx();
  }

  public restoreObjective(snapshot: ObjectiveUndoSnapshot): ObjectiveRestoreResult {
    const restoreTx = this.db.transaction(() => {
      const obj = snapshot.objective;
      this.db.prepare(`
        INSERT INTO objectives (
          id, title, notes, area_id, period_kind,
          period_start, period_end, cadence, status,
          completed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        obj.id,
        obj.title,
        obj.notes ?? null,
        obj.area_id ?? null,
        obj.period_kind,
        obj.period_start,
        obj.period_end,
        obj.cadence,
        obj.status,
        obj.completed_at ?? null,
        obj.created_at,
        obj.updated_at
      );

      const krStmt = this.db.prepare(`
        INSERT INTO key_results (
          id, objective_id, title, kind, unit,
          start_value, target_value, current_value, status,
          sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const kr of snapshot.keyResults) {
        krStmt.run(
          kr.id,
          kr.objective_id,
          kr.title,
          kr.kind,
          kr.unit ?? null,
          kr.start_value,
          kr.target_value,
          kr.current_value,
          kr.status ?? null,
          kr.sort_order,
          kr.created_at,
          kr.updated_at
        );
      }

      const ciStmt = this.db.prepare(`
        INSERT INTO kr_check_ins (
          id, key_result_id, checked_in_on, value, status, note, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const ci of snapshot.checkIns) {
        ciStmt.run(
          ci.id,
          ci.key_result_id,
          ci.checked_in_on,
          ci.value ?? null,
          ci.status,
          ci.note ?? null,
          ci.created_at
        );
      }

      const hlStmt = this.db.prepare(`
        INSERT INTO kr_habit_logs (
          key_result_id, log_date, created_at
        ) VALUES (?, ?, ?)
      `);

      for (const hl of snapshot.habitLogs) {
        hlStmt.run(hl.key_result_id, hl.log_date, hl.created_at);
      }

      const updateTask = this.db.prepare('UPDATE tasks SET key_result_id = ? WHERE id = ?');
      for (const tl of snapshot.taskLinks) {
        updateTask.run(tl.keyResultId, tl.resourceId);
      }

      const updateProject = this.db.prepare('UPDATE projects SET key_result_id = ? WHERE id = ?');
      for (const pl of snapshot.projectLinks) {
        updateProject.run(pl.keyResultId, pl.resourceId);
      }

      return {
        taskLinks: snapshot.taskLinks,
        projectLinks: snapshot.projectLinks,
      };
    });

    return restoreTx();
  }

  // --- Key Results ---

  public getAllKeyResults(): KeyResult[] {
    if (!this.hasTable('key_results')) {
      return [];
    }
    const stmt = this.db.prepare(`
      SELECT * FROM key_results
      ORDER BY sort_order ASC, created_at ASC
    `);
    return stmt.all() as KeyResult[];
  }

  public getKeyResultById(id: string): KeyResult | null {
    const stmt = this.db.prepare(`
      SELECT * FROM key_results WHERE id = ?
    `);
    const res = stmt.get(id) as KeyResult | undefined;
    return res ?? null;
  }

  public getKeyResultsByObjectiveId(objectiveId: string): KeyResult[] {
    const stmt = this.db.prepare(`
      SELECT * FROM key_results
      WHERE objective_id = ?
      ORDER BY sort_order ASC, created_at ASC
    `);
    return stmt.all(objectiveId) as KeyResult[];
  }

  public createKeyResult(payload: CreateKeyResultPayload): KeyResult {
    const obj = this.getObjectiveById(payload.objective_id);
    if (!obj) {
      throw new Error(`Cannot create key result: parent objective "${payload.objective_id}" not found.`);
    }

    if (!payload.title || typeof payload.title !== 'string' || payload.title.trim().length === 0) {
      throw new Error('Key result title is required.');
    }

    const kind = payload.kind;
    if (kind !== 'metric' && kind !== 'work' && kind !== 'habit') {
      throw new Error(`Invalid key result kind: "${kind}".`);
    }

    let startVal = payload.start_value ?? 0;
    let targetVal = payload.target_value ?? 0;
    let currentVal = payload.current_value ?? startVal;

    if (kind === 'metric') {
      if (startVal === targetVal) {
        throw new Error('Metric key results must have start_value different from target_value.');
      }
    } else if (kind === 'habit') {
      startVal = 0;
      currentVal = 0;
      targetVal = payload.target_value !== undefined ? payload.target_value : 1;
      if (targetVal < 1 || targetVal > 7) {
        throw new Error('Habit key results must have target_value between 1 and 7 (days per week).');
      }
    } else if (kind === 'work') {
      startVal = 0;
      targetVal = 0;
      currentVal = 0;
    }

    let sortOrder = payload.sort_order;
    if (sortOrder === undefined) {
      const maxRow = this.db.prepare(`
        SELECT MAX(sort_order) as max_sort FROM key_results WHERE objective_id = ?
      `).get(payload.objective_id) as { max_sort: number | null };
      sortOrder = typeof maxRow?.max_sort === 'number' ? maxRow.max_sort + 1000 : 1000;
    }

    const id = payload.id ?? uuidv4();
    const now = new Date().toISOString();

    const record: KeyResult = {
      id,
      objective_id: payload.objective_id,
      title: payload.title.trim(),
      kind,
      unit: payload.unit ?? null,
      start_value: startVal,
      target_value: targetVal,
      current_value: currentVal,
      status: payload.status ?? null,
      sort_order: sortOrder,
      created_at: now,
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO key_results (
        id, objective_id, title, kind, unit,
        start_value, target_value, current_value, status,
        sort_order, created_at, updated_at
      ) VALUES (
        @id, @objective_id, @title, @kind, @unit,
        @start_value, @target_value, @current_value, @status,
        @sort_order, @created_at, @updated_at
      )
    `);

    stmt.run(record);
    return record;
  }

  public updateKeyResult(id: string, payload: UpdateKeyResultPayload): KeyResult {
    const updateTx = this.db.transaction(() => {
      const current = this.getKeyResultById(id);
      if (!current) {
        throw new Error(`Key result not found: ${id}`);
      }

      const kind = payload.kind !== undefined ? payload.kind : current.kind;
      let startVal = payload.start_value !== undefined ? payload.start_value : current.start_value;
      let targetVal = payload.target_value !== undefined ? payload.target_value : current.target_value;
      let currentVal = payload.current_value !== undefined ? payload.current_value : current.current_value;
      let status = payload.status !== undefined ? payload.status : current.status;

      if (payload.resetHistory) {
        this.db.prepare('DELETE FROM kr_check_ins WHERE key_result_id = ?').run(id);
        this.db.prepare('DELETE FROM kr_habit_logs WHERE key_result_id = ?').run(id);
        currentVal = startVal;
        status = null;
      }

      if (kind === 'metric') {
        if (startVal === targetVal) {
          throw new Error('Metric key results must have start_value different from target_value.');
        }
      } else if (kind === 'habit') {
        startVal = 0;
        currentVal = 0;
        if (targetVal < 1 || targetVal > 7) {
          throw new Error('Habit key results must have target_value between 1 and 7 (days per week).');
        }
      } else if (kind === 'work') {
        startVal = 0;
        targetVal = 0;
        currentVal = 0;
      }

      const now = new Date().toISOString();
      const updated: KeyResult = {
        ...current,
        title: payload.title !== undefined ? payload.title.trim() : current.title,
        kind,
        unit: payload.unit !== undefined ? payload.unit : current.unit,
        start_value: startVal,
        target_value: targetVal,
        current_value: currentVal,
        status: status ?? null,
        sort_order: payload.sort_order !== undefined ? payload.sort_order : current.sort_order,
        updated_at: now,
      };

      const stmt = this.db.prepare(`
        UPDATE key_results SET
          title = @title,
          kind = @kind,
          unit = @unit,
          start_value = @start_value,
          target_value = @target_value,
          current_value = @current_value,
          status = @status,
          sort_order = @sort_order,
          updated_at = @updated_at
        WHERE id = @id
      `);

      stmt.run(updated);
      return updated;
    });

    return updateTx();
  }

  public deleteKeyResult(id: string): KeyResultDeleteResult {
    const deleteTx = this.db.transaction(() => {
      const current = this.getKeyResultById(id);
      if (!current) {
        throw new Error(`Key result not found: ${id}`);
      }

      const taskRows = this.db.prepare('SELECT id FROM tasks WHERE key_result_id = ?').all(id) as Array<{ id: string }>;
      const projectRows = this.db.prepare('SELECT id FROM projects WHERE key_result_id = ?').all(id) as Array<{ id: string }>;

      this.db.prepare('UPDATE tasks SET key_result_id = NULL WHERE key_result_id = ?').run(id);
      this.db.prepare('UPDATE projects SET key_result_id = NULL WHERE key_result_id = ?').run(id);

      this.db.prepare('DELETE FROM key_results WHERE id = ?').run(id);

      return {
        clearedTaskIds: taskRows.map((t) => t.id),
        clearedProjectIds: projectRows.map((p) => p.id),
      };
    });

    return deleteTx();
  }

  // --- Check-Ins & Habit Logs ---

  public recordCheckIns(
    entries: CheckInEntryPayload[],
    effectiveToday?: string
  ): { checkIns: KRCheckIn[]; undoState: CheckInUndoState; updatedKeyResults: KeyResult[] } {
    const recordTx = this.db.transaction(() => {
      const today = effectiveToday ?? this.getToday();
      const now = new Date().toISOString();
      const checkIns: KRCheckIn[] = [];
      const updatedKeyResults: KeyResult[] = [];
      const undoState: CheckInUndoState = {
        entryIds: [],
        previousStates: {},
      };

      const insertCheckIn = this.db.prepare(`
        INSERT INTO kr_check_ins (
          id, key_result_id, checked_in_on, value, status, note, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const updateKR = this.db.prepare(`
        UPDATE key_results SET
          current_value = ?,
          status = ?,
          updated_at = ?
        WHERE id = ?
      `);

      for (const entry of entries) {
        const kr = this.getKeyResultById(entry.keyResultId);
        if (!kr) {
          throw new Error(`Key result not found: ${entry.keyResultId}`);
        }

        if (!undoState.previousStates[kr.id]) {
          undoState.previousStates[kr.id] = {
            current_value: kr.current_value,
            status: kr.status ?? null,
          };
        }

        const checkInId = uuidv4();
        undoState.entryIds.push(checkInId);

        insertCheckIn.run(
          checkInId,
          kr.id,
          today,
          entry.value,
          entry.status,
          entry.note ?? null,
          now
        );

        checkIns.push({
          id: checkInId,
          key_result_id: kr.id,
          checked_in_on: today,
          value: entry.value,
          status: entry.status,
          note: entry.note ?? null,
          created_at: now,
        });

        updateKR.run(entry.value, entry.status, now, kr.id);

        const updatedKr = this.getKeyResultById(kr.id)!;
        updatedKeyResults.push(updatedKr);
      }

      return { checkIns, undoState, updatedKeyResults };
    });

    return recordTx();
  }

  public undoCheckIns(snapshot: CheckInUndoState): KeyResult[] {
    const undoTx = this.db.transaction(() => {
      const deleteCheckIn = this.db.prepare('DELETE FROM kr_check_ins WHERE id = ?');
      for (const entryId of snapshot.entryIds) {
        deleteCheckIn.run(entryId);
      }

      const updateKR = this.db.prepare(`
        UPDATE key_results SET
          current_value = ?,
          status = ?,
          updated_at = ?
        WHERE id = ?
      `);

      const now = new Date().toISOString();
      const updatedKeyResults: KeyResult[] = [];

      for (const [krId, prevState] of Object.entries(snapshot.previousStates)) {
        updateKR.run(prevState.current_value, prevState.status, now, krId);
        const kr = this.getKeyResultById(krId);
        if (kr) {
          updatedKeyResults.push(kr);
        }
      }

      return updatedKeyResults;
    });

    return undoTx();
  }

  public toggleHabitLog(
    key_result_id: string,
    log_date: string
  ): { key_result_id: string; log_date: string; state: boolean } {
    const toggleTx = this.db.transaction(() => {
      const kr = this.getKeyResultById(key_result_id);
      if (!kr) {
        throw new Error(`Key result not found: ${key_result_id}`);
      }

      const existing = this.db.prepare(`
        SELECT 1 FROM kr_habit_logs WHERE key_result_id = ? AND log_date = ?
      `).get(key_result_id, log_date);

      if (existing) {
        this.db.prepare(`
          DELETE FROM kr_habit_logs WHERE key_result_id = ? AND log_date = ?
        `).run(key_result_id, log_date);
        return { key_result_id, log_date, state: false };
      } else {
        const now = new Date().toISOString();
        this.db.prepare(`
          INSERT INTO kr_habit_logs (key_result_id, log_date, created_at)
          VALUES (?, ?, ?)
        `).run(key_result_id, log_date, now);
        return { key_result_id, log_date, state: true };
      }
    });

    return toggleTx();
  }

  public loadAll(): {
    objectives: Objective[];
    keyResults: KeyResult[];
    checkIns: KRCheckIn[];
    habitLogs: KRHabitLog[];
  } {
    if (!this.hasTable('objectives')) {
      return { objectives: [], keyResults: [], checkIns: [], habitLogs: [] };
    }
    const objectives = this.getAllObjectives();
    const keyResults = this.getAllKeyResults();
    const checkIns = this.hasTable('kr_check_ins')
      ? (this.db.prepare(`
          SELECT * FROM kr_check_ins
          ORDER BY checked_in_on DESC, created_at DESC
        `).all() as KRCheckIn[])
      : [];
    const habitLogs = this.hasTable('kr_habit_logs')
      ? (this.db.prepare(`
          SELECT * FROM kr_habit_logs
          ORDER BY log_date ASC
        `).all() as KRHabitLog[])
      : [];

    return { objectives, keyResults, checkIns, habitLogs };
  }
}
