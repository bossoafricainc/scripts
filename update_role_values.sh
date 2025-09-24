#!/bin/bash

# Script to update role values in Firestore to uppercase

echo "Starting role value update process..."

# Change to the scripts directory
cd "$(dirname "$0")"

# Run the Node.js script
node update_role_values.js

echo "Role value update process completed."
