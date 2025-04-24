require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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
    
    // Try to read from the urls collection
    const urlsCollection = collection(db, 'urls');
    const querySnapshot = await getDocs(urlsCollection);
    
    console.log(`Successfully read ${querySnapshot.size} documents from the urls collection`);
    
    // Log the first document if any exist
    if (!querySnapshot.empty) {
      const firstDoc = querySnapshot.docs[0];
      console.log('First document:', firstDoc.data());
    } else {
      console.log('No documents found in the urls collection');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testConnection(); 