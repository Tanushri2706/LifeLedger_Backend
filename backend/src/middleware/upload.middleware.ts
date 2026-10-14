import multer, { FileFilterCallback } from 'multer';
import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
]);

const ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp']);

const fileFilter = (_req: Request, file: Express.Multer.File, callback: FileFilterCallback): void => {
  const mimeType = file.mimetype.toLowerCase();
  const filenameParts = file.originalname.toLowerCase().split('.');
  const extension = filenameParts.length > 1 ? filenameParts.pop() : '';

  if (!ALLOWED_MIME_TYPES.has(mimeType) || !extension || !ALLOWED_EXTENSIONS.has(extension)) {
    return callback(
      new Error('Unsupported file type. Allowed formats: PDF, JPEG, JPG, PNG, WEBP.')
    );
  }

  callback(null, true);
};

const multerInstance = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1
  },
  fileFilter
});

export const uploadSingle = (fieldName: string = 'file') => {
  const uploadHandler = multerInstance.single(fieldName);

  return (req: Request, res: Response, next: NextFunction): void => {
    uploadHandler(req, res, (err: unknown): void => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            sendError(res, 413, 'File size exceeds maximum allowable limit of 10MB', {});
            return;
          }
          if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            sendError(res, 400, `Unexpected field name. Please upload using field name "${fieldName}"`, {});
            return;
          }
          sendError(res, 400, `File upload error: ${err.message}`, {});
          return;
        }

        if (err instanceof Error) {
          sendError(res, 400, err.message, {});
          return;
        }

        sendError(res, 400, 'Error processing file upload', {});
        return;
      }

      next();
    });
  };
};

const imageOnlyFilter = (_req: Request, file: Express.Multer.File, callback: FileFilterCallback): void => {
  const mimeType = file.mimetype.toLowerCase();
  const filenameParts = file.originalname.toLowerCase().split('.');
  const extension = filenameParts.length > 1 ? filenameParts.pop() : '';

  const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
  const ALLOWED_IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp']);

  if (!ALLOWED_IMAGE_MIMES.has(mimeType) || !extension || !ALLOWED_IMAGE_EXTS.has(extension)) {
    return callback(
      new Error('Unsupported file type. Only JPEG, JPG, PNG, and WEBP images are allowed.')
    );
  }

  callback(null, true);
};

const avatarMulter = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB for avatars
    files: 1
  },
  fileFilter: imageOnlyFilter
});

export const uploadAvatarSingle = () => {
  const uploadHandler = avatarMulter.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'file', maxCount: 1 }
  ]);

  return (req: Request, res: Response, next: NextFunction): void => {
    uploadHandler(req, res, (err: unknown): void => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            sendError(res, 413, 'File size exceeds maximum allowable limit of 5MB', {});
            return;
          }
          sendError(res, 400, `File upload error: ${err.message}`, {});
          return;
        }

        if (err instanceof Error) {
          sendError(res, 400, err.message, {});
          return;
        }

        sendError(res, 400, 'Error processing file upload', {});
        return;
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      if (files) {
        if (files.avatar && files.avatar[0]) {
          req.file = files.avatar[0];
        } else if (files.profilePhoto && files.profilePhoto[0]) {
          req.file = files.profilePhoto[0];
        } else if (files.file && files.file[0]) {
          req.file = files.file[0];
        }
      }

      next();
    });
  };
};

