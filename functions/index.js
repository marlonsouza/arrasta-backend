const {setGlobalOptions} = require("firebase-functions");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

setGlobalOptions({ maxInstances: 10 });

// Scheduled function to cleanup expired URLs
exports.cleanupExpiredUrls = onSchedule(
  {
    schedule: "0 2 * * *", // Daily at 2 AM UTC
    timeZone: "America/Sao_Paulo", // Adjust to your timezone
  },
  async (event) => {
    logger.info("Starting cleanup of expired URLs...");
    
    try {
      const urlsCollection = db.collection('urls');
      const currentDate = new Date();
      const querySnapshot = await urlsCollection.get();
      const batch = db.batch();
      let deletedCount = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        if (data.expiryDate) {
          let expiryDate;
          
          if (data.expiryDate.includes('T')) {
            // Full ISO string with time component
            expiryDate = new Date(data.expiryDate);
          } else {
            // Date-only string (YYYY-MM-DD)
            // Set to end of day to allow the entire day
            const [year, month, day] = data.expiryDate.split('-').map(Number);
            expiryDate = new Date(year, month - 1, day, 23, 59, 59, 999);
          }
          
          if (currentDate > expiryDate) {
            batch.delete(doc.ref);
            deletedCount++;
            logger.info(`Marking expired URL for deletion: ${data.shortCode} (expired: ${data.expiryDate})`);
          }
        }
      });

      if (deletedCount > 0) {
        await batch.commit();
        logger.info(`Successfully deleted ${deletedCount} expired URLs`);
      } else {
        logger.info('No expired URLs found to delete');
      }

      return { deletedCount };
    } catch (error) {
      logger.error('Cleanup failed:', error);
      throw error;
    }
  }
);
