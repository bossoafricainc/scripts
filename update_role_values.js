/**
 * Script to update role values in Firestore to uppercase
 * 
 * This script:
 * 1. Fetches all user documents from Firestore
 * 2. Checks if the role value is lowercase
 * 3. Updates the role value to uppercase if needed
 */

const admin = require('firebase-admin');
const serviceAccount = require('../backend/bella-e0f4a-firebase-adminsdk-fbsvc-28739174d5.json');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateRoleValues() {
  console.log('Starting role value update process...');
  
  try {
    // Get all user documents
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('No users found in the database.');
      return;
    }
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    // Process each user document
    const updatePromises = usersSnapshot.docs.map(async (doc) => {
      const userData = doc.data();
      
      // Check if the user has a role field
      if (!userData.role) {
        console.log(`User ${doc.id} has no role field. Skipping.`);
        skippedCount++;
        return;
      }
      
      // Check if the role is already uppercase
      if (userData.role === userData.role.toUpperCase()) {
        console.log(`User ${doc.id} already has uppercase role: ${userData.role}. Skipping.`);
        skippedCount++;
        return;
      }
      
      // Convert role to uppercase
      const upperCaseRole = userData.role.toUpperCase();
      console.log(`Updating user ${doc.id} role from ${userData.role} to ${upperCaseRole}`);
      
      // Update the document
      await db.collection('users').doc(doc.id).update({
        role: upperCaseRole,
        updatedAt: new Date().toISOString()
      });
      
      updatedCount++;
    });
    
    // Wait for all updates to complete
    await Promise.all(updatePromises);
    
    console.log(`Role update process completed.`);
    console.log(`Updated ${updatedCount} users.`);
    console.log(`Skipped ${skippedCount} users.`);
    
  } catch (error) {
    console.error('Error updating role values:', error);
  } finally {
    // Terminate the Firebase Admin SDK
    admin.app().delete();
  }
}

// Run the update function
updateRoleValues();
