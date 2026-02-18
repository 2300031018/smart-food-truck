const mongoose = require('mongoose');
const DEFAULT_LOCAL_URI = 'mongodb://127.0.0.1:27017/smart-food-truck';

const connectOnce = async (uri) => {
  if (!uri) throw new Error('No Mongo URI provided');
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 20000,
    connectTimeoutMS: 10000
  });
};

const connectDB = async () => {
  const primaryUri = process.env.MONGO_URI;
  try {
    const obscuredUri = primaryUri ? primaryUri.replace(/\/\/.*@/, '//***:***@') : 'none';
    console.log(`Connecting to MongoDB: ${obscuredUri}`);
    await connectOnce(primaryUri);
    console.log('MongoDB Connected');
  } catch (err) {
    console.error('Mongo connection error:', err.message);
    // Try local fallback if primary is missing or SRV/DNS failed
    try {
      console.warn('Attempting local MongoDB fallback:', DEFAULT_LOCAL_URI);
      await connectOnce(DEFAULT_LOCAL_URI);
      console.log('MongoDB Connected (local fallback)');
    } catch (fallbackErr) {
      console.error('Fallback Mongo connection error:', fallbackErr.message);
      process.exit(1);
    }
  }
};

module.exports = connectDB;
