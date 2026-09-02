import { Types } from 'mongoose';
import { LessonModel, ILessonDocument } from '../models/lesson.model';
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
    if (input.levelId) lesson.levelId = new Types.ObjectId(input.levelId);
    if (input.subjectId) lesson.subjectId = new Types.ObjectId(input.subjectId);
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
