const mongoose = require('mongoose');
async function connectDatabase(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
}
async function disconnectDatabase() { await mongoose.disconnect(); }
const databaseIsConnected = () => mongoose.connection.readyState === 1;
module.exports = { connectDatabase, disconnectDatabase, databaseIsConnected };
