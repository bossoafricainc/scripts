import requests
import json
import time
import os
from dotenv import load_dotenv

# ------------------------------
# CONFIGURATION
# ------------------------------
# Load environment variables from .env.dev
dotenv_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env.dev')
load_dotenv(dotenv_path=dotenv_path)

PROD_URL = "http://bella.thebosso.com:8090"
DEV_URL = "http://localhost:8095"
BATCH_SIZE = 100  # adjust depending on memory
SLEEP_BETWEEN_BATCHES = 0.1  # avoid overloading servers

# ------------------------------
# STEP 1: Fetch PROD schema
# ------------------------------
print("Fetching production schema...")
resp = requests.get(f"{PROD_URL}/v1/schema")
resp.raise_for_status()
schema = resp.json()

# ------------------------------
# STEP 2: Clean and apply schema to DEV
# ------------------------------
print("Cleaning and applying schema to dev...")
for cls in schema.get("classes", []):
    cls_name = cls["class"]
    # Delete existing class in dev if it exists
    del_resp = requests.delete(f"{DEV_URL}/v1/schema/{cls_name}")
    if del_resp.status_code not in (200, 404):
        print(f"Warning: could not delete {cls_name} in dev:", del_resp.text)
    
    # --- Apply all compatibility fixes ---
    # 1. Disable the vectorizer
    cls["vectorizer"] = "none"

    # 2. Remove class-level moduleConfig
    if "moduleConfig" in cls:
        del cls["moduleConfig"]

    # 3. Remove property-level moduleConfig
    for prop in cls.get("properties", []):
        if "moduleConfig" in prop:
            del prop["moduleConfig"]
            
    # 4. Remove conflicting vector index and vector configs
    if "vectorIndexConfig" in cls:
        del cls["vectorIndexConfig"]
    if "vectorConfig" in cls:
        del cls["vectorConfig"]
            
    # Create class
    try:
        create_resp = requests.post(f"{DEV_URL}/v1/schema", json=cls)
        create_resp.raise_for_status()
        print(f"Class {cls_name} created successfully.")
    except requests.exceptions.HTTPError as e:
        print(f"FATAL: Error creating class {cls_name}: {e}")
        print("Response body:", create_resp.json())
        # Stop the script if a class fails to create
        exit(1)

# ------------------------------
# STEP 3: Migrate objects by class
# ------------------------------
for cls in schema.get("classes", []):
    cls_name = cls["class"]
    print(f"Migrating objects for class {cls_name}...")

    offset = 0
    while True:
        # Fetch batch from prod
        batch_resp = requests.get(
            f"{PROD_URL}/v1/objects",
            params={
                "class": cls_name,
                "limit": BATCH_SIZE,
                "offset": offset,
                "include": "vector", # Ensure vector is included
            }
        )
        batch_resp.raise_for_status()
        objects = batch_resp.json().get("objects", [])
        if not objects:
            break

        # Prepare batch for dev insertion
        for obj in objects:
            # Remove read-only metadata fields before inserting
            obj_to_insert = {
                "class": obj["class"],
                "id": obj.get("id"),
                "properties": obj.get("properties"),
                "vector": obj.get("vector")
            }

            insert_resp = requests.post(f"{DEV_URL}/v1/objects", json=obj_to_insert)
            if insert_resp.status_code != 200:
                print(f"Error inserting object {obj.get('id')}: {insert_resp.text}")

        offset += BATCH_SIZE
        time.sleep(SLEEP_BETWEEN_BATCHES)

print("Migration completed successfully.")