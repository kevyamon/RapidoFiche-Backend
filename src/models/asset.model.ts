import { Schema, model, Document } from 'mongoose';

export type AssetVisibility = 'PRIVATE' | 'PUBLIC';

export interface IAsset {
  storageProvider: 'cloudinary' | 'local';
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string;
  visibility: AssetVisibility;
  publicUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAssetDocument extends IAsset, Document {}

const assetSchema = new Schema<IAssetDocument>(
  {
    storageProvider: {
      type: String,
      required: true,
      enum: ['cloudinary', 'local'],
      default: 'local',
    },
    storageKey: {
      type: String,
      required: [true, 'La clé de stockage est obligatoire'],
      trim: true,
    },
    originalName: {
      type: String,
      required: [true, 'Le nom original du fichier est obligatoire'],
      trim: true,
    },
    mimeType: {
      type: String,
      required: [true, 'Le type MIME est obligatoire'],
      trim: true,
    },
    sizeBytes: {
      type: Number,
      required: [true, 'La taille du fichier en octets est obligatoire'],
      min: 0,
    },
    checksum: {
      type: String,
      trim: true,
    },
    visibility: {
      type: String,
      required: true,
      enum: ['PRIVATE', 'PUBLIC'],
      default: 'PRIVATE',
      index: true,
    },
    publicUrl: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        const obj = ret as unknown as Record<string, unknown>;
        obj.id = (obj._id as { toString(): string })?.toString();
        delete obj._id;
        delete obj.__v;
        return obj;
      },
    },
  }
);

export const AssetModel = model<IAssetDocument>('Asset', assetSchema);
