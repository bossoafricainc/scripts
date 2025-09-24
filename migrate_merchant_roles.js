const admin = require('firebase-admin');

// Path to your Firebase Admin SDK private key JSON file
// Make sure this path is correct for your environment
const serviceAccount = require('../backend/bella-e0f4a-firebase-adminsdk-fbsvc-28739174d5.json');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // Replace with your Firebase project ID if needed
  // databaseURL: "https://your-project-id.firebaseio.com" 
});

const db = admin.firestore();

async function migrateMerchantRoles() {
  const wrongRole = 'MERCHNAT';
  const correctRole = 'MERCHANT';
  let batch = db.batch();
  let numberOfDocs = 0;

  try {
    console.log(`Starting migration: Updating users with role '${wrongRole}' to '${correctRole}'...`);

    const usersRef = db.collection('users');
    const q = usersRef.where('role', '==', wrongRole);

    const snapshot = await q.get();

    if (snapshot.empty) {
      console.log(`No users found with the role '${wrongRole}'. Migration complete.`);
      return;
    }

    console.log(`Found ${snapshot.size} users with the role '${wrongRole}'.`);

    for (const doc of snapshot.docs) { // Use for...of loop
      const userRef = usersRef.doc(doc.id);
      batch.update(userRef, { role: correctRole, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      numberOfDocs++;

      // Commit batch in chunks of 500 to avoid exceeding Firestore limits
      if (numberOfDocs % 500 === 0) {
        console.log(`Committing batch of ${numberOfDocs} updates...`);
        await batch.commit();
        batch = db.batch(); // Start a new batch
      }
    }

    // Commit any remaining documents in the last batch
    if (numberOfDocs > 0 && numberOfDocs % 500 !== 0) {
      console.log(`Committing final batch of ${numberOfDocs % 500} updates...`);
      await batch.commit();
    } else if (numberOfDocs === 0) {
        console.log('No documents to commit in the final batch.');
    }

    console.log(`Migration finished. Successfully updated ${numberOfDocs} users.`);

  } catch (error) {
    console.error('Error during migration:', error);
  }
}

migrateMerchantRoles().then(() => {
  console.log('Script finished.');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});