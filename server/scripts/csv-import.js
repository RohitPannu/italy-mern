const { parseCsv } = require('./audit');

const PROGRAM_HEADERS = ['course', 'dept', 'university', 'level', 'academicYear', 'language', 'duration', 'tuitionNote', 'lastVerified', 'sourceUrl', 'link'];
const UNIVERSITY_HEADERS = ['name', 'region', 'city', 'website', 'admissionsUrl', 'dsuApplyUrl', 'accessibilityNote', 'lastVerified'];

function normalizeProgram(row) {
  return {
    course: String(row.course || '').trim(), dept: String(row.dept || '').trim(), university: String(row.university || '').trim(),
    level: ['master', 'bachelor'].includes(String(row.level || '').toLowerCase()) ? String(row.level).toLowerCase() : 'master',
    academicYear: String(row.academicYear || '').trim(), language: String(row.language || '').trim(),
    duration: Number(row.duration) || undefined, tuitionNote: String(row.tuitionNote || '').trim(),
    lastVerified: String(row.lastVerified || '').trim(), sourceUrl: String(row.sourceUrl || '').trim(), link: String(row.link || '').trim()
  };
}

function normalizeUniversity(row) {
  return {
    name: String(row.name || '').trim(), region: String(row.region || '').trim(), city: String(row.city || '').trim(),
    website: String(row.website || '').trim(), admissionsUrl: String(row.admissionsUrl || '').trim(),
    dsuApplyUrl: String(row.dsuApplyUrl || '').trim(), accessibilityNote: String(row.accessibilityNote || '').trim(),
    lastVerified: String(row.lastVerified || '').trim()
  };
}

function validateImport(entity, rows) {
  if (!['programs', 'universities'].includes(entity)) return { valid: false, errors: ['Unknown import entity.'] };
  const headers = entity === 'programs' ? PROGRAM_HEADERS : UNIVERSITY_HEADERS;
  const missingHeaders = headers.filter(header => !rows.length || !Object.prototype.hasOwnProperty.call(rows[0], header));
  if (missingHeaders.length) return { valid: false, errors: [`Missing required columns: ${missingHeaders.join(', ')}`] };
  const errors = [], normalized = [];
  rows.forEach((row, index) => {
    const current = entity === 'programs' ? normalizeProgram(row) : normalizeUniversity(row);
    if (entity === 'programs' && (!current.course || !current.university)) errors.push(`Row ${index + 2}: course and university are required.`);
    if (entity === 'universities' && (!current.name || !current.region)) errors.push(`Row ${index + 2}: name and region are required.`);
    normalized.push(current);
  });
  return { valid: !errors.length, errors, rows: normalized };
}

module.exports = { PROGRAM_HEADERS, UNIVERSITY_HEADERS, normalizeProgram, normalizeUniversity, validateImport };
