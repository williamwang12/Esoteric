#!/bin/bash

# AWS Database Setup Script
# This script sets up the database schema on the AWS RDS instance

set -e

echo "🗄️ Setting up AWS RDS Database Schema..."

# Configuration
DB_INSTANCE_ID="esoteric-postgres"
DB_NAME="esoteric_loans"
DB_USER="postgres"
DB_PASSWORD="EsotericDB2024!"

# Get database endpoint
DB_ENDPOINT=$(aws rds describe-db-instances --db-instance-identifier $DB_INSTANCE_ID --query 'DBInstances[0].Endpoint.Address' --output text)

if [ "$DB_ENDPOINT" == "None" ] || [ -z "$DB_ENDPOINT" ]; then
    echo "❌ Could not find RDS instance: $DB_INSTANCE_ID"
    echo "Please ensure the database is created and available."
    exit 1
fi

echo "📡 Connecting to: $DB_ENDPOINT"

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL client (psql) is not installed."
    echo "Install it with: brew install postgresql"
    exit 1
fi

# Test connection
echo "🔌 Testing database connection..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_ENDPOINT -U $DB_USER -d $DB_NAME -c "SELECT version();" > /dev/null

if [ $? -eq 0 ]; then
    echo "✅ Database connection successful"
else
    echo "❌ Failed to connect to database"
    exit 1
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Run schema setup
echo "🏗️ Creating database schema..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_ENDPOINT -U $DB_USER -d $DB_NAME -f "$PROJECT_ROOT/database/schema.sql"

# Run migrations
echo "📈 Running database migrations..."
for migration in "$PROJECT_ROOT/database/migrations"/*.sql; do
    if [ -f "$migration" ]; then
        echo "  - Running $(basename $migration)..."
        PGPASSWORD=$DB_PASSWORD psql -h $DB_ENDPOINT -U $DB_USER -d $DB_NAME -f "$migration"
    fi
done

# Create admin user
echo "👤 Creating admin user..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_ENDPOINT -U $DB_USER -d $DB_NAME << EOF
-- Create admin user if not exists
INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified, account_verified)
VALUES (
    'demo@esoteric.com',
    '\$2b\$10\$8K1p/a0dNdvV4FwQGBAULuJt8DoE96STgKaoCrQFW4yjc5K1gf8Ma', -- password: admin123
    'Admin',
    'User',
    'admin',
    true,
    true
) ON CONFLICT (email) DO NOTHING;
EOF

echo "✅ Database setup completed!"
echo ""
echo "Database Information:"
echo "  Host: $DB_ENDPOINT"
echo "  Database: $DB_NAME"
echo "  Username: $DB_USER"
echo ""
echo "Admin Login:"
echo "  Email: demo@esoteric.com"
echo "  Password: admin123"