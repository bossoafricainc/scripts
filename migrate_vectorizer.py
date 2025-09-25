import requests
import json
import time
import os
from dotenv import load_dotenv

# ------------------------------
# CONFIGURATION
# ------------------------------
dotenv_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env.dev')
load_dotenv(dotenv_path=dotenv_path, override=True)
print(f"Loaded OPENAI_API_KEY: {os.getenv('OPENAI_API_KEY')}")

PROD_URL = "http://bella.thebosso.com:8090"
DEV_URL = "http://localhost:8095"
BATCH_SIZE = 100
SLEEP_BETWEEN_BATCHES = 0.1

# ------------------------------
# HELPER FUNCTIONS
# ------------------------------

def get_all_schemas(url):
    """Fetches all class schemas from a Weaviate instance."""
    print(f"Fetching all schemas from {url}...")
    try:
        resp = requests.get(f"{url}/v1/schema")
        resp.raise_for_status()
        return resp.json().get("classes", [])
    except requests.exceptions.RequestException as e:
        print(f"FATAL: Could not fetch schemas from {url}. Error: {e}")
        exit(1)

def get_class_object_count(url, class_name):
    """Gets the total number of objects in a class."""
    try:
        graphql_query = f'{{Aggregate{{{class_name}{{meta{{count}}}}}}}}'
        resp = requests.post(f"{url}/v1/graphql", json={"query": graphql_query})
        resp.raise_for_status()
        data = resp.json()
        if "errors" in data:
            if "Unrecognized input field" in data["errors"][0]["message"]:
                return 0
            else:
                print(f"Warning: GraphQL error for {class_name}: {data['errors']}")
                return -1
        return data.get("data", {}).get("Aggregate", {}).get(class_name, [{}])[0].get("meta", {}).get("count", 0)
    except requests.exceptions.RequestException:
        return -1

def migrate_class(prod_schema):
    """Migrates a single class from production to development if necessary."""
    class_name = prod_schema["class"]
    temp_class_name = f"{class_name}_temp"
    print(f"\n--- Processing class: {class_name} ---")

    # STEP 1: Determine if migration is needed by checking the DEV environment first
    dev_count = get_class_object_count(DEV_URL, class_name)
    
    if dev_count == -1:
        print(f"  Skipping '{class_name}' due to an error fetching object count from dev.")
        return

    migration_needed = False
    if class_name == "ConstructionProducts":
        vectorizer_correct = False
        try:
            dev_schema_resp = requests.get(f"{DEV_URL}/v1/schema/{class_name}")
            if dev_schema_resp.status_code == 200:
                dev_schema = dev_schema_resp.json()
                if dev_schema.get("vectorizer") == "text2vec-openai":
                    vectorizer_correct = True
                    print("  Dev schema for 'ConstructionProducts' has the correct 'text2vec-openai' vectorizer.")
                else:
                    print(f"  Dev schema for 'ConstructionProducts' has incorrect vectorizer: {dev_schema.get('vectorizer')}")
        except requests.exceptions.RequestException:
            print("  Could not fetch dev schema for 'ConstructionProducts'. Assuming it needs migration.")

        if not vectorizer_correct:
            migration_needed = True
            print(f"  Reason: 'ConstructionProducts' vectorizer is incorrect in dev.")
        elif dev_count == 0:
            prod_count_check = get_class_object_count(PROD_URL, class_name)
            if prod_count_check > 0:
                migration_needed = True
                print(f"  Reason: 'ConstructionProducts' is empty in dev but has data in prod.")
    else: # Logic for all other classes
        if dev_count == 0:
            prod_count_check = get_class_object_count(PROD_URL, class_name)
            if prod_count_check > 0:
                migration_needed = True
                print(f"  Reason: Class is empty in dev but has data in prod.")

    if not migration_needed:
        print(f"  Skipping '{class_name}': No migration needed.")
        return

    # STEP 2: Prepare schema, handling legacy format
    print(f"  Starting migration for '{class_name}'...")
    schema_to_use = prod_schema.copy()
    if class_name == "ConstructionProducts":
        print("  Applying vectorizer fix and cleaning legacy schema for 'ConstructionProducts'...")
        # Clean up all old and potentially conflicting keys
        schema_to_use.pop("moduleConfig", None)
        schema_to_use.pop("vectorConfig", None)
        schema_to_use.pop("vectorIndexConfig", None)
        # This is the legacy key you mentioned
        schema_to_use.pop("useText2Vec", None) 
        for prop in schema_to_use.get("properties", []):
            prop.pop("moduleConfig", None)
            prop.pop("vectorConfig", None)
        
        # Apply the new, correct configuration
        schema_to_use["vectorizer"] = "text2vec-openai"
        schema_to_use["moduleConfig"] = {"text2vec-openai": {"vectorizeClassName": False}}

    # STEP 3: Create temp collection
    print(f"  Creating temporary collection: '{temp_class_name}'...")
    requests.delete(f"{DEV_URL}/v1/schema/{temp_class_name}")
    temp_schema = schema_to_use.copy()
    temp_schema["class"] = temp_class_name
    try:
        create_resp = requests.post(f"{DEV_URL}/v1/schema", json=temp_schema)
        create_resp.raise_for_status()
    except requests.exceptions.HTTPError as e:
        print(f"  FATAL: Could not create temp class '{temp_class_name}'. Error: {e.response.text}")
        return

    # STEP 4: Migrate data from prod to temp
    prod_count = get_class_object_count(PROD_URL, class_name)
    print(f"  Migrating {prod_count} objects from '{class_name}' to '{temp_class_name}'...")
    migrate_data(class_name, temp_class_name, PROD_URL, DEV_URL)

    # STEP 5: Replace original collection
    print(f"  Replacing original collection '{class_name}'...")
    requests.delete(f"{DEV_URL}/v1/schema/{class_name}")
    final_schema = schema_to_use.copy()
    final_schema["class"] = class_name
    try:
        create_resp = requests.post(f"{DEV_URL}/v1/schema", json=final_schema)
        create_resp.raise_for_status()
    except requests.exceptions.HTTPError as e:
        print(f"  FATAL: Could not create final class '{class_name}'. Error: {e.response.text}")
        return

    # STEP 6: Migrate data from temp to final
    print(f"  Migrating data from temp to final collection...")
    migrate_data(temp_class_name, class_name, DEV_URL, DEV_URL)

    # STEP 7: Cleanup
    print(f"  Cleaning up temporary collection '{temp_class_name}'...")
    requests.delete(f"{DEV_URL}/v1/schema/{temp_class_name}")
    
    print(f"--- Finished migration for class: {class_name} ---")

