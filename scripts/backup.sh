#!/bin/bash
# Backup Script for Gym Access System

# Exit on error
set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_BACKUP_FILE="$BACKUP_DIR/gym_db_$TIMESTAMP.sql"
ARCHIVE_FILE="$BACKUP_DIR/gym_backup_$TIMESTAMP.tar.gz"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "[Backup] Starting Database Dump..."
# Use docker exec to run pg_dump inside the running postgres container
docker exec gym_postgres pg_dump -U gym_user -d gym_db > "$DB_BACKUP_FILE"

echo "[Backup] Zipping Database and Uploads..."
# Zip the database dump and the public/uploads directory together
tar -czf "$ARCHIVE_FILE" "$DB_BACKUP_FILE" ./public/uploads

# Cleanup the raw sql file
rm "$DB_BACKUP_FILE"

echo "[Backup] Successfully created archive at: $ARCHIVE_FILE"

# -------------------------------------------------------------
# TODO: Add your cloud copy command here
# Example AWS S3: aws s3 cp "$ARCHIVE_FILE" s3://my-gym-backups/
# Example rclone: rclone copy "$ARCHIVE_FILE" gdrive:gym-backups/
# -------------------------------------------------------------

echo "[Backup] Done."
