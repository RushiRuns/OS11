import type Database from 'better-sqlite3';
import { getDb } from './db.js';

export abstract class BaseRepository {
  protected customDb?: Database.Database;

  constructor(customDb?: Database.Database) {
    this.customDb = customDb;
  }

  protected get db(): Database.Database {
    return this.customDb ?? getDb();
  }
}

export default BaseRepository;
