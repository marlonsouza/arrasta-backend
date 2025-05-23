const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin
let db = null;
let urlsCollection = null;
let paymentsCollection = null;

// Connect to database
const connectToDatabase = async () => {
  try {
    if (!db) {
      // Create service account from environment variables
      const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
      };

      // Check if we have all the required fields
      if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
        throw new Error('Missing required Firebase Admin SDK environment variables. Please check your configuration.');
      }

      // Initialize the app if it hasn't been initialized yet
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      }

      db = admin.firestore();
      urlsCollection = db.collection('urls');
      paymentsCollection = db.collection('payments');
    }

    console.log('Firebase connection successful!');
    return { urlsCollection, paymentsCollection };
  } catch (error) {
    console.error('Firebase connection error:', error);
    throw error;
  }
};

// Close connection (Firebase Admin doesn't need explicit disconnection)
const closeConnection = async () => {
  console.log('Firebase connection closed.');
};

// Helper functions for URL operations
const createUrl = async (urlData) => {
  const docRef = urlsCollection.doc();
  const userId = 'anonymous'; // Since we're using Admin SDK, we don't have auth context
  
  await docRef.set({
    ...urlData,
    id: docRef.id,
    userId: userId,
    createdAt: new Date().toISOString()
  });
  return { id: docRef.id, ...urlData };
};

const getUrlByShortCode = async (shortCode) => {
  const q = urlsCollection.where('shortCode', '==', shortCode);
  const querySnapshot = await q.get();
  
  if (querySnapshot.empty) {
    return null;
  }
  
  const doc = querySnapshot.docs[0];
  return { id: doc.id, ...doc.data() };
};

const incrementUrlAccess = async (urlId) => {
  const urlRef = urlsCollection.doc(urlId);
  await urlRef.update({
    accessNumber: admin.firestore.FieldValue.increment(1)
  });
};

// Helper functions for payment operations
const createPayment = async (paymentData) => {
  const docRef = paymentsCollection.doc();
  const userId = 'anonymous'; // Since we're using Admin SDK, we don't have auth context
  
  await docRef.set({
    ...paymentData,
    id: docRef.id,
    userId: userId,
    createdAt: new Date().toISOString()
  });
  return { id: docRef.id, ...paymentData };
};

const getPaymentById = async (paymentId) => {
  const paymentRef = paymentsCollection.doc(paymentId);
  const paymentDoc = await paymentRef.get();
  
  if (!paymentDoc.exists) {
    return null;
  }
  
  return { id: paymentDoc.id, ...paymentDoc.data() };
};

// Get current user ID (not applicable with Admin SDK)
const getCurrentUserId = () => {
  return 'anonymous';
};

module.exports = {
  connectToDatabase,
  closeConnection,
  createUrl,
  getUrlByShortCode,
  incrementUrlAccess,
  createPayment,
  getPaymentById,
  getCurrentUserId
}; 