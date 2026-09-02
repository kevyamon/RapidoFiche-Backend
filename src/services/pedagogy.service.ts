import { Types } from 'mongoose';
import { CycleModel, ICycleDocument } from '../models/cycle.model';
import {
  EducationLevelModel,
  IEducationLevelDocument,
} from '../models/education-level.model';
import { SubjectModel, ISubjectDocument } from '../models/subject.model';
import {
  SubjectDomainModel,
  ISubjectDomainDocument,
} from '../models/subject-domain.model';
import { UserModel } from '../models/user.model';
import { LessonModel } from '../models/lesson.model';
import { AppError } from '../utils/app-error.utils';
import { ERROR_CODES } from '../constants/errors.constants';

export class PedagogyService {
  public static async getCycles(): Promise<ICycleDocument[]> {
    return CycleModel.find({ active: true }).sort({ order: 1 }).lean();
  }

  public static async getLevels(cycleId?: string): Promise<IEducationLevelDocument[]> {
    const filter: Record<string, unknown> = { active: true };
    if (cycleId) {
      filter.cycleId = new Types.ObjectId(cycleId);
    }
    return EducationLevelModel.find(filter).sort({ order: 1 }).lean();
  }

  public static async getLevelById(id: string): Promise<IEducationLevelDocument> {
    const level = await EducationLevelModel.findById(id).lean();
    if (!level) {
      throw new AppError(ERROR_CODES.RESOURCE_NOT_FOUND, 'Niveau scolaire introuvable', 404);
    }
    return level;
  }

  public static async getSubjects(levelId?: string): Promise<ISubjectDocument[]> {
    const filter: Record<string, unknown> = { active: true };
    if (levelId) {
      filter.levelIds = new Types.ObjectId(levelId);
    }
    return SubjectModel.find(filter).sort({ order: 1 }).lean();
  }

  public static async getTeacherSubjects(
    teacherPrimaryLevelId: string
  ): Promise<ISubjectDocument[]> {
    return SubjectModel.find({
      levelIds: new Types.ObjectId(teacherPrimaryLevelId),
      active: true,
    })
      .sort({ order: 1 })
      .lean();
  }

  public static async getDomains(
    subjectId: string,
    levelId?: string
  ): Promise<ISubjectDomainDocument[]> {
    const filter: Record<string, unknown> = {
      subjectId: new Types.ObjectId(subjectId),
      active: true,
    };
    if (levelId) {
      filter.$or = [
        { levelIds: { $exists: false } },
        { levelIds: { $size: 0 } },
        { levelIds: new Types.ObjectId(levelId) },
      ];
    }
    return SubjectDomainModel.find(filter).sort({ order: 1 }).lean();
  }

  public static async deleteLevel(id: string): Promise<void> {
    const levelObjectId = new Types.ObjectId(id);

    const userCount = await UserModel.countDocuments({ primaryLevelId: levelObjectId });
    if (userCount > 0) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        `Impossible de supprimer ce niveau : ${userCount} enseignant(s) y sont rattachés`,
        409
      );
    }

    const lessonCount = await LessonModel.countDocuments({ levelId: levelObjectId });
    if (lessonCount > 0) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        `Impossible de supprimer ce niveau : ${lessonCount} fiche(s) y sont rattachées`,
        409
      );
    }

    const deleted = await EducationLevelModel.findByIdAndDelete(id);
    if (!deleted) {
      throw new AppError(ERROR_CODES.RESOURCE_NOT_FOUND, 'Niveau introuvable', 404);
    }
  }
}
