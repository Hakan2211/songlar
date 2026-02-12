#!/bin/sh
# ====================================================================================
# Entrypoint Script
# Runs on every container start: migrations + first-time seeding
# ====================================================================================

# Exit on any error
set -e

# Set the path for a flag file that will be created in your persistent storage.
# This ensures it survives restarts and redeployments.
SETUP_COMPLETE_FLAG="/app/prisma/data/.setup_complete"

# Ensure the data directory exists
echo "--> ENTRYPOINT: Ensuring data directory exists..."
mkdir -p /app/prisma/data

# Run database migrations on every startup (safe and idempotent)
# Use prisma directly (env vars are injected by the container runtime, not .env.local)
echo "--> ENTRYPOINT: Running database migrations (db:deploy)..."
npx prisma migrate deploy

# Check if the setup flag file exists
if [ ! -f "$SETUP_COMPLETE_FLAG" ]; then
  # If the flag file does NOT exist, this is the first run
  echo "--> ENTRYPOINT: First time setup detected. Seeding the database..."
  npx tsx prisma/seed.ts
  
  # Create the flag file to prevent this block from running again
  echo "--> ENTRYPOINT: Seeding complete. Creating .setup_complete flag."
  touch "$SETUP_COMPLETE_FLAG"
else
  # If the flag file exists, skip the seed
  echo "--> ENTRYPOINT: Database already seeded. Skipping."
fi

# Hand off control to the main container command (npm run start)
echo "--> ENTRYPOINT: Starting application..."
exec "$@"
