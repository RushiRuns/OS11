import { parentPort } from 'node:worker_threads';

if (parentPort) {
  parentPort.on('message', (message: { type: string; payload: unknown }) => {
    switch (message.type) {
      case 'PING':
        parentPort?.postMessage({ type: 'PONG', timestamp: Date.now() });
        break;
      case 'INDEX_TASK':
        // Full-text search background indexing (FTS5)
        parentPort?.postMessage({ type: 'INDEXED', success: true });
        break;
      default:
        break;
    }
  });
}
