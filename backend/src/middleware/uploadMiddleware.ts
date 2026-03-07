import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const EXCEL_EXT = ['.xlsx', '.xls'];

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!EXCEL_EXT.includes(ext)) {
    return cb(new Error('Seuls les fichiers .xlsx et .xls sont acceptés'));
  }
  cb(null, true);
};

export const uploadExcel = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const EMAIL_ATTACHMENT_EXT = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.jpg', '.jpeg', '.png', '.gif', '.zip'];

const emailAttachmentFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!EMAIL_ATTACHMENT_EXT.includes(ext)) {
    return cb(new Error(`Type de fichier non autorisé. Autorisés: ${EMAIL_ATTACHMENT_EXT.join(', ')}`));
  }
  cb(null, true);
};

const memoryStorage = multer.memoryStorage();

export const uploadEmailAttachments = multer({
  storage: memoryStorage,
  fileFilter: emailAttachmentFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 }, // 10 MB par fichier, max 5 fichiers
});
