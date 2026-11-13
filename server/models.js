const { Schema, model } = require('mongoose');
const Program = model('Program', new Schema({
  course: { type: String, required: true }, dept: String, link: { type: String, default: '' },
  university: { type: String, required: true, index: true },
  level: { type: String, enum: ['master', 'bachelor'], default: 'master', index: true },
  academicYear: { type: String, default: '' }, language: { type: String, default: '' },
  duration: { type: Number, min: 0 }, tuitionNote: { type: String, default: '' },
  lastVerified: { type: String, default: '' }, sourceUrl: { type: String, default: '' }
}, { timestamps: true }));
const University = model('University', new Schema({
  name: { type: String, required: true, unique: true }, region: { type: String, index: true },
  city: { type: String, default: '' }, website: { type: String, default: '' },
  admissionsUrl: { type: String, default: '' }, dsuApplyUrl: { type: String, default: '' },
  accessibilityNote: { type: String, default: '' }, intake: { type: String, default: '' },
  deadline: { type: String, default: '' }, lastCycle: { type: String, default: '' },
  source: { type: String, default: '' }, lastVerified: { type: String, default: '' }
}, { timestamps: true }));
const Region = model('Region', new Schema({ name: { type: String, unique: true }, dsu: String, url: String, timing: String }));
const Scholarship = model('Scholarship', new Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  provider: { type: String, required: true, trim: true, maxlength: 160 },
  region: { type: String, required: true, trim: true, index: true },
  universities: [{
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true, maxlength: 2000 }
  }],
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  benefits: { type: String, default: '', trim: true, maxlength: 2000 },
  applicationStart: { type: String, default: '' },
  deadline: { type: String, default: '', index: true },
  intake: { type: String, default: '', trim: true, maxlength: 120 },
  eligibility: { type: String, default: '', trim: true, maxlength: 3000 },
  requirements: [{ type: String, trim: true, maxlength: 500 }],
  procedure: [{ type: String, trim: true, maxlength: 1000 }],
  officialUrl: { type: String, default: '', trim: true, maxlength: 2048 },
  status: { type: String, enum: ['active', 'upcoming', 'closed'], default: 'upcoming', index: true },
  lastVerified: { type: String, default: '' }
}, { timestamps: true }));
const Announcement = model('Announcement', new Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
  category: { type: String, enum: ['scholarship', 'upcoming', 'important', 'news'], default: 'important', index: true },
  startsAt: { type: String, default: '' },
  endsAt: { type: String, default: '' },
  officialUrl: { type: String, default: '', trim: true, maxlength: 2048 },
  published: { type: Boolean, default: true, index: true }
}, { timestamps: true }));
const Lead = model('Lead', new Schema({ name: String, email: String, whatsapp: String, message: String }, { timestamps: true }));
const Student = model('Student', new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['student'], default: 'student' },
  active: { type: Boolean, default: true }
}, { timestamps: true }));
module.exports = { Program, University, Region, Scholarship, Announcement, Lead, Student };
