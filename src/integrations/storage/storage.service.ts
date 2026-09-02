import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { env } from '../../config/env.config';
import { AssetModel, IAssetDocument } from '../../models/asset.model';
import { AppError } from '../../utils/app-error.utils';
import { ERROR_CODES } from '../../constants/errors.constants';
import { logger } from '../../utils/logger.utils';

if (env.STORAGE_PROVIDER === 'cloudinary' && env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export interface UploadFileInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

export class StorageService {
  public static async uploadPrivatePdf(input: UploadFileInput): Promise<IAssetDocument> {
    if (input.mimeType !== 'application/pdf') {
      throw new AppError(
        ERROR_CODES.INVALID_FILE,
        'Seuls les documents au format PDF sont acceptés',
        422
      );
    }

    const checksum = crypto.createHash('sha256').update(input.buffer).digest('hex');
    const randomSuffix = crypto.randomBytes(8).toString('hex');
    const safeBaseName = path.parse(input.originalName).name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const storageKey = `lessons/${Date.now()}_${safeBaseName}_${randomSuffix}.pdf`;

    if (env.STORAGE_PROVIDER === 'cloudinary' && env.CLOUDINARY_CLOUD_NAME) {
      return this.uploadToCloudinary(input, storageKey, checksum);
    }

    return this.uploadToLocalDisk(input, storageKey, checksum);
  }

  private static async uploadToLocalDisk(
    input: UploadFileInput,
    storageKey: string,
    checksum: string
  ): Promise<IAssetDocument> {
    const fullPath = path.join(process.cwd(), env.STORAGE_LOCAL_PATH, storageKey);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await fs.promises.writeFile(fullPath, input.buffer);

    logger.info('STORAGE', `Fichier PDF privé sauvegardé localement : ${storageKey}`, {
      size: input.sizeBytes,
    });

    return await AssetModel.create({
      storageProvider: 'local',
      storageKey,
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      checksum,
      visibility: 'PRIVATE',
    });
  }

  private static async uploadToCloudinary(
    input: UploadFileInput,
    storageKey: string,
    checksum: string
  ): Promise<IAssetDocument> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          public_id: storageKey,
          type: 'authenticated', // Accès privé sécurisé
          tags: ['rapidofiche_lesson'],
        },
        async (error: unknown, result?: UploadApiResponse) => {
          if (error || !result) {
            logger.error('STORAGE', 'Échec de téléversement Cloudinary', { error });
            return reject(
              new AppError(
                ERROR_CODES.INTERNAL_ERROR,
                'Échec du stockage distant du fichier',
                500
              )
            );
          }

          const asset = await AssetModel.create({
            storageProvider: 'cloudinary',
            storageKey: result.public_id,
            originalName: input.originalName,
            mimeType: input.mimeType,
            sizeBytes: input.sizeBytes,
            checksum,
            visibility: 'PRIVATE',
          });

          resolve(asset);
        }
      );

      uploadStream.end(input.buffer);
    });
  }

  public static async getLocalFilePath(storageKey: string): Promise<string> {
    const fullPath = path.join(process.cwd(), env.STORAGE_LOCAL_PATH, storageKey);
    if (!fs.existsSync(fullPath)) {
      throw new AppError(
        ERROR_CODES.RESOURCE_NOT_FOUND,
        'Le fichier demandé est introuvable sur le serveur de stockage',
        404
      );
    }
    return fullPath;
  }
}
