import { WeaviateService } from '../backend/src/shared/services/weaviate/weaviate.service';
import * as fs from 'fs';
import * as path from 'path';

async function populateMerchants() {
  console.log('Connecting to Weaviate to populate merchants...');
  try {
    const weaviateService = new WeaviateService();
    await weaviateService.getClient(); // Ensure client is connected

    const backupPath = path.join(__dirname, '..', 'backend', 'backups', 'merchants_backup.json');
    if (!fs.existsSync(backupPath)) {
      console.error(`Backup file not found: ${backupPath}`);
      return;
    }

    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));

    await weaviateService.addBatchObjects('Merchant', backupData);

    console.log('Successfully populated merchants.');

  } catch (error: any) {
    console.error('Failed to populate merchants:', error.message);
  }
}

populateMerchants();