const { connectToDatabase, deleteExpiredUrls } = require('./db/firebase');

async function testCleanup() {
  try {
    console.log('🧹 Testing cleanup functionality...');
    
    await connectToDatabase();
    console.log('✅ Connected to Firebase successfully');
    
    const deletedCount = await deleteExpiredUrls();
    console.log(`🗑️ Cleanup completed: ${deletedCount} expired URLs deleted`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup test failed:', error);
    process.exit(1);
  }
}

testCleanup();