#!/bin/bash
# Restore Script for Gym Access System

set -e

if [ -z "$1" ]; then
  echo "Usage: ./scripts/restore.sh <path_to_tar_gz>"
  exit 1
fi

ARCHIVE_FILE=$1
TMP_DIR="./tmp_restore"

echo "[Restore] Extracting archive..."
mkdir -p "$TMP_DIR"
tar -xzf "$ARCHIVE_FILE" -C "$TMP_DIR"

# Find the SQL file inside the extracted temp directory
SQL_FILE=$(find "$TMP_DIR" -name "*.sql" | head -n 1)

if [ -z "$SQL_FILE" ]; then
  echo "[Error] No .sql file found in the archive."
  rm -rf "$TMP_DIR"
  exit 1
fi

echo "[Restore] Dropping existing public schema to ensure a clean slate..."
docker exec gym_postgres psql -U gym_user -d gym_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "[Restore] Restoring database from $SQL_FILE..."
cat "$SQL_FILE" | docker exec -i gym_postgres psql -U gym_user -d gym_db

echo "[Restore] Restoring uploads..."
# The tar structure maintains `./public/uploads`, so we copy it over
cp -r "$TMP_DIR/public/uploads" ./public/

echo "[Restore] Cleaning up..."
rm -rf "$TMP_DIR"

echo "[Restore] Successfully restored database and photos!"
