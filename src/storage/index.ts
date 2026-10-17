import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';

export interface StorageDriver {
  saveFile(file: Express.Multer.File): Promise<{ storageKey: string }>;
  deleteFile(storageKey: string): Promise<void>;
  getFilePath(storageKey: string): string;
}

export class LocalStorageDriver implements StorageDriver {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.resolve(process.cwd(), env.UPLOAD_LOCAL_DIR);
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  public async saveFile(file: Express.Multer.File): Promise<{ storageKey: string }> {
    const ext = path.extname(file.originalname);
    const storageKey = `${uuidv4()}${ext}`;
    const destination = path.join(this.uploadDir, storageKey);

    await fs.promises.writeFile(destination, file.buffer);

    return { storageKey };
  }

  public async deleteFile(storageKey: string): Promise<void> {
    const filePath = path.join(this.uploadDir, storageKey);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  public getFilePath(storageKey: string): string {
    return path.join(this.uploadDir, storageKey);
  }
}

export const storage: StorageDriver = new LocalStorageDriver();

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_ATTACHMENT_COUNT = 5;
