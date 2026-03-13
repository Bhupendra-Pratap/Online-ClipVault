const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'clipvault';
const MONGODB_COLLECTION = process.env.MONGODB_COLLECTION || 'clips';

const globalMongo = globalThis;

let indexesPromise = null;

function getClientPromise() {
  if (!MONGODB_URI) {
    throw new Error('Missing MONGODB_URI environment variable.');
  }

  if (!globalMongo._clipvaultMongoClientPromise) {
    const client = new MongoClient(MONGODB_URI);
    globalMongo._clipvaultMongoClientPromise = client.connect();
  }

  return globalMongo._clipvaultMongoClientPromise;
}

async function ensureIndexes(collection) {
  if (!indexesPromise) {
    indexesPromise = Promise.all([
      collection.createIndex({ code: 1 }, { unique: true }),
      collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]).catch(error => {
      indexesPromise = null;
      throw error;
    });
  }

  await indexesPromise;
}

async function getClipsCollection() {
  const client = await getClientPromise();
  const collection = client.db(MONGODB_DB).collection(MONGODB_COLLECTION);
  await ensureIndexes(collection);
  return collection;
}

module.exports = {
  getClipsCollection,
};