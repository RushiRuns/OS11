import { app, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';

export interface BackgroundImageInfo {
  id: string;
  name: string;
  path: string;
  url: string;
  created_at: string;
}

export class BackgroundService {
  private getBackgroundsDir(): string {
    let base = process.cwd();
    try {
      if (typeof app !== 'undefined' && app.getPath) {
        base = app.getPath('userData');
      }
    } catch {
      // Test environment
    }
    const dir = path.join(base, 'backgrounds');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  public async pickAndUpload(): Promise<BackgroundImageInfo | null> {
    const result = await dialog.showOpenDialog({
      title: 'Choose Background Image',
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] },
      ],
    });

    if (result.canceled || !result.filePaths.length) {
      return null;
    }

    return this.upload(result.filePaths[0]);
  }

  public upload(sourcePath: string): BackgroundImageInfo {
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Source file does not exist: ${sourcePath}`);
    }

    const dir = this.getBackgroundsDir();
    const ext = path.extname(sourcePath) || '.png';
    const id = uuidv4();
    const filename = `${id}${ext}`;
    const destPath = path.join(dir, filename);

    fs.copyFileSync(sourcePath, destPath);

    // Generate local file URL (safe for Electron file:// or data URI)
    const fileUrl = `file://${destPath.replace(/\\/g, '/')}`;

    return {
      id,
      name: path.basename(sourcePath),
      path: destPath,
      url: fileUrl,
      created_at: new Date().toISOString(),
    };
  }

  public getAll(): BackgroundImageInfo[] {
    const dir = this.getBackgroundsDir();
    if (!fs.existsSync(dir)) return [];

    const files = fs.readdirSync(dir);
    return files
      .filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
      .map((f) => {
        const full = path.join(dir, f);
        return {
          id: path.parse(f).name,
          name: f,
          path: full,
          url: `file://${full.replace(/\\/g, '/')}`,
          created_at: new Date().toISOString(),
        };
      });
  }

  public delete(id: string): boolean {
    const dir = this.getBackgroundsDir();
    if (!fs.existsSync(dir)) return false;

    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (path.parse(f).name === id || f === id) {
        fs.unlinkSync(path.join(dir, f));
        return true;
      }
    }
    return false;
  }
}

export default BackgroundService;