def migrate_data(source_class, dest_class, source_url, dest_url):
    offset = 0
    total_processed = 0
    total_failed = 0
    headers = {"X-OpenAI-Api-Key": os.getenv("OPENAI_API_KEY")}

    while True:
        try:
            params = {"class": source_class, "limit": BATCH_SIZE, "offset": offset}
            batch_resp = requests.get(f"{source_url}/v1/objects", params=params)
            batch_resp.raise_for_status()
            objects = batch_resp.json().get("objects", [])
            if not objects:
                break

            for obj in objects:
                obj_to_insert = {"class": dest_class, "id": obj.get("id"), "properties": obj.get("properties")}
                for i in range(3):
                    try:
                        insert_resp = requests.post(f"{dest_url}/v1/objects", json=obj_to_insert, headers=headers, timeout=120)
                        insert_resp.raise_for_status()
                        total_processed += 1
                        break
                    except requests.exceptions.RequestException as e:
                        if i == 2:
                            total_failed += 1
                            print(f"    Error inserting object {obj.get('id')}: {e}. Failed after 3 retries.")
                        else:
                            time.sleep(2)
            
            offset += len(objects)
            print(f"    Processed: {total_processed}, Failed: {total_failed}")
            time.sleep(SLEEP_BETWEEN_BATCHES)

        except requests.exceptions.RequestException as e:
            print(f"    Error fetching batch from {source_class}: {e}. Retrying...")
            time.sleep(5)
    
    print(f"  Data migration complete for '{source_class}' -> '{dest_class}'.")

# ------------------------------
# MAIN EXECUTION
# ------------------------------
if __name__ == "__main__":
    all_prod_schemas = get_all_schemas(PROD_URL)
    if all_prod_schemas:
        for schema in all_prod_schemas:
            migrate_class(schema)
        print("\nFull migration process completed.")
    else:
        print("No schemas found on production. Nothing to migrate.")