const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

/**
 * Import site settings data into Firebase
 */
async function importSiteSettings() {
  console.log('Starting site settings import...');
  
  try {
    // Initialize Firebase Admin SDK
    if (!admin.apps.length) {
      // Look for service account key file in the backend directory
      const serviceAccountPath = path.join(__dirname, '../backend/bella-e0f4a-firebase-adminsdk-fbsvc-28739174d5.json');
      
      if (!fs.existsSync(serviceAccountPath)) {
        console.error('Firebase service account key file not found at:', serviceAccountPath);
        console.error('Please make sure the file exists or update the path in this script.');
        process.exit(1);
      }
      
      const serviceAccount = require(serviceAccountPath);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://bella-e0f4a.firebaseio.com'
      });
    }
    
    // Read the site settings data from the JSON file
    const dataPath = path.join(__dirname, 'site_settings_data.json');
    
    if (!fs.existsSync(dataPath)) {
      console.error('Site settings data file not found at:', dataPath);
      console.error('Please run the scrape_old_website.js script first to generate the data.');
      process.exit(1);
    }
    
    const siteSettingsData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Get a reference to the Firestore database
    const db = admin.firestore();
    
    // Check if site settings document already exists
    const siteSettingsRef = db.collection('site-settings').doc('default');
    const siteSettingsDoc = await siteSettingsRef.get();
    
    if (siteSettingsDoc.exists) {
      console.log('Site settings document already exists. Updating...');
      
      // Merge the existing data with the new data
      await siteSettingsRef.update(siteSettingsData);
      console.log('Site settings updated successfully.');
    } else {
      console.log('Site settings document does not exist. Creating...');
      
      // Create a new document with the data
      await siteSettingsRef.set(siteSettingsData);
      console.log('Site settings created successfully.');
    }
    
    // Create a backup of the existing site settings if they exist
    if (siteSettingsDoc.exists) {
      const backupRef = db.collection('site-settings-backups').doc(`backup-${Date.now()}`);
      await backupRef.set(siteSettingsDoc.data());
      console.log('Backup of previous site settings created.');
    }
    
    console.log('Site settings import completed.');
    
  } catch (error) {
    console.error('Error during site settings import:', error);
  } finally {
    // Close the Firebase Admin SDK connection
    if (admin.apps.length) {
      await admin.app().delete();
    }
  }
}

/**
 * Create a shell script to run both the scrape and import scripts
 */
function createShellScript() {
  const scriptContent = `#!/bin/bash

# Run the scrape script
echo "Running website scraper..."
node scrape_old_website.js

# Check if the scrape was successful
if [ $? -ne 0 ]; then
  echo "Error: Website scraping failed."
  exit 1
fi

# Run the import script
echo "Running site settings import..."
node import_site_settings.js

# Check if the import was successful
if [ $? -ne 0 ]; then
  echo "Error: Site settings import failed."
  exit 1
fi

echo "Site settings scrape and import completed successfully."
`;

  const scriptPath = path.join(__dirname, 'scrape_and_import.sh');
  fs.writeFileSync(scriptPath, scriptContent);
  fs.chmodSync(scriptPath, '755'); // Make the script executable
  
  console.log(`Shell script created at: ${scriptPath}`);
  console.log('You can run both scripts with: ./scrape_and_import.sh');
}

// Check if this script is being run directly
if (require.main === module) {
  // Create the shell script
  createShellScript();
  
  // Run the import function
  importSiteSettings();
}

module.exports = {
  importSiteSettings
};
