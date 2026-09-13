import type Database from 'better-sqlite3';
import { getDatabase } from '../database.js';

export abstract class BaseRepository {
  protected get db(): Database.Database {
    return getDatabase();
  }
}
