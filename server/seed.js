require('dotenv').config();
const mongoose = require('mongoose'), { Program, University, Region } = require('./models');
(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/italy');
  if (await Program.countDocuments() && !process.argv.includes('--force')) return console.log('Already seeded. Use --force to reset (this erases admin edits).');
  const P = require('./data/programs.json'), M = require('./data/meta.json');
  await Promise.all([Program.deleteMany(), University.deleteMany(), Region.deleteMany()]);
  await Program.insertMany(P); await University.insertMany(M.unis); await Region.insertMany(M.regions);
  console.log(`Seeded ${P.length} programs, ${M.unis.length} universities, ${M.regions.length} regions`);
})().catch(e => { console.error(e); process.exit(1); }).finally(() => mongoose.disconnect());
