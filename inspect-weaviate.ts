const { WeaviateService } = require('../backend/src/shared/services/weaviate/weaviate.service');
const { ConfigService } = require('@nestjs/config');

async function inspectWeaviate() {
  console.log('Connecting to Weaviate to inspect collections...');
  try {
    const weaviateService = new WeaviateService();
    await weaviateService.getClient(); // Ensure client is connected

    const schema = await weaviateService.getSchema();
    
    console.log('--- Weaviate Collections ---');
    if (schema && schema.classes && schema.classes.length > 0) {
      schema.classes.forEach((c: any) => {
        console.log(`- ${c.class}`);
      });
    } else {
      console.log('No collections found.');
    }
    console.log('--------------------------');

  } catch (error: any) {
    console.error('Failed to inspect Weaviate:', error.message);
  }
}

inspectWeaviate();