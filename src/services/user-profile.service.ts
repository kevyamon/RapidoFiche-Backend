import { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserModel, IUserDocument } from '../models/user.model';
import { EducationLevelModel } from '../models/education-level.model';
import { UpdateProfileInput } from '../schemas/auth.schema';
import { AppError } from '../utils/app-error.utils';
import { ERROR_CODES } from '../constants/error-codes.constants';
import { logger } from '../utils/logger.utils';

export class UserProfileService {
  public static async updateProfile(
    userId: string,
    input: UpdateProfileInput
  ): Promise<IUserDocument> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new AppError(
        ERROR_CODES.ACCOUNT_NOT_FOUND,
        'Utilisateur introuvable',
        404
      );
    }

    if (input.email && input.email !== user.email) {
      const existingUser = await UserModel.findOne({
        email: input.email,
        _id: { $ne: user._id },
      }).lean();

      if (existingUser) {
        throw new AppError(
          ERROR_CODES.CONFLICT,
          'Cette adresse email est déjà utilisée par un autre compte',
          409
        );
      }
      user.email = input.email;
    }

    if (input.firstName) user.firstName = input.firstName;
    if (input.lastName) user.lastName = input.lastName;
    if (input.phone !== undefined) user.phone = input.phone || undefined;
    if (input.avatarUrl !== undefined) user.avatarUrl = input.avatarUrl || undefined;

    if (input.primaryLevelId) {
      const isObjectId =
        Types.ObjectId.isValid(input.primaryLevelId) &&
        input.primaryLevelId.length === 24;

      const level = await EducationLevelModel.findOne({
        $or: [
          ...(isObjectId ? [{ _id: new Types.ObjectId(input.primaryLevelId) }] : []),
          { code: input.primaryLevelId.toUpperCase() },
        ],
      }).lean();

      if (!level || !level.active) {
        throw new AppError(
          ERROR_CODES.RESOURCE_NOT_FOUND,
          'Le niveau pédagogique sélectionné n’existe pas',
          404
        );
      }
      user.primaryLevelId = level._id;
    }

    await user.save();
    await user.populate('primaryLevelId', 'code label');

    logger.info('USER', `Profil mis à jour pour : ${user.email}`);
    return user;
  }

  public static async changePassword(
    userId: string,
    currentPass: string,
    newPass: string
  ): Promise<void> {
    const user = await UserModel.findById(userId).select('+passwordHash');
    if (!user) {
      throw new AppError(
        ERROR_CODES.ACCOUNT_NOT_FOUND,
        'Utilisateur introuvable',
        404
      );
    }

    const isMatch = await user.comparePassword(currentPass);
    if (!isMatch) {
      throw new AppError(
        ERROR_CODES.INVALID_CREDENTIALS,
        'Le mot de passe actuel est incorrect',
        400
      );
    }

    user.passwordHash = await bcrypt.hash(newPass, 12);
    await user.save();
    logger.info('AUTH', `Mot de passe modifié pour l'utilisateur : ${user.email}`);
  }
}
