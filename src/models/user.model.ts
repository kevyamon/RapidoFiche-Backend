import { Schema, model, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, UserRole } from '../constants/roles.constants';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export interface IUser {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  passwordHash?: string;
  googleId?: string;
  role: UserRole;
  primaryLevelId?: Types.ObjectId;
  status: UserStatus;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUserDocument>(
  {
    firstName: {
      type: String,
      required: [true, 'Le prénom est obligatoire'],
      trim: true,
      maxlength: 100,
    },
    lastName: {
      type: String,
      required: [true, 'Le nom est obligatoire'],
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'L’adresse email est obligatoire'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    passwordHash: {
      type: String,
      select: false,
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
      index: true,
    },
    role: {
      type: String,
      required: true,
      enum: Object.values(ROLES),
      default: ROLES.TEACHER,
      index: true,
    },
    primaryLevelId: {
      type: Schema.Types.ObjectId,
      ref: 'EducationLevel',
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['ACTIVE', 'SUSPENDED', 'DELETED'],
      default: 'ACTIVE',
      index: true,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        const obj = ret as unknown as Record<string, unknown>;
        obj.id = (obj._id as { toString(): string })?.toString();
        if (obj.primaryLevelId) {
          obj.primaryLevelId = (obj.primaryLevelId as { toString(): string }).toString();
        }
        delete obj._id;
        delete obj.__v;
        delete obj.passwordHash;
        return obj;
      },
    },
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash') || !this.passwordHash) {
    return next();
  }
  const saltRounds = 12;
  this.passwordHash = await bcrypt.hash(this.passwordHash, saltRounds);
  next();
});

userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.passwordHash) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export const UserModel = model<IUserDocument>('User', userSchema);
