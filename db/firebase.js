const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, updateDoc, increment } = require('firebase/firestore');
const { getAuth } = require('firebase/auth');
require('dotenv').config();

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASURE_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Collection references
const urlsCollection = collection(db, 'urls');
const paymentsCollection = collection(db, 'payments');

// Connect to database (Firebase doesn't need explicit connection)
const connectToDatabase = async () => {
  try {
    console.log('Firebase connection successful!');
    return { urlsCollection, paymentsCollection };
  } catch (error) {
    console.error('Firebase connection error:', error);
    throw error;
  }
};

// Close connection (Firebase doesn't need explicit disconnection)
const closeConnection = async () => {
  console.log('Firebase connection closed.');
};

// Helper functions for URL operations
const createUrl = async (urlData) => {
  const docRef = doc(urlsCollection);
  const userId = auth.currentUser ? auth.currentUser.uid : 'anonymous';
  
  await setDoc(docRef, {
    ...urlData,
    id: docRef.id,
    userId: userId,
    createdAt: new Date().toISOString()
  });
  return { id: docRef.id, ...urlData };
};

const getUrlByShortCode = async (shortCode) => {
  const q = query(urlsCollection, where('shortCode', '==', shortCode));
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    return null;
  }
  
  const doc = querySnapshot.docs[0];
  return { id: doc.id, ...doc.data() };
};

const incrementUrlAccess = async (urlId) => {
  const urlRef = doc(urlsCollection, urlId);
  await updateDoc(urlRef, {
    accessNumber: increment(1)
  });
};

// Helper functions for payment operations
const createPayment = async (paymentData) => {
  const docRef = doc(paymentsCollection);
  const userId = auth.currentUser ? auth.currentUser.uid : 'anonymous';
  
  await setDoc(docRef, {
    ...paymentData,
    id: docRef.id,
    userId: userId,
    createdAt: new Date().toISOString()
  });
  return { id: docRef.id, ...paymentData };
};

const getPaymentById = async (paymentId) => {
  const paymentRef = doc(paymentsCollection, paymentId);
  const paymentDoc = await getDoc(paymentRef);
  
  if (!paymentDoc.exists()) {
    return null;
  }
  
  return { id: paymentDoc.id, ...paymentDoc.data() };
};

// Get current user ID
const getCurrentUserId = () => {
  return auth.currentUser ? auth.currentUser.uid : 'anonymous';
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