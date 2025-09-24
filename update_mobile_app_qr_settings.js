/**
 * Script to update mobile app settings to use the generated QR codes
 */
const admin = require('firebase-admin');
const serviceAccount = require('../firebase-service-account.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function updateMobileAppQRSettings() {
  try {
    // Get the site settings document
    const settingsRef = db.collection('site-settings').doc('default');
    const settingsDoc = await settingsRef.get();
    
    if (!settingsDoc.exists) {
      console.error('Site settings document does not exist');
      return;
    }
    
    const settings = settingsDoc.data();
    
    // Update mobile app settings
    const mobileApp = settings.mobileApp || {};
    
    const updatedMobileApp = {
      ...mobileApp,
      iosAppUrl: 'https://apps.apple.com/app/bella-app',
      androidAppUrl: 'https://play.google.com/store/apps/details?id=com.bella.app',
      iosQRCodeImage: '/images/mobile-app/ios-qr-code.png',
      androidQRCodeImage: '/images/mobile-app/android-qr-code.png',
      landingPage: {
        ...mobileApp.landingPage || {},
        headline: 'Download Our Mobile App',
        description: 'Get the best experience with our mobile app. Easily browse products, create quotes, and track your orders on the go.',
        heroImage: '/images/mobile-app/hero.jpg',
        colorScheme: '#007bff',
        layout: 'centered',
        showDeviceFrames: true,
        showQrCodes: true,
        additionalContent: '<h3>Why Use Our Mobile App?</h3><ul><li>Faster browsing experience</li><li>Real-time order tracking</li><li>Exclusive mobile-only deals</li><li>Offline catalog browsing</li><li>Push notifications for order updates</li></ul>'
      }
    };
    
    // Update the document
    await settingsRef.update({
      mobileApp: updatedMobileApp
    });
    
    console.log('Mobile app QR code settings updated successfully');
  } catch (error) {
    console.error('Error updating mobile app QR code settings:', error);
  } finally {
    // Exit the process
    process.exit(0);
  }
}

// Run the update function
updateMobileAppQRSettings();
