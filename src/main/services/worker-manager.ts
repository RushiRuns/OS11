import { Worker } from 'node:worker_threads';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
import { SearchRepository, type SearchResult } from '../repositories/SearchRepository.js';

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timer: NodeJS.Timeout;
}

export class WorkerManager {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private fallbackSearchRepo: SearchRepository | null = null;
  private isInitialized = false;
  private dbPath: string | null = null;

  constructor() {
    this.fallbackSearchRepo = new SearchRepository();
  }

  public isReady(): boolean {
    return this.isInitialized && this.worker !== null;
  }

  public getDbPath(): string | null {
    return this.dbPath;
  }

  public init(dbPath: string): void {
    this.dbPath = dbPath;
    this.startWorker();
    if (this.worker) {
      this.send('INIT_DB', { dbPath }).catch(() => {
        // Fallback handles it if worker fails
      });
    }
  }

  private startWorker(): void {
    if (this.worker) return;

    try {
      // Look for compiled worker file or ts file depending on runtime
      let currentDir = '';
      try {
        currentDir = path.dirname(fileURLToPath(import.meta.url));
      } catch {
        currentDir = process.cwd();
      }

      const distWorkerPath = path.resolve(currentDir, 'worker-main.js');
      const rootDistWorkerPath = path.resolve(process.cwd(), 'dist-electron', 'worker-main.js');

      let targetPath: string | null = null;
      if (fs.existsSync(distWorkerPath)) {
        targetPath = distWorkerPath;
      } else if (fs.existsSync(rootDistWorkerPath)) {
        targetPath = rootDistWorkerPath;
      }

      if (!targetPath) {
        // Worker bundle not built yet; fallback mode active
        return;
      }

      this.worker = new Worker(targetPath);

      this.worker.on('message', (msg: { reqId?: string; type: string; ok: boolean; data?: any; error?: string }) => {
        if (msg.reqId && this.pendingRequests.has(msg.reqId)) {
          const { resolve, reject, timer } = this.pendingRequests.get(msg.reqId)!;
          clearTimeout(timer);
          this.pendingRequests.delete(msg.reqId);

          if (msg.ok) {
            resolve(msg.data);
          } else {
            reject(new Error(msg.error || 'Worker error'));
          }
        }
      });

      this.worker.on('error', (err) => {
        console.warn('[WorkerManager] Worker encountered error:', err.message);
        this.terminate();
      });

      this.worker.on('exit', () => {
        this.worker = null;
      });

      this.isInitialized = true;
    } catch (err) {
      console.warn('[WorkerManager] Could not spawn worker thread; running in fallback mode:', err);
      this.worker = null;
    }
  }

  public async send<T>(type: string, payload?: unknown, timeoutMs = 5000): Promise<T> {
    // If worker is not running, handle known fallback operations directly
    if (!this.worker) {
      return this.handleFallback<T>(type, payload);
    }

    return new Promise<T>((resolve, reject) => {
      const reqId = uuidv4();
      const timer = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        // Fall back to main thread execution if timeout occurs
        this.handleFallback<T>(type, payload).then(resolve).catch(reject);
      }, timeoutMs);

      this.pendingRequests.set(reqId, { resolve, reject, timer });
      this.worker?.postMessage({ reqId, type, payload });
    });
  }

  public async search(query: string): Promise<SearchResult[]> {
    try {
      return await this.send<SearchResult[]>('SEARCH_QUERY', { query });
    } catch {
      return this.getFallbackSearchRepo().search(query);
    }
  }

  private handleFallback<T>(type: string, payload?: unknown): Promise<T> {
    if (type === 'SEARCH_QUERY') {
      const query = (payload as { query?: string })?.query || '';
      const results = this.getFallbackSearchRepo().search(query);
      return Promise.resolve(results as unknown as T);
    }

    if (type === 'INIT_DB' || type === 'INDEX_TASK' || type === 'PING') {
      return Promise.resolve(true as unknown as T);
    }

    return Promise.reject(new Error(`Worker operation "${type}" unavailable in fallback mode.`));
  }

  private getFallbackSearchRepo(): SearchRepository {
    if (!this.fallbackSearchRepo) {
      this.fallbackSearchRepo = new SearchRepository();
    }
    return this.fallbackSearchRepo;
  }

  public terminate(): void {
    for (const { timer, reject } of this.pendingRequests.values()) {
      clearTimeout(timer);
      reject(new Error('Worker terminated.'));
    }
    this.pendingRequests.clear();

    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {
        // Ignore termination error
      }
      this.worker = null;
    }
    this.isInitialized = false;
  }
}

export const workerManager = new WorkerManager();
export default workerManager;
