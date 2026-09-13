import { parentPort } from 'node:worker_threads';
import { SearchWorker } from './search/SearchWorker.js';
import { FileProcessor, type ProcessAttachmentPayload } from './file-processor/FileProcessor.js';

const searchWorker = new SearchWorker();
const fileProcessor = new FileProcessor();

if (parentPort) {
  parentPort.on('message', async (message: { reqId?: string; type: string; payload?: any }) => {
    const { reqId, type, payload } = message;

    try {
      switch (type) {
        case 'INIT_DB': {
          if (payload?.dbPath) {
            searchWorker.initDb(payload.dbPath);
          }
          parentPort?.postMessage({ reqId, type, ok: true, data: true });
          break;
        }

        case 'SEARCH_QUERY': {
          const results = searchWorker.search(payload?.query || '');
          parentPort?.postMessage({ reqId, type, ok: true, data: results });
          break;
        }

        case 'INDEX_TASK': {
          // FTS5 triggers handle database indexing synchronously on transactions;
          // this worker hook allows any custom asynchronous token caching or analysis.
          parentPort?.postMessage({ reqId, type, ok: true, data: true });
          break;
        }

        case 'PROCESS_ATTACHMENT': {
          const result = await fileProcessor.processAttachment(payload as ProcessAttachmentPayload);
          parentPort?.postMessage({ reqId, type, ok: true, data: result });
          break;
        }

        case 'PING': {
          parentPort?.postMessage({ reqId, type: 'PONG', ok: true, data: Date.now() });
          break;
        }

        default: {
          parentPort?.postMessage({ reqId, type, ok: false, error: `Unknown worker message type "${type}".` });
          break;
        }
      }
    } catch (err: unknown) {
      parentPort?.postMessage({
        reqId,
        type,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
