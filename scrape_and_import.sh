#!/bin/bash

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
