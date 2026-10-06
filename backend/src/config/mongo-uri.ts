export function getMongoUri(): string {
  const uri = (process.env.MONGO_URI ?? '').trim();
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && !uri) {
    throw new Error('MONGO_URI must be set in production (MongoDB Atlas connection string)');
  }

  return uri || 'mongodb://127.0.0.1:27017/charodey';
}
