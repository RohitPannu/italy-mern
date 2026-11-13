const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, select: false },
  role: { type: String, enum: ['student', 'editor', 'admin'], default: 'student', index: true },
  name: { type: String, required: true, trim: true },
  emailVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true, index: true },
  failedLogins: { type: Number, default: 0 },
  lockUntil: { type: Date },
  mfaEnabled: { type: Boolean, default: false },
  mfaSecretEnc: { type: String, select: false },
  mfaRecoveryHashes: [{ type: String, select: false }],
  createdAt: { type: Date, default: Date.now },
  lastLoginAt: Date
}, { timestamps: true });
const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, index: true },
  userAgent: String,
  ip: String,
  expiresAt: { type: Date, required: true, index: true },
  revokedAt: Date,
  replacedBy: { type: mongoose.Schema.Types.ObjectId }
}, { timestamps: true });
const authTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['verifyEmail', 'resetPassword', 'invite'], required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: true },
  usedAt: Date
}, { timestamps: true });
const auditSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true, index: true },
  targetId: mongoose.Schema.Types.ObjectId,
  ip: String,
  userAgent: String,
  createdAt: { type: Date, default: Date.now }
}, { timestamps: false });
const shortlistSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  programIds: [{ type: mongoose.Schema.Types.ObjectId }],
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });
const checklistSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  items: [{ id: String, label: String, complete: { type: Boolean, default: false } }],
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });
module.exports = {
  User: mongoose.models.User || mongoose.model('User', userSchema),
  Session: mongoose.models.Session || mongoose.model('Session', sessionSchema),
  AuthToken: mongoose.models.AuthToken || mongoose.model('AuthToken', authTokenSchema),
  AuditLog: mongoose.models.AuditLog || mongoose.model('AuditLog', auditSchema),
  Shortlist: mongoose.models.Shortlist || mongoose.model('Shortlist', shortlistSchema),
  Checklist: mongoose.models.Checklist || mongoose.model('Checklist', checklistSchema)
};
