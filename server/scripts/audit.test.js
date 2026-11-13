const test = require('node:test');
const assert = require('node:assert/strict');
const { auditProgramRows, parseCsv } = require('./audit');

test('auditProgramRows reports truncated-looking course names and invalid URLs', () => {
  const rows = [
    { course: 'Architecture and Creative Practices for The City and Land', dept: 'Design', university: 'University of Bologna', link: 'not-a-url', level: 'master', academicYear: '2027/28', language: 'English', duration: '2', sourceUrl: 'https://example.edu', lastVerified: '2026-10-08' },
    { course: 'Valid course', dept: 'Design', university: 'University of Bologna', link: 'https://example.edu/course', level: 'master', academicYear: '2027/28', language: 'English', duration: '2', sourceUrl: 'https://example.edu', lastVerified: '2026-10-08' }
  ];
  const report = auditProgramRows(rows);
  assert.equal(report.length, 1);
  assert.match(report[0].reason, /truncation/i);
  assert.match(report[0].reason, /invalid URL/i);
});

test('parseCsv handles quoted commas and escaped quotes', () => {
  const csv = 'course,dept\n"Design, Architecture",Department\n"Say ""Hello""",Other';
  assert.deepEqual(parseCsv(csv), [
    { course: 'Design, Architecture', dept: 'Department' },
    { course: 'Say "Hello"', dept: 'Other' }
  ]);
});
