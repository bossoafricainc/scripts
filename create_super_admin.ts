const admin = require('firebase-admin');
import * as readline from 'readline';

// Function to prompt for password
function getPassword() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise<string>(resolve => {
    rl.question('Please enter the password for the new super admin: ', (password: string) => {
      rl.close();
      resolve(password);
    });
  });
}

async function createSuperAdmin() {
  try {
    // Get password from user
    const password = await getPassword();

    if (!password) {
      console.error('Password is required.');
      return;
    }

    // Initialize Firebase Admin SDK
    // ** IMPORTANT **
    // Make sure you have the correct service account key for your development project
    const serviceAccount = require('../backend/bosso-dev.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    const db = admin.firestore();
    const auth = admin.auth();

    const email = 'mukopaje+dev@gmail.com';
    const role = 'SUPER_ADMIN';

    console.log(`Creating new super admin with email: ${email}`);

    // Create user in Firebase Authentication
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      emailVerified: true,
      disabled: false
    });

    console.log(`Successfully created new user with UID: ${userRecord.uid}`);

    // Set custom claim for the user
    await auth.setCustomUserClaims(userRecord.uid, { role: role });

    console.log(`Successfully set custom claim 'role: ${role}' for user: ${userRecord.uid}`);

    // Create user document in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      email: email,
      role: role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    console.log(`Successfully created user document in Firestore for user: ${userRecord.uid}`);

  } catch (error) {
    console.error('Error creating super admin:', error);
  } finally {
    // Terminate the Firebase Admin SDK
    if (admin.apps.length) {
      admin.app().delete();
    }
  }
}

createSuperAdmin();