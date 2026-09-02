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
    files: UploadFileInput[]
  ): Promise<IImportBatchDocument> {
    if (!files || files.length === 0) {
      throw new AppError(ERROR_CODES.INVALID_FILE, 'Aucun fichier fourni', 400);
    }

    const batchItems: IBatchItem[] = [];
    let processed = 0;
    let failed = 0;

    for (const file of files) {
      try {
        const asset = await StorageService.uploadPrivatePdf(file);
        const parsed = ImportParserService.parseFileName(file.originalName);

        let levelId: Types.ObjectId | undefined;
        let subjectId: Types.ObjectId | undefined;

        if (parsed.levelCode) {
          const levelDoc = await EducationLevelModel.findOne({ code: parsed.levelCode }).lean();
          if (levelDoc) {
            levelId = new Types.ObjectId(levelDoc._id.toString());
          }
        }

        if (parsed.subjectKeyword && levelId) {
          const subjectDoc = await SubjectModel.findOne({
            name: new RegExp(parsed.subjectKeyword, 'i'),
            levelIds: levelId,
          }).lean();
          if (subjectDoc) {
            subjectId = new Types.ObjectId(subjectDoc._id.toString());
          }
        }

        batchItems.push({
          fileName: asset.storageKey,
          originalName: file.originalName,
          status: 'PARSED',
          assetId: new Types.ObjectId(asset.id),
          parsedData: {
            levelCode: parsed.levelCode,
            levelId,
            subjectName: parsed.subjectKeyword,
            subjectId,
            week: parsed.week,
            topic: parsed.topic,
            title: parsed.suggestedTitle,
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

    return await ImportBatchModel.create({
      createdBy: new Types.ObjectId(adminId),
      status: 'REVIEW_REQUIRED',
      totalFiles: files.length,
      processedFiles: processed,
      failedFiles: failed,
      files: batchItems,
    });
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
      if (item.status === 'PARSED' && item.parsedData && item.assetId) {
        if (!item.parsedData.levelId || !item.parsedData.subjectId) {
          continue; // En attente d'assignation manuelle
        }

        const lesson = await LessonModel.create({
          title: item.parsedData.title || item.originalName,
          levelId: item.parsedData.levelId,
          subjectId: item.parsedData.subjectId,
          domainId: item.parsedData.domainId,
          week: item.parsedData.week,
          topic: item.parsedData.topic,
          fileAssetId: item.assetId,
          status: 'DRAFT', // Obligatoirement DRAFT (CDC Section 71)
          createdBy: new Types.ObjectId(adminId),
        });

        item.status = 'IMPORTED';
        item.lessonId = new Types.ObjectId(lesson.id);
        createdCount++;
      }
    }

    batch.status = 'COMPLETED';
    await batch.save();

    await AuditService.logAction(adminId, 'IMPORT_CONFIRMED', 'ImportBatch', batchId, {
      importedLessonsCount: createdCount,
    });

    return batch;
  }
}
