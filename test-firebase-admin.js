require('dotenv').config();
const admin = require('firebase-admin');

// Initialize Firebase Admin with service account
// You need to download a service account key from Firebase Console
// and save it as 'serviceAccountKey.json' in your project root
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const urlsCollection = db.collection('urls');

async function testConnection() {
  try {
    console.log('Attempting to connect to Firebase Admin...');
    
    // Test creating a URL
    const testUrl = {
      originalUrl: 'https://example.com',
      shortCode: 'test' + Date.now(),
      qrCodeDataURL: 'data:image/png;base64,test',
      accessNumber: 0,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      userId: 'test-user',
      createdAt: new Date().toISOString()
    };
    
    const docRef = await urlsCollection.add(testUrl);
    console.log('Firebase Admin connection test successful!');
    console.log('Created URL with ID:', docRef.id);
    
    // Test retrieving the URL
    const doc = await docRef.get();
    console.log('Retrieved URL:', doc.data());
    
    // Clean up - delete the test document
    await docRef.delete();
    console.log('Test document deleted');
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testConnection(); 