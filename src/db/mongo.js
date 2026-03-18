/**
 * MongoDB Connection — local instance, no .env needed
 * Connects to localhost:27017/negoapp.
 */
import mongoose from 'mongoose';

const MONGO_URI = 'mongodb://localhost:27017/negoapp';

let isConnected = false;

/**
 * Connect to local MongoDB. Retries once on failure.
 * @returns {Promise<boolean>} true if connected
 */
export async function connectDB() {
  if (isConnected) return true;
  try {
    await mongoose.connect(MONGO_URI);
    isConnected = true;
    console.log('[MongoDB] Connected to', MONGO_URI);
    return true;
  } catch (err) {
    console.error('[MongoDB] Connection failed:', err.message);
    // Retry once after 2 seconds
    await new Promise(r => setTimeout(r, 2000));
    try {
      await mongoose.connect(MONGO_URI);
      isConnected = true;
      console.log('[MongoDB] Connected on retry to', MONGO_URI);
      return true;
    } catch (retryErr) {
      console.error('[MongoDB] Retry also failed:', retryErr.message);
      throw retryErr;
    }
  }
}

export default mongoose;
