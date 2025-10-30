#!/bin/bash

# Database Migration Script for AWS RDS
# Usage: ./migrate-database.sh [staging|production] [--from-docker]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
DATABASE_DIR="$PROJECT_DIR/database"

# Default environment
ENVIRONMENT=${1:-staging}
FROM_DOCKER=false

# Parse arguments
if [[ "$2" == "--from-docker" ]]; then
    FROM_DOCKER=true
fi

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo -e "${RED}Error: Environment must be 'staging' or 'production'${NC}"
    echo "Usage: $0 [staging|production] [--from-docker]"
    exit 1
fi

echo -e "${BLUE}🗄️  Migrating database for ${ENVIRONMENT}...${NC}"
if [ "$FROM_DOCKER" = true ]; then
    echo -e "${YELLOW}📦 Will export data from local Docker first${NC}"
fi

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed${NC}"
    exit 1
fi

if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL client (psql) is not installed${NC}"
    exit 1
fi

if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Get database credentials from CloudFormation stack outputs
echo -e "${YELLOW}📡 Getting RDS connection details...${NC}"
AWS_REGION="us-east-1"

DB_HOST=$(aws cloudformation describe-stacks \
    --stack-name "EsotericStack-${ENVIRONMENT}" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' \
    --output text)

if [ -z "$DB_HOST" ]; then
    echo -e "${RED}❌ Could not get database endpoint. Make sure the infrastructure is deployed.${NC}"
    exit 1
fi

# Get secrets manager ARN
SECRETS_ARN=$(aws cloudformation describe-stacks \
    --stack-name "EsotericStack-${ENVIRONMENT}" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`SecretsManagerArn`].OutputValue' \
    --output text)

# Get database secret (the DB credentials secret will have a different ARN pattern)
DB_SECRET_ID=$(aws secretsmanager list-secrets \
    --query "SecretList[?contains(Name, 'DatabaseSecret')].ARN" \
    --output text | head -1)

if [ -z "$DB_SECRET_ID" ]; then
    echo -e "${RED}❌ Could not find database credentials secret${NC}"
    exit 1
fi

# Get credentials from secrets manager
DB_SECRET=$(aws secretsmanager get-secret-value --secret-id "$DB_SECRET_ID" --query SecretString --output text)
DB_PASSWORD=$(echo "$DB_SECRET" | jq -r '.password')
DB_USER="postgres"
DB_PORT="5432"
DB_NAME="esoteric_loans"

echo -e "${GREEN}✅ Retrieved RDS credentials successfully${NC}"
echo -e "${BLUE}Database Host: ${DB_HOST}${NC}"
echo -e "${BLUE}Database Name: ${DB_NAME}${NC}"

# Create connection string
export PGPASSWORD="$DB_PASSWORD"
RDS_CONN="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"

# Test connection
echo -e "${YELLOW}Testing RDS connection...${NC}"
if ! $RDS_CONN -c "SELECT 1;" &> /dev/null; then
    echo -e "${RED}Failed to connect to RDS database${NC}"
    echo -e "${RED}Please check your VPC configuration and security groups${NC}"
    exit 1
fi
echo -e "${GREEN}RDS connection successful${NC}"

# Export data from Docker if requested
if [ "$FROM_DOCKER" = true ]; then
    echo -e "${YELLOW}📦 Exporting data from local Docker database...${NC}"
    
    # Check if Docker container is running
    if ! docker ps --format "table {{.Names}}" | grep -q "esoteric.*postgres"; then
        echo -e "${RED}❌ Docker PostgreSQL container is not running${NC}"
        echo -e "${RED}Please start your local environment first with 'docker-compose up'${NC}"
        exit 1
    fi
    
    # Create backup directory
    BACKUP_DIR="$DATABASE_DIR/backups"
    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="$BACKUP_DIR/docker-export-$(date +%Y%m%d-%H%M%S).sql"
    
    echo -e "${YELLOW}Creating data dump from Docker...${NC}"
    CONTAINER_NAME=$(docker ps --format "table {{.Names}}" | grep "esoteric.*postgres" | head -1)
    docker exec "$CONTAINER_NAME" pg_dump -U postgres -d esoteric_loans --data-only --inserts > "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Data exported to: ${BACKUP_FILE}${NC}"
    else
        echo -e "${RED}❌ Failed to export data from Docker${NC}"
        exit 1
    fi
fi

# Apply schema to RDS
echo -e "${YELLOW}🏗️  Applying database schema to RDS...${NC}"

if [ -f "$DATABASE_DIR/fresh-schema.sql" ]; then
    echo -e "${YELLOW}Applying fresh schema...${NC}"
    $RDS_CONN -f "$DATABASE_DIR/fresh-schema.sql"
    echo -e "${GREEN}✅ Schema applied successfully${NC}"
else
    echo -e "${RED}❌ Schema file not found: $DATABASE_DIR/fresh-schema.sql${NC}"
    exit 1
fi

# Apply migrations if they exist
echo -e "${YELLOW}🔄 Checking for additional migrations...${NC}"

if [ -d "$DATABASE_DIR/migrations" ]; then
    for migration in "$DATABASE_DIR/migrations"/*.sql; do
        if [ -f "$migration" ]; then
            echo -e "${YELLOW}Applying migration: $(basename "$migration")${NC}"
            $RDS_CONN -f "$migration"
        fi
    done
    echo -e "${GREEN}✅ Migrations applied successfully${NC}"
else
    echo -e "${YELLOW}⚠️  No migrations directory found, skipping migrations${NC}"
fi

# Import data if backup file exists
if [ "$FROM_DOCKER" = true ] && [ -f "$BACKUP_FILE" ]; then
    echo -e "${YELLOW}📥 Importing data to RDS...${NC}"
    
    # Remove CREATE DATABASE and other statements that might conflict
    CLEAN_BACKUP_FILE="${BACKUP_FILE}.clean"
    grep -v "^CREATE DATABASE" "$BACKUP_FILE" | \
    grep -v "^\\connect" | \
    grep -v "^ALTER DATABASE" > "$CLEAN_BACKUP_FILE"
    
    $RDS_CONN -f "$CLEAN_BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Data imported successfully${NC}"
        rm "$CLEAN_BACKUP_FILE"
    else
        echo -e "${RED}❌ Failed to import data${NC}"
        exit 1
    fi
fi

# Verify migration
echo -e "${YELLOW}🔍 Verifying database setup...${NC}"

# Check if tables exist
TABLES=$($RDS_CONN -t -c "SELECT tablename FROM pg_tables WHERE schemaname='public';" | grep -v "^$" | wc -l)
echo -e "${BLUE}Found ${TABLES} tables in the database${NC}"

if [ "$TABLES" -gt 0 ]; then
    echo -e "${GREEN}✅ Database migration completed successfully!${NC}"
    
    # Show table list
    echo -e "${BLUE}📋 Tables in database:${NC}"
    $RDS_CONN -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;"
    
    # Show record counts for key tables
    echo -e "${BLUE}📊 Record counts:${NC}"
    $RDS_CONN -c "
        SELECT 
            tablename,
            (xpath('/row/cnt/text()', xml_count))[1]::text::int as record_count
        FROM (
            SELECT 
                tablename, 
                query_to_xml(format('SELECT count(*) as cnt FROM %I', tablename), false, true, '') as xml_count
            FROM pg_tables 
            WHERE schemaname = 'public' 
            ORDER BY tablename
        ) t;
    "
else
    echo -e "${RED}❌ No tables found in database. Migration may have failed.${NC}"
    exit 1
fi

# Cleanup
unset PGPASSWORD

echo ""
echo -e "${GREEN}🎉 Database Migration Complete!${NC}"
echo -e "${BLUE}Database Host: ${DB_HOST}${NC}"
echo -e "${BLUE}Database Name: ${DB_NAME}${NC}"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "   1. Your ECS application is already configured to use this RDS endpoint"
echo "   2. Deploy your application using: ./scripts/build-and-push.sh $ENVIRONMENT"
echo "   3. Monitor application logs for database connectivity"
echo "   4. Test the application functionality"

if [ "$FROM_DOCKER" = true ]; then
    echo "   5. Once verified, you can stop using the local Docker database"
fi