import mongoose from 'mongoose';
import { IMAGE_BUCKET } from '../constants/catalog.js';
import { ApiError } from '../utils/ApiError.js';

const { GridFSBucket, ObjectId } = mongoose.mongo;

let bucket = null;
let bucketDb = null;

/** One bucket per live connection. Works unchanged on MongoDB Atlas (it only uses the standard driver). */
export function getBucket() {
  const db = mongoose.connection.db;
  if (!db) throw new ApiError(503, 'Image storage is unavailable: the database is not connected.');
  if (!bucket || bucketDb !== db) {
    bucket = new GridFSBucket(db, { bucketName: IMAGE_BUCKET });
    bucketDb = db;
  }
  return bucket;
}

export function saveFile(buffer, { filename, contentType, metadata }) {
  return new Promise((resolve, reject) => {
    const upload = getBucket().openUploadStream(filename, { contentType, metadata });
    upload.once('error', reject);
    upload.once('finish', () => resolve(upload.id));
    upload.end(buffer);
  });
}

/** Deletes files; failures are logged, never thrown (a leftover file is harmless, a failed request is not). */
export async function deleteFiles(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  const results = await Promise.allSettled(unique.map((id) => getBucket().delete(new ObjectId(id))));
  results.forEach((result, i) => {
    if (result.status === 'rejected' && !/FileNotFound/i.test(result.reason?.message ?? '')) {
      console.error(`Failed to delete image file ${unique[i]}:`, result.reason?.message);
    }
  });
}

export async function findFile(id) {
  const [file] = await getBucket().find({ _id: new ObjectId(id) }).limit(1).toArray();
  return file ?? null;
}


export const openDownload = (id) => getBucket().openDownloadStream(new ObjectId(id));
