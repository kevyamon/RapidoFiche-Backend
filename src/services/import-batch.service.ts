import { Types } from 'mongoose';
import { ImportBatchModel, IImportBatchDocument, IBatchItem } from '../models/import-batch.model';
import { EducationLevelModel } from '../models/education-level.model';
import { SubjectModel } from '../models/subject.model';
import { LessonModel } from '../models/lesson.model';
import { StorageService, UploadFileInput } from '../integrations/storage/storage.service';
import { ImportParserService } from './import-parser.service';
import { AuditService } from './audit.service';
import { AppError } from '../utils/app-error.utils';
import { ERROR_CODES } from '../constants/errors.constants';

export class ImportBatchService {
  public static async processUploadedFiles(
    adminId: string,
    files: UploadFileInput[],
    options?: { primaryLevelId?: string; subjectId?: string }
  ): Promise<IImportBatchDocument> {
    if (!files || files.length === 0) {
      throw new AppError(ERROR_CODES.INVALID_FILE, 'Aucun fichier fourni', 400);
    }

    const batchItems: IBatchItem[] = [];
    let processed = 0;
    let failed = 0;

    let explicitLevelDoc: { _id: Types.ObjectId; code: string } | null = null;
    let explicitSubjectDoc: { _id: Types.ObjectId; name: string } | null = null;

    if (options?.primaryLevelId) {
      const isOid = Types.ObjectId.isValid(options.primaryLevelId) && options.primaryLevelId.length === 24;
      explicitLevelDoc = await EducationLevelModel.findOne({
        $or: [
          ...(isOid ? [{ _id: new Types.ObjectId(options.primaryLevelId) }] : []),
          { code: options.primaryLevelId.toUpperCase() },
        ],
      }).lean();
    }
    if (options?.subjectId) {
      const isOid = Types.ObjectId.isValid(options.subjectId) && options.subjectId.length === 24;
      explicitSubjectDoc = await SubjectModel.findOne({
        $or: [
          ...(isOid ? [{ _id: new Types.ObjectId(options.subjectId) }] : []),
          { name: new RegExp(options.subjectId, 'i') },
        ],
      }).lean();
    }

    let createdLessons = 0;

    for (const file of files) {
      try {
        const asset = await StorageService.uploadPrivatePdf(file);
        const parsed = ImportParserService.parseFileName(file.originalName);

        let levelId = explicitLevelDoc?._id;
        let levelCode = explicitLevelDoc?.code || parsed.levelCode;

        if (!levelId && parsed.levelCode) {
          const levelDoc = await EducationLevelModel.findOne({ code: parsed.levelCode }).lean();
          if (levelDoc) {
            levelId = levelDoc._id;
            levelCode = levelDoc.code;
          }
        }

        if (!levelId) {
          const defLevel = await EducationLevelModel.findOne().sort({ order: 1 }).lean();
          if (defLevel) {
            levelId = defLevel._id;
            levelCode = defLevel.code;
          }
        }

        let subjectId = explicitSubjectDoc?._id;
        let subjectName = explicitSubjectDoc?.name || parsed.subjectKeyword;

        if (!subjectId && parsed.subjectKeyword && levelId) {
          const subjectDoc = await SubjectModel.findOne({
            name: new RegExp(parsed.subjectKeyword, 'i'),
            levelIds: levelId,
          }).lean();
          if (subjectDoc) {
            subjectId = subjectDoc._id;
            subjectName = subjectDoc.name;
          }
        }

        if (!subjectId && levelId) {
          const fallbackSub = await SubjectModel.findOne({ levelIds: levelId }).lean();
          if (fallbackSub) {
            subjectId = fallbackSub._id;
            subjectName = fallbackSub.name;
          }
        }

        const title =
          parsed.suggestedTitle ||
          file.originalName.replace(/\.pdf$/i, '').trim() ||
          `${subjectName || 'Fiche'} - ${levelCode || ''}`.trim();

        let lessonId: Types.ObjectId | undefined;
        if (levelId && subjectId) {
          const lesson = await LessonModel.create({
            title,
            levelId,
            subjectId,
            week: parsed.week || 1,
            topic: parsed.topic || title,
            fileAssetId: new Types.ObjectId(asset.id),
            status: 'DRAFT',
            createdBy: new Types.ObjectId(adminId),
          });
          lessonId = new Types.ObjectId(lesson.id);
          createdLessons++;
        }

        batchItems.push({
          fileName: asset.storageKey,
          originalName: file.originalName,
          status: lessonId ? 'IMPORTED' : 'PARSED',
          assetId: new Types.ObjectId(asset.id),
          lessonId,
          parsedData: {
            levelCode: levelCode as any,
            levelId,
            subjectName,
            subjectId,
            week: parsed.week || 1,
            topic: parsed.topic || title,
            title,
          },
        });
        processed++;
      } catch (err) {
        batchItems.push({
          fileName: file.originalName,
          originalName: file.originalName,
          status: 'ERROR',
          errorMessage: err instanceof Error ? err.message : 'Erreur de traitement',
        });
        failed++;
      }
    }

    const finalStatus = createdLessons > 0 ? 'COMPLETED' : (failed === files.length ? 'FAILED' : 'REVIEW_REQUIRED');

    return await ImportBatchModel.create({
      createdBy: new Types.ObjectId(adminId),
      status: finalStatus,
      totalFiles: files.length,
      processedFiles: processed,
      failedFiles: failed,
      files: batchItems,
    });
  }

  private static async createLessonFromItem(
    item: IBatchItem,
    adminId: Types.ObjectId | string
  ): Promise<Types.ObjectId | null> {
    if (item.status !== 'PARSED' || !item.assetId) return null;

    let levelId = item.parsedData?.levelId;
    let subjectId = item.parsedData?.subjectId;

    if (!levelId) {
      const defLevel = await EducationLevelModel.findOne().sort({ order: 1 }).lean();
      if (defLevel) levelId = defLevel._id;
    }
    if (!subjectId && levelId) {
      const defSub = await SubjectModel.findOne({ levelIds: levelId }).lean();
      if (defSub) subjectId = defSub._id;
    }

    if (!levelId || !subjectId) return null;

    const lesson = await LessonModel.create({
      title: item.parsedData?.title || item.originalName.replace(/\.pdf$/i, ''),
      levelId,
      subjectId,
      domainId: item.parsedData?.domainId,
      week: item.parsedData?.week || 1,
      topic: item.parsedData?.topic || item.originalName,
      fileAssetId: item.assetId,
      status: 'DRAFT',
      createdBy: new Types.ObjectId(adminId),
    });

    item.status = 'IMPORTED';
    item.lessonId = new Types.ObjectId(lesson.id);
    return item.lessonId;
  }

  public static async getBatches(): Promise<IImportBatchDocument[]> {
    const batches = await ImportBatchModel.find().sort({ createdAt: -1 }).limit(20);

    for (const batch of batches) {
      if (batch.status === 'REVIEW_REQUIRED') {
        let changed = false;
        for (const item of batch.files) {
          const lessonId = await this.createLessonFromItem(item, batch.createdBy);
          if (lessonId) changed = true;
        }
        if (changed) {
          batch.status = 'COMPLETED';
          await batch.save();
        }
      }
    }

    return batches as unknown as IImportBatchDocument[];
  }

  public static async getBatchById(batchId: string): Promise<IImportBatchDocument> {
    const batch = await ImportBatchModel.findById(batchId)
      .populate('files.parsedData.levelId', 'code label')
      .populate('files.parsedData.subjectId', 'name icon')
      .lean();

    if (!batch) {
      throw new AppError(ERROR_CODES.RESOURCE_NOT_FOUND, 'Lot d’importation introuvable', 404);
    }

    return batch as unknown as IImportBatchDocument;
  }

  public static async confirmBatch(
    adminId: string,
    batchId: string
  ): Promise<IImportBatchDocument> {
    const batch = await ImportBatchModel.findById(batchId);
    if (!batch) {
      throw new AppError(ERROR_CODES.RESOURCE_NOT_FOUND, 'Lot d’importation introuvable', 404);
    }

    let createdCount = 0;
    for (const item of batch.files) {
      const lessonId = await this.createLessonFromItem(item, adminId);
      if (lessonId) createdCount++;
    }

    batch.status = 'COMPLETED';
    await batch.save();

    await AuditService.logAction(adminId, 'IMPORT_CONFIRMED', 'ImportBatch', batchId, {
      importedLessonsCount: createdCount,
    });

    return batch;
  }
}
