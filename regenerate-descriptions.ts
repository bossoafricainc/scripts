const { productService } = require('../dashboard/src/services/product.service');
const { aiService } = require('../dashboard/src/services/ai.service');

async function regenerateDescriptions() {
  console.log('Fetching all products...');
  const products = await productService.getProducts({ limit: 1000 });
  const productsToRetry = products.items.filter(p => p.description?.startsWith('I apologize'));

  if (productsToRetry.length === 0) {
    console.log('No products with descriptions to retry.');
    return;
  }

  console.log(`Found ${productsToRetry.length} products to retry.`);

  const productIds = productsToRetry.map(p => p.id!);
  const result = await aiService.retryDescriptions(productIds);

  console.log('Retry result:', result);
}

regenerateDescriptions();