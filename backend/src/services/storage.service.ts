import crypto from 'crypto';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { config } from '../config';
import { IStorageUploadResult, IStorageOptions } from '../types';
import { AppError } from '../utils';

export interface IStorageService {
  uploadFile(file: Express.Multer.File, userId: string, folder?: string): Promise<IStorageUploadResult>;
  deleteFile(publicId: string, options?: IStorageOptions): Promise<boolean>;
  getSignedDownloadUrl(publicId: string, originalFilename?: string, options?: IStorageOptions): Promise<string>;
  getFileBuffer(publicId: string, mimeType?: string, options?: IStorageOptions): Promise<Buffer>;
}

export class CloudinaryStorageService implements IStorageService {
  private isConfigured: boolean;

  constructor() {
    this.isConfigured = !!(
      config.cloudinaryCloudName &&
      config.cloudinaryApiKey &&
      config.cloudinaryApiSecret
    );

    if (this.isConfigured) {
      cloudinary.config({
        cloud_name: config.cloudinaryCloudName,
        api_key: config.cloudinaryApiKey,
        api_secret: config.cloudinaryApiSecret,
        secure: true
      });
    }
  }

  public async uploadFile(
    file: Express.Multer.File,
    userId: string,
    folder: string = 'lifeledger/vault'
  ): Promise<IStorageUploadResult> {
    const isPdf = file.mimetype === 'application/pdf';
    const resourceType: 'raw' | 'image' = isPdf ? 'raw' : 'image';
    const userFolder = folder && folder !== 'lifeledger/vault'
      ? folder
      : `lifeledger/vault/${userId}`;
    const cleanFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const publicId = isPdf
      ? `${Date.now()}_${cleanFilename}`
      : `${Date.now()}_${pathBasename(cleanFilename)}`;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: userFolder,
          resource_type: resourceType,
          type: 'authenticated',
          public_id: publicId
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error || !result) {
            const message = error?.message || 'Cloudinary upload returned empty response';
            return reject(new AppError(`Storage upload failed: ${message}`, 502, error));
          }

          let thumbnailUrl: string | undefined = undefined;
          if (!isPdf) {
            thumbnailUrl = cloudinary.url(result.public_id, {
              resource_type: 'image',
              type: 'authenticated',
              sign_url: true,
              width: 300,
              height: 300,
              crop: 'fill',
              secure: true
            });
          }

