import { NestFactory } from '@nestjs/core';
import { AppModule } from './../backend/src/app.module';
import { WeaviateService } from './../backend/src/shared/services/weaviate/weaviate.service';
import { toProperCase } from './../backend/src/utils/string-formatter';
import { Logger } from '@nestjs/common';

async function migrateProductNames() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const weaviateService = app.get(WeaviateService);
  const logger = new Logger('MigrationScript');

  try {
    logger.log('Starting product name migration...');

    const collectionName = 'ConstructionProducts';
    let offset = 0;
    const limit = 100; // Process in batches

    let hasMore = true;
    while (hasMore) {
      // Fetch a batch of products
      const result = await weaviateService.findObjects(
        {
          collectionName: collectionName,
          limit: limit,
          offset: offset,
          returnProperties: ['name'] // Only fetch the name property
        }
      ) as { items: { name: string; uuid: string }[]; total: number };

      const products = result.items;

      if (products.length === 0) {
        hasMore = false;
        break;
      }

      logger.log(`Processing batch from offset ${offset}. Found ${products.length} products.`);

      for (const product of products) {
        const originalName = product.name;
        const properCasedName = toProperCase(originalName);

        if (originalName !== properCasedName) {
          logger.log(`Updating product ID ${product.uuid}: "${originalName}" -> "${properCasedName}"`);
          await weaviateService.updateObject(collectionName, product.uuid, { name: properCasedName });
        }
      }

      offset += products.length;
      if (products.length < limit) {
        hasMore = false; // No more products to fetch
      }
    }

    logger.log('Product name migration completed successfully.');
  } catch (error) {
    logger.error(`Product name migration failed: ${error.message}`, error.stack);
  } finally {
    await app.close();
  }
}

migrateProductNames();