#!/bin/bash

# Import test data into DynamoDB
# This script reads the generated JSON files and imports them into DynamoDB.
#
# Prerequisites:
#   - AWS CLI configured with appropriate credentials
#   - DynamoDB tables must already exist
#
# Usage: ./scripts/import-testdata.sh <judge_name> [testdata_dir]
# Example: ./scripts/import-testdata.sh codebreaker ./testdata

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <judge_name> [testdata_dir]"
  echo ""
  echo "Arguments:"
  echo "  judge_name    - The judge/environment name prefix for DynamoDB tables"
  echo "  testdata_dir  - Directory containing JSON files (default: ./testdata)"
  echo ""
  echo "Example:"
  echo "  $0 codebreaker"
  echo "  $0 codebreaker-prod ./testdata"
  exit 1
fi

JUDGE_NAME="$1"
TESTDATA_DIR="${2:-./testdata}"
REGION="${AWS_REGION:-ap-southeast-1}"

if [ ! -d "$TESTDATA_DIR" ]; then
  echo "Error: Test data directory '$TESTDATA_DIR' not found."
  echo "Run ./scripts/generate-testdata.sh first to generate test data."
  exit 1
fi

echo "Importing test data into DynamoDB..."
echo "  Judge Name: $JUDGE_NAME"
echo "  Region: $REGION"
echo "  Source: $TESTDATA_DIR"
echo ""

# Function to import a single table
import_table() {
  local json_file="$1"
  local table_suffix="$2"
  local table_name="${JUDGE_NAME}-${table_suffix}"

  if [ ! -f "$json_file" ]; then
    echo "  Skipping $table_suffix (file not found)"
    return
  fi

  echo "  Importing $table_suffix..."

  # Create a temporary file with the actual table name
  local tmp_file=$(mktemp)
  sed "s/{JudgeName}-${table_suffix}/${table_name}/g" "$json_file" > "$tmp_file"

  # Read items from JSON and import them one by one
  # DynamoDB batch-write-item has a limit of 25 items, so we process individually
  local item_count=$(jq '.items | length' "$tmp_file")

  for ((i=0; i<item_count; i++)); do
    local item=$(jq -c ".items[$i]" "$tmp_file")

    aws dynamodb put-item \
      --region "$REGION" \
      --table-name "$table_name" \
      --item "$item" \
      2>/dev/null || {
        echo "    Warning: Failed to import item $i to $table_name"
      }
  done

  rm -f "$tmp_file"
  echo "    Imported $item_count items"
}

# Import each table
import_table "$TESTDATA_DIR/users.json" "users"
import_table "$TESTDATA_DIR/contests.json" "contests"
import_table "$TESTDATA_DIR/problems.json" "problems"
import_table "$TESTDATA_DIR/submissions.json" "submissions"
import_table "$TESTDATA_DIR/announcements.json" "announcements"
import_table "$TESTDATA_DIR/clarifications.json" "clarifications"
import_table "$TESTDATA_DIR/counters.json" "global-counters"

echo ""
echo "Import complete!"
echo ""
echo "Test accounts:"
echo "  admin / (use Cognito for auth)"
echo "  alice / (use Cognito for auth)"
echo "  bob / (use Cognito for auth)"
echo "  charlie / (use Cognito for auth)"
echo "  diana / (use Cognito for auth)"
echo "  eve / (use Cognito for auth)"
