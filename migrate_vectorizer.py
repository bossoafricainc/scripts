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
load_dotenv(dotenv_path=dotenv_path, override=True)
print(f"Loaded OPENAI_API_KEY: {os.getenv('OPENAI_API_KEY')}")

PROD_URL = "http://bella.thebosso.com:8090"
DEV_URL = "http://localhost:8095"
BATCH_SIZE = 100  # adjust depending on memory
SLEEP_BETWEEN_BATCHES = 0.1  # avoid overloading servers
COLLECTION_NAME = "ConstructionProducts"
TEMP_COLLECTION_NAME = "ConstructionProducts_temp"

# ------------------------------
# STEP 1: Fetch PROD schema
# ------------------------------
print("Fetching production schema...")
resp = requests.get(f"{PROD_URL}/v1/schema/{COLLECTION_NAME}")
resp.raise_for_status()
schema = resp.json()

# ------------------------------
# STEP 2: Clean and apply schema to DEV
# ------------------------------
print("Cleaning and applying schema to dev...")
# Delete existing class in dev if it exists
del_resp = requests.delete(f"{DEV_URL}/v1/schema/{TEMP_COLLECTION_NAME}")
if del_resp.status_code not in (200, 404):
    print(f"Warning: could not delete {TEMP_COLLECTION_NAME} in dev:", del_resp.text)

# --- Apply all compatibility fixes ---
# 1. Enable the vectorizer
schema["vectorizer"] = "text2vec-openai"
schema["moduleConfig"] = {
    "text2vec-openai": {
        "vectorizeClassName": False
    }
}

# 3. Remove property-level moduleConfig and vectorConfig
for prop in schema.get("properties", []):
    if "moduleConfig" in prop:
        del prop["moduleConfig"]
    if "vectorConfig" in prop:
        del prop["vectorConfig"]

# 4. Remove conflicting vector index and vector configs
if "vectorIndexConfig" in schema:
    del schema["vectorIndexConfig"]
if "vectorConfig" in schema:
    del schema["vectorConfig"]

# 5. Change the class name to the temporary name
schema["class"] = TEMP_COLLECTION_NAME

# Create class
try:
    create_resp = requests.post(f"{DEV_URL}/v1/schema", json=schema)
    create_resp.raise_for_status()
    print(f"Class {TEMP_COLLECTION_NAME} created successfully.")
except requests.exceptions.HTTPError as e:
    print(f"FATAL: Error creating class {TEMP_COLLECTION_NAME}: {e}")
    print("Response body:", create_resp.json())
    # Stop the script if a class fails to create
    exit(1)

# ------------------------------
# STEP 3: Migrate objects by class
# ------------------------------
print(f"Migrating objects for class {COLLECTION_NAME}...")

offset = 0
total_processed = 0
total_failed = 0
while True:
    # Fetch batch from prod
    batch_resp = requests.get(
        f"{PROD_URL}/v1/objects",
        params={
            "class": COLLECTION_NAME,
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
            "class": TEMP_COLLECTION_NAME,
            "id": obj.get("id"),
            "properties": obj.get("properties")
        }

        headers = {"X-OpenAI-Api-Key": os.getenv("OPENAI_API_KEY")}
        for i in range(3):
            try:
                insert_resp = requests.post(f"{DEV_URL}/v1/objects", json=obj_to_insert, headers=headers, timeout=60)
                insert_resp.raise_for_status()
                total_processed += 1
                break
            except requests.exceptions.RequestException as e:
                if i == 2:
                    total_failed += 1
                    print(f"Error inserting object {obj.get('id')}: {e}. Failed after 3 retries.")
                else:
                    print(f"Error inserting object {obj.get('id')}: {e}. Retrying...")
                    time.sleep(2)

    offset += BATCH_SIZE
    print(f"Processed {total_processed} objects, failed {total_failed} objects.")
    time.sleep(SLEEP_BETWEEN_BATCHES)

# ------------------------------
# STEP 4: Delete old collection
# ------------------------------
print(f"Deleting old collection: {COLLECTION_NAME}...")
del_resp = requests.delete(f"{DEV_URL}/v1/schema/{COLLECTION_NAME}")
if del_resp.status_code not in (200, 404):
    print(f"Warning: could not delete {COLLECTION_NAME} in dev:", del_resp.text)

# ------------------------------
# STEP 5: Recreate the collection with the correct schema
# ------------------------------
print(f"Recreating {COLLECTION_NAME} with the correct schema...")
schema["class"] = COLLECTION_NAME
try:
    create_resp = requests.post(f"{DEV_URL}/v1/schema", json=schema)
    create_resp.raise_for_status()
    print(f"Class {COLLECTION_NAME} created successfully.")
except requests.exceptions.HTTPError as e:
    print(f"FATAL: Error creating class {COLLECTION_NAME}: {e}")
    print("Response body:", create_resp.json())
    # Stop the script if a class fails to create
    exit(1)

# ------------------------------
# STEP 6: Migrate the data from the temp collection to the new collection
# ------------------------------
print(f"Migrating data from {TEMP_COLLECTION_NAME} to {COLLECTION_NAME}...")
offset = 0
total_processed = 0
total_failed = 0
while True:
    # Fetch batch from temp collection
    batch_resp = requests.get(
        f"{DEV_URL}/v1/objects",
        params={
            "class": TEMP_COLLECTION_NAME,
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
            "class": COLLECTION_NAME,
            "id": obj.get("id"),
            "properties": obj.get("properties")
        }

        headers = {"X-OpenAI-Api-Key": os.getenv("OPENAI_API_KEY")}
        for i in range(3):
            try:
                insert_resp = requests.post(f"{DEV_URL}/v1/objects", json=obj_to_insert, headers=headers, timeout=60)
                insert_resp.raise_for_status()
                total_processed += 1
                break
            except requests.exceptions.RequestException as e:
                if i == 2:
                    total_failed += 1
                    print(f"Error inserting object {obj.get('id')}: {e}. Failed after 3 retries.")
                else:
                    print(f"Error inserting object {obj.get('id')}: {e}. Retrying...")
                    time.sleep(2)

    offset += BATCH_SIZE
    print(f"Processed {total_processed} objects, failed {total_failed} objects.")
    time.sleep(SLEEP_BETWEEN_BATCHES)

# ------------------------------
# STEP 7: Delete the temp collection
# ------------------------------
print(f"Deleting temp collection: {TEMP_COLLECTION_NAME}...")
del_resp = requests.delete(f"{DEV_URL}/v1/schema/{TEMP_COLLECTION_NAME}")
if del_resp.status_code not in (200, 404):
    print(f"Warning: could not delete {TEMP_COLLECTION_NAME} in dev:", del_resp.text)

print("Migration completed successfully.")