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
  const isProduction = process.env.NODE_ENV === 'production';

  if (primaryUri) {
    await connectOnce(primaryUri);
    console.log('MongoDB Connected');
    return;
  }

  if (isProduction) {
    throw new Error('MONGO_URI is required in production');
  }

  console.warn('MONGO_URI not set. Using local MongoDB fallback:', DEFAULT_LOCAL_URI);
  await connectOnce(DEFAULT_LOCAL_URI);
  console.log('MongoDB Connected (local fallback)');
};

module.exports = connectDB;