          resolve({
            fileUrl: result.secure_url,
            publicId: result.public_id,
            thumbnailUrl,
            fileSize: result.bytes || file.size,
            mimeType: file.mimetype,
            fileType: isPdf ? 'pdf' : (result.format || file.mimetype),
            originalFilename: file.originalname,
            resourceType: result.resource_type || resourceType,
            deliveryType: result.type || 'authenticated',
            format: result.format || (isPdf ? 'pdf' : undefined)
          });
        }
      );

      uploadStream.end(file.buffer);
    });
  }

  public async deleteFile(publicId: string, options?: IStorageOptions): Promise<boolean> {
    const isRaw = options?.resourceType === 'raw' || publicId.endsWith('.pdf') || publicId.includes('.pdf') || publicId.includes('raw');
    const primaryType: 'raw' | 'image' = (options?.resourceType as 'raw' | 'image') || (isRaw ? 'raw' : 'image');
    const primaryDelivery = options?.deliveryType || 'authenticated';

    const attempts: Array<{ resource_type: 'raw' | 'image'; type: string }> = [
      { resource_type: primaryType, type: primaryDelivery },
      { resource_type: primaryType === 'raw' ? 'image' : 'raw', type: primaryDelivery },
      { resource_type: primaryType, type: primaryDelivery === 'authenticated' ? 'upload' : 'authenticated' },
      { resource_type: primaryType === 'raw' ? 'image' : 'raw', type: primaryDelivery === 'authenticated' ? 'upload' : 'authenticated' }
    ];

    for (const attempt of attempts) {
      try {
        const result = await cloudinary.uploader.destroy(publicId, {
          resource_type: attempt.resource_type,
          type: attempt.type
        });
        if (result.result === 'ok') {
          return true;
        }
      } catch (err) {
        // Continue to fallback attempt
      }
    }

    return false;
  }

  public async getSignedDownloadUrl(
    publicId: string,
    _originalFilename?: string,
    options?: IStorageOptions
  ): Promise<string> {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour expiration
    const isRaw = options?.resourceType === 'raw' || publicId.endsWith('.pdf') || publicId.includes('.pdf') || publicId.includes('raw');
    const resourceType = (options?.resourceType as 'raw' | 'image') || (isRaw ? 'raw' : 'image');
    const deliveryType = options?.deliveryType || 'authenticated';
    const rawFormat = options?.format || (isRaw ? 'pdf' : (publicId.includes('.') ? (publicId.split('.').pop() || '') : 'png'));
    const format = (rawFormat || '').replace(/^\./, '').toLowerCase();

    return cloudinary.utils.private_download_url(publicId, format, {
      resource_type: resourceType,
      type: deliveryType,
      expires_at: expiresAt,
      attachment: true
    });
  }

  public async getFileBuffer(publicId: string, _mimeType?: string, options?: IStorageOptions): Promise<Buffer> {
    const signedUrl = await this.getSignedDownloadUrl(publicId, undefined, options);
    const res = await fetch(signedUrl);
    if (!res.ok) {
      throw new Error(`Failed to download file from Cloudinary: ${res.statusText}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

export class MockStorageService implements IStorageService {
  private files: Map<string, { buffer: Buffer; mimeType: string; filename: string; userId: string; size: number }> =
    new Map();

  public async uploadFile(
    file: Express.Multer.File,
    userId: string,
    folder: string = 'lifeledger/vault'
  ): Promise<IStorageUploadResult> {
    const fileId = crypto.randomUUID();
    const basePath = folder && folder !== 'lifeledger/vault'
      ? folder.replace(/^lifeledger\//, '')
      : `vault/${userId}`;
    const publicId = `${basePath}/${fileId}`;
    const cleanFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const isPdf = file.mimetype === 'application/pdf';

    this.files.set(publicId, {
      buffer: file.buffer,
      mimeType: file.mimetype,
      filename: cleanFilename,
      userId,
      size: file.size
    });

    const fileUrl = `https://storage.lifeledger.local/${publicId}`;
    const thumbnailUrl = isPdf ? undefined : `https://storage.lifeledger.local/thumb/${publicId}`;

    return {
      fileUrl,
      publicId,
      thumbnailUrl,
      fileSize: file.size,
      mimeType: file.mimetype,
      fileType: isPdf ? 'pdf' : file.mimetype,
      originalFilename: file.originalname,
      resourceType: isPdf ? 'raw' : 'image',
      deliveryType: 'authenticated',
      format: isPdf ? 'pdf' : 'png'
    };
  }

  public async deleteFile(publicId: string, _options?: IStorageOptions): Promise<boolean> {
    return this.files.delete(publicId);
  }

  public async getSignedDownloadUrl(
    publicId: string,
    originalFilename?: string,
    _options?: IStorageOptions
  ): Promise<string> {
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    const token = crypto
      .createHmac('sha256', config.jwtAccessSecret)
      .update(`${publicId}:${expiry}`)
      .digest('hex');

    const downloadFilename = originalFilename ? encodeURIComponent(originalFilename) : 'document';
    return `https://storage.lifeledger.local/download/${publicId}?expires=${expiry}&token=${token}&filename=${downloadFilename}`;
  }

  public async getFileBuffer(publicId: string, _mimeType?: string, _options?: IStorageOptions): Promise<Buffer> {
    const fileEntry = this.files.get(publicId);
    if (!fileEntry) {
      return Buffer.from('Mock PDF Content for Medical Report');
    }
    return fileEntry.buffer;
  }
}

const pathBasename = (filename: string): string => {
  const parts = filename.split('.');
  return parts.slice(0, -1).join('.') || filename;
};

export const createStorageService = (): IStorageService => {
  const isCloudinaryConfigured = !!(
    config.cloudinaryCloudName &&
    config.cloudinaryApiKey &&
    config.cloudinaryApiSecret
  );

  return isCloudinaryConfigured ? new CloudinaryStorageService() : new MockStorageService();
};

export const storageService: IStorageService = createStorageService();


