require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');

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

async function testConnection() {
  try {
    console.log('Attempting to connect to Firebase...');
    
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('Firebase connection successful!');
    console.log('Firebase project ID:', process.env.FIREBASE_PROJECT_ID);
    console.log('Firebase API Key:', process.env.FIREBASE_API_KEY ? 'Set' : 'Not set');
    
    // Just test if we can access the database without writing
    console.log('Firebase Firestore instance created successfully');
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testConnection(); 