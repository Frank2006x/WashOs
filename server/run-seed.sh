#!/bin/bash
# Script to run seed.sql against Neon PostgreSQL database
# Reads DATABASE_URL from .env file

# Load environment variables from .env
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "Error: .env file not found"
    exit 1
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL not found in .env file"
    exit 1
fi

echo "🚀 Running seed.sql against Neon database..."
echo "Database: $DATABASE_URL"
echo ""

# Run the seed file
psql "$DATABASE_URL" -f sql/seed.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Seed data inserted successfully!"
else
    echo ""
    echo "❌ Error inserting seed data"
    exit 1
fi
