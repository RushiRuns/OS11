import fs from 'node:fs';
import path from 'node:path';

export interface ProcessAttachmentPayload {
  sourcePath: string;
  destDir: string;
  filename: string;
}

export interface ProcessAttachmentResult {
  filename: string;
  localPath: string;
  sizeBytes: number;
  mimeType: string;
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    case '.txt':
      return 'text/plain';
    case '.md':
      return 'text/markdown';
    case '.json':
      return 'application/json';
    case '.zip':
      return 'application/zip';
    default:
      return 'application/octet-stream';
  }
}

export class FileProcessor {
  public async processAttachment(payload: ProcessAttachmentPayload): Promise<ProcessAttachmentResult> {
    const { sourcePath, destDir, filename } = payload;

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const destPath = path.join(destDir, filename);
    await fs.promises.copyFile(sourcePath, destPath);

    const stats = await fs.promises.stat(destPath);
    const mimeType = getMimeType(destPath);

    return {
      filename,
      localPath: destPath,
      sizeBytes: stats.size,
      mimeType,
    };
  }
}

export default FileProcessor;
