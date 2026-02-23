#!/bin/bash
# scripts/test-migration.sh

# Use streamfi_test as the default local database if not specified
DB_URL=${DATABASE_URL:-streamfi_test}

echo "Querying 'users' table columns:"
psql $DB_URL -c "\d users" | grep -E "total_tips_received|total_tips_count|last_tip_at"

echo ""
echo "Checking default values for existing users (first 5):"
psql $DB_URL -c "SELECT email, total_tips_received, total_tips_count, last_tip_at FROM users LIMIT 5;"

