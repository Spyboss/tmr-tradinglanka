import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcrypt';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  DELETED = 'deleted' // New role for deleted accounts
}

export interface IUser extends Document {
  email: string;
  password: string;
  role: UserRole;
  name?: string; // Added field for user's name
  nic?: string; // Added field for National Identity Card number
  address?: string; // Added field for user's address
  phoneNumber?: string; // Added field for user's phone number
  refreshToken?: string;
  refreshTokenHash?: string; // Added field for token hash
  lastLogin?: Date;
  deletedAt?: Date; // New field to track account deletion
  tokenVersion: number; // Incremented on logout/password-change to revoke all JWTs
  loginAttempts?: number; // Track failed login attempts for security
  accountLocked?: boolean; // Flag for account lockout after too many failed attempts
  createdAt: Date;
  updatedAt: Date;
  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false // Don't return password by default
  },
  role: {
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.USER
  },
  name: {
    type: String,
    trim: true
  },
  nic: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  refreshToken: {
    type: String,
    select: false
  },
  refreshTokenHash: {
    type: String,
    select: false
  },
  lastLogin: {
    type: Date
  },
  deletedAt: {
    type: Date,
    default: null
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  accountLocked: {
    type: Boolean,
    default: false
  },
  tokenVersion: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  versionKey: false,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.refreshToken;
      delete ret.refreshTokenHash;
      return ret;
    }
  }
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Generate a salt
    const salt = await bcrypt.genSalt(12);
    // Hash the password using our new salt
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Create a text index for search
UserSchema.index({ email: 'text' });

export default mongoose.model<IUser>('User', UserSchema); 