import { Types } from 'mongoose';
import { LessonModel, ILessonDocument } from '../models/lesson.model';
import { EducationLevelModel } from '../models/education-level.model';
import { SubjectModel } from '../models/subject.model';
import { CreateLessonInput, UpdateLessonInput } from '../schemas/lesson.schema';
import { AuditService } from './audit.service';
import { AppError } from '../utils/app-error.utils';
import { ERROR_CODES } from '../constants/errors.constants';

export class AdminLessonService {
  public static async createLesson(
    adminId: string,
    input: CreateLessonInput
  ): Promise<ILessonDocument> {
    const lesson = await LessonModel.create({
      ...input,
      levelId: new Types.ObjectId(input.levelId),
      subjectId: new Types.ObjectId(input.subjectId),
      domainId: input.domainId ? new Types.ObjectId(input.domainId) : undefined,
      fileAssetId: new Types.ObjectId(input.fileAssetId),
      thumbnailAssetId: input.thumbnailAssetId
        ? new Types.ObjectId(input.thumbnailAssetId)
        : undefined,
      createdBy: new Types.ObjectId(adminId),
    });

    await AuditService.logAction(adminId, 'LESSON_CREATED', 'Lesson', lesson.id, {
      title: lesson.title,
      levelId: input.levelId,
    });

    return lesson;
  }

  public static async updateLesson(
    adminId: string,
    lessonId: string,
    input: UpdateLessonInput
  ): Promise<ILessonDocument> {
    const lesson = await LessonModel.findById(lessonId);
    if (!lesson) {
      throw new AppError(ERROR_CODES.LESSON_NOT_FOUND, 'Fiche introuvable', 404);
    }

    if (input.title) lesson.title = input.title;

    if (input.levelId) {
      const isOid = Types.ObjectId.isValid(input.levelId) && input.levelId.length === 24;
      const levelDoc = await EducationLevelModel.findOne({
        $or: [
          ...(isOid ? [{ _id: new Types.ObjectId(input.levelId) }] : []),
          { code: input.levelId.toUpperCase() },
        ],
      }).lean();
      if (levelDoc) {
        lesson.levelId = levelDoc._id;
      }
    }

    if (input.subjectId) {
      const isOid = Types.ObjectId.isValid(input.subjectId) && input.subjectId.length === 24;
      const subjectDoc = await SubjectModel.findOne({
        $or: [
          ...(isOid ? [{ _id: new Types.ObjectId(input.subjectId) }] : []),
          { name: new RegExp(input.subjectId, 'i') },
        ],
      }).lean();
      if (subjectDoc) {
        lesson.subjectId = subjectDoc._id;
      }
    }
    if (input.domainId !== undefined) {
      lesson.domainId = input.domainId ? new Types.ObjectId(input.domainId) : undefined;
    }
    if (input.week !== undefined) lesson.week = input.week ?? undefined;
    if (input.term !== undefined) lesson.term = input.term ?? undefined;
    if (input.periodLabel !== undefined) lesson.periodLabel = input.periodLabel ?? undefined;
    if (input.topic !== undefined) lesson.topic = input.topic ?? undefined;
    if (input.lessonType) lesson.lessonType = input.lessonType;
    if (input.schoolYear !== undefined) lesson.schoolYear = input.schoolYear ?? undefined;
    if (input.description !== undefined) lesson.description = input.description ?? undefined;
    if (input.status) lesson.status = input.status;
    if (input.sourceType) lesson.sourceType = input.sourceType;
    if (input.rightsStatus) lesson.rightsStatus = input.rightsStatus;
    if (input.order !== undefined) lesson.order = input.order;

    lesson.updatedBy = new Types.ObjectId(adminId);
    await lesson.save();

    return lesson;
  }

  public static async publishLesson(
    adminId: string,
    lessonId: string
  ): Promise<ILessonDocument> {
    const lesson = await LessonModel.findById(lessonId);
    if (!lesson) {
      throw new AppError(ERROR_CODES.LESSON_NOT_FOUND, 'Fiche introuvable', 404);
    }

    lesson.status = 'PUBLISHED';
    lesson.updatedBy = new Types.ObjectId(adminId);
    await lesson.save();

    await AuditService.logAction(adminId, 'LESSON_PUBLISHED', 'Lesson', lessonId, {
      title: lesson.title,
    });

    return lesson;
  }

  public static async unpublishLesson(
    adminId: string,
    lessonId: string
  ): Promise<ILessonDocument> {
    const lesson = await LessonModel.findById(lessonId);
    if (!lesson) {
      throw new AppError(ERROR_CODES.LESSON_NOT_FOUND, 'Fiche introuvable', 404);
    }

    lesson.status = 'DRAFT';
    lesson.updatedBy = new Types.ObjectId(adminId);
    await lesson.save();

    return lesson;
  }

  public static async archiveLesson(
    adminId: string,
    lessonId: string
  ): Promise<ILessonDocument> {
    const lesson = await LessonModel.findById(lessonId);
    if (!lesson) {
      throw new AppError(ERROR_CODES.LESSON_NOT_FOUND, 'Fiche introuvable', 404);
    }

    lesson.status = 'ARCHIVED';
    lesson.updatedBy = new Types.ObjectId(adminId);
    await lesson.save();

    await AuditService.logAction(adminId, 'LESSON_ARCHIVED', 'Lesson', lessonId);

    return lesson;
  }
}
