const { config } = require('./config');
const mongoose = require('mongoose');
const app = require('./app');

const start = async () => {
  try {
    await mongoose.connect(config.mongoUri);
    app.listen(config.port, () => {
      console.log(`Secure API on http://localhost:${config.port}`);
    });
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}

module.exports = { app, start };
