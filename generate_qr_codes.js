#!/usr/bin/env node

/**
 * QR Code Generator Script
 * 
 * This script generates QR codes for iOS and Android app URLs and saves them as PNG files.
 * It can be used to create QR codes for the mobile app landing page.
 * 
 * Usage:
 *   node generate_qr_codes.js --ios "https://apps.apple.com/app/your-app-id" --android "https://play.google.com/store/apps/details?id=your.app.id"
 * 
 * Options:
 *   --ios       iOS app URL
 *   --android   Android app URL
 *   --output    Output directory (default: ./public/images/qr-codes)
 *   --size      QR code size in pixels (default: 300)
 *   --color     QR code color (default: #f40404 - Bosso red)
 *   --help      Show help
 */

const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { program } = require('commander');

// Configure command-line options
program
  .option('--ios <url>', 'iOS app URL')
  .option('--android <url>', 'Android app URL')
  .option('--output <dir>', 'Output directory', './public/images/qr-codes')
  .option('--size <pixels>', 'QR code size in pixels', 300)
  .option('--color <hex>', 'QR code color', '#f40404')
  .option('--help', 'Show help');

program.parse(process.argv);

const options = program.opts();

// Show help if requested or if no URLs provided
if (options.help || (!options.ios && !options.android)) {
  console.log(`
QR Code Generator Script

This script generates QR codes for iOS and Android app URLs and saves them as PNG files.
It can be used to create QR codes for the mobile app landing page.

Usage:
  node generate_qr_codes.js --ios "https://apps.apple.com/app/your-app-id" --android "https://play.google.com/store/apps/details?id=your.app.id"

Options:
  --ios       iOS app URL
  --android   Android app URL
  --output    Output directory (default: ./public/images/qr-codes)
  --size      QR code size in pixels (default: 300)
  --color     QR code color (default: #f40404 - Bosso red)
  --help      Show help
  `);
  process.exit(0);
}

// Ensure output directory exists
if (!fs.existsSync(options.output)) {
  fs.mkdirSync(options.output, { recursive: true });
  console.log(`Created output directory: ${options.output}`);
}

// QR code options
const qrOptions = {
  errorCorrectionLevel: 'H',
  type: 'png',
  quality: 0.92,
  margin: 1,
  color: {
    dark: options.color,
    light: '#FFFFFF'
  },
  width: parseInt(options.size, 10)
};

// Generate QR code for iOS app URL
if (options.ios) {
  const iosOutputPath = path.join(options.output, 'ios-app-qr.png');
  
  QRCode.toFile(iosOutputPath, options.ios, qrOptions, (err) => {
    if (err) {
      console.error('Error generating iOS QR code:', err);
    } else {
      console.log(`iOS QR code saved to: ${iosOutputPath}`);
    }
  });
}

// Generate QR code for Android app URL
if (options.android) {
  const androidOutputPath = path.join(options.output, 'android-app-qr.png');
  
  QRCode.toFile(androidOutputPath, options.android, qrOptions, (err) => {
    if (err) {
      console.error('Error generating Android QR code:', err);
    } else {
      console.log(`Android QR code saved to: ${androidOutputPath}`);
    }
  });
}

// Log completion message
console.log('QR code generation process initiated.');
console.log('Note: You can upload these QR codes in the Site Settings > Mobile App tab.');
