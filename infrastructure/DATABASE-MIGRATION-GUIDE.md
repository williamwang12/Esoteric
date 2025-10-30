# Database Migration Guide: Docker to RDS

This guide walks you through migrating your Esoteric application database from Docker PostgreSQL to AWS RDS PostgreSQL.

## Overview

The migration process involves:
1. Setting up RDS PostgreSQL instance via CDK
2. Exporting data from Docker PostgreSQL
3. Creating schema in RDS
4. Importing data to RDS
5. Updating application configuration
6. Testing and verification

## Prerequisites

- AWS CDK infrastructure deployed
- Local Docker environment running
- PostgreSQL client tools installed
- AWS CLI configured
- Access to both Docker and RDS databases

## Migration Steps

### Step 1: Deploy RDS Infrastructure

First, ensure your RDS instance is deployed:

```bash
cd infrastructure
./scripts/deploy.sh staging
```

This creates:
- RDS PostgreSQL instance
- Security groups and networking
- Database credentials in Secrets Manager

### Step 2: Verify RDS Connectivity

Test connection to your new RDS instance:

```bash
# Get database credentials
aws secretsmanager get-secret-value --secret-id esoteric-db-credentials-staging

# Test connection (replace with actual values)
psql -h your-rds-endpoint.rds.amazonaws.com -U postgres -d esoteric_loans
```

### Step 3: Export Data from Docker

#### Option A: Automated Migration Script

Use the provided migration script:

```bash
./scripts/migrate-database.sh staging --from-docker
```

This script automatically:
- Exports data from Docker PostgreSQL
- Applies schema to RDS
- Imports data to RDS
- Verifies the migration

#### Option B: Manual Migration

If you prefer manual control:

1. **Export Docker Database**
   ```bash
   # Full database dump including schema
   docker exec esoteric-postgres pg_dump -U postgres -d esoteric_loans > full_backup.sql
   
   # Data-only dump (recommended if schema differs)
   docker exec esoteric-postgres pg_dump -U postgres -d esoteric_loans --data-only --inserts > data_backup.sql
   
   # Schema-only dump
   docker exec esoteric-postgres pg_dump -U postgres -d esoteric_loans --schema-only > schema_backup.sql
   ```

2. **Verify Export**
   ```bash
   # Check file size and content
   ls -lh *backup.sql
   head -n 20 data_backup.sql
   ```

### Step 4: Prepare RDS Database

1. **Apply Fresh Schema**
   ```bash
   # Get RDS connection details from Secrets Manager
   SECRET_ARN=$(aws cloudformation describe-stacks --stack-name EsotericStack-staging --query "Stacks[0].Outputs[?OutputKey=='SecretsManagerArn'].OutputValue" --output text)
   DB_SECRET=$(aws secretsmanager get-secret-value --secret-id $SECRET_ARN --query SecretString --output text)
   
   # Extract connection details
   DB_HOST=$(echo $DB_SECRET | jq -r '.host')
   DB_PORT=$(echo $DB_SECRET | jq -r '.port')
   DB_NAME=$(echo $DB_SECRET | jq -r '.dbname')
   DB_USER=$(echo $DB_SECRET | jq -r '.username')
   DB_PASSWORD=$(echo $DB_SECRET | jq -r '.password')
   
   # Set password for psql
   export PGPASSWORD=$DB_PASSWORD
   
   # Apply schema
   psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f database/fresh-schema.sql
   ```

2. **Apply Migrations**
   ```bash
   # Apply any additional migrations
   for migration in database/migrations/*.sql; do
       echo "Applying $migration"
       psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$migration"
   done
   ```

### Step 5: Import Data to RDS

1. **Clean Data Dump** (if needed)
   ```bash
   # Remove problematic statements that might conflict
   grep -v "^CREATE DATABASE" data_backup.sql | \
   grep -v "^\\connect" | \
   grep -v "^ALTER DATABASE" > clean_data_backup.sql
   ```

2. **Import Data**
   ```bash
   psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f clean_data_backup.sql
   ```

3. **Verify Import**
   ```bash
   # Check table counts
   psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
   SELECT 
       schemaname,
       tablename,
       n_tup_ins as row_count
   FROM pg_stat_user_tables 
   ORDER BY tablename;"
   
   # Compare with Docker database
   docker exec esoteric-postgres psql -U postgres -d esoteric_loans -c "
   SELECT 
       schemaname,
       tablename,
       n_tup_ins as row_count
   FROM pg_stat_user_tables 
   ORDER BY tablename;"
   ```

### Step 6: Update Application Configuration

1. **Update Environment Variables**
   
   The CDK deployment automatically configures ECS to use RDS credentials from Secrets Manager. No manual configuration needed for containerized deployment.

2. **For Local Development** (optional)
   
   Create a `.env.rds` file for testing with RDS:
   ```bash
   DB_HOST=your-rds-endpoint.rds.amazonaws.com
   DB_PORT=5432
   DB_NAME=esoteric_loans
   DB_USER=postgres
   DB_PASSWORD=your-rds-password
   JWT_SECRET=your-jwt-secret
   NODE_ENV=development
   PORT=5002
   FRONTEND_URL=http://localhost:3000
   ```

### Step 7: Test Application

1. **Deploy Updated Application**
   ```bash
   ./scripts/build-and-push.sh staging
   ```

2. **Monitor Logs**
   ```bash
   aws logs tail /ecs/esoteric-backend --follow
   ```

3. **Test Database Operations**
   - User registration/login
   - Data retrieval
   - Transaction creation
   - File uploads

### Step 8: Validation and Cleanup

1. **Data Integrity Check**
   ```sql
   -- Check user count
   SELECT COUNT(*) FROM users;
   
   -- Check loan accounts
   SELECT COUNT(*) FROM loan_accounts;
   
   -- Check transactions
   SELECT COUNT(*) FROM loan_transactions;
   
   -- Check referential integrity
   SELECT COUNT(*) FROM loan_accounts la 
   LEFT JOIN users u ON la.user_id = u.id 
   WHERE u.id IS NULL;
   ```

2. **Performance Verification**
   ```sql
   -- Check for missing indexes
   SELECT schemaname, tablename, indexname 
   FROM pg_indexes 
   WHERE schemaname = 'public'
   ORDER BY tablename;
   
   -- Analyze tables for statistics
   ANALYZE;
   ```

3. **Backup Verification**
   ```bash
   # Create a test backup of RDS
   pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME > rds_verification_backup.sql
   
   # Compare backup sizes
   ls -lh *backup.sql
   ```

## Rollback Plan

If issues arise, you can rollback to Docker:

1. **Stop ECS Service**
   ```bash
   aws ecs update-service --cluster esoteric-cluster --service esoteric-backend --desired-count 0
   ```

2. **Start Docker Environment**
   ```bash
   cd /path/to/esoteric
   docker-compose up -d
   ```

3. **Update Load Balancer** (if needed)
   Point traffic back to Docker container

## Post-Migration Tasks

### 1. Database Optimization

```sql
-- Update table statistics
ANALYZE;

-- Check for unused indexes
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE idx_tup_read = 0 AND idx_tup_fetch = 0;

-- Vacuum to reclaim space
VACUUM ANALYZE;
```

### 2. Monitoring Setup

1. **Enable Performance Insights** (if not already enabled)
2. **Set up CloudWatch Alarms**
   - CPU utilization > 80%
   - Connection count > 80% of max
   - Free storage space < 2GB

3. **Database Metrics Dashboard**
   ```bash
   # Example CloudWatch insights query
   aws logs start-query --log-group-name "/aws/rds/instance/your-db-instance/postgresql" \
   --start-time $(date -d "1 hour ago" +%s) \
   --end-time $(date +%s) \
   --query-string "fields @timestamp, @message | filter @message like /ERROR/"
   ```

### 3. Backup Strategy

1. **Automated Backups** (configured in CDK)
   - 7-day retention for staging
   - 30-day retention for production

2. **Manual Backup Script**
   ```bash
   #!/bin/bash
   DATE=$(date +%Y%m%d_%H%M%S)
   pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME > "backup_${DATE}.sql"
   aws s3 cp "backup_${DATE}.sql" s3://your-backup-bucket/database-backups/
   ```

### 4. Security Hardening

1. **Review Security Groups**
   - Ensure only ECS tasks can access RDS
   - Remove any temporary access rules

2. **Audit Database Users**
   ```sql
   SELECT usename, usesuper, usecreatedb, usebypassrls 
   FROM pg_user;
   ```

3. **Enable Query Logging** (if needed for compliance)
   ```sql
   -- Enable in parameter group
   -- log_statement = 'all'
   -- log_min_duration_statement = 1000
   ```

## Troubleshooting

### Common Issues

1. **Connection Timeout**
   - Check security group rules
   - Verify VPC connectivity
   - Ensure RDS is in correct subnets

2. **Permission Denied**
   - Verify database credentials
   - Check user permissions
   - Ensure password is correct

3. **Data Import Errors**
   - Check for character encoding issues
   - Verify constraint violations
   - Review foreign key dependencies

4. **Performance Issues**
   - Monitor Connection counts
   - Check for lock contention
   - Analyze slow query logs

### Debug Commands

```bash
# Check RDS instance status
aws rds describe-db-instances --db-instance-identifier your-db-instance

# Monitor connections
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT datname, numbackends, xact_commit, xact_rollback 
FROM pg_stat_database 
WHERE datname = 'esoteric_loans';"

# Check table sizes
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

## Best Practices

1. **Always test migration in staging first**
2. **Backup before and after migration**
3. **Monitor application metrics during migration**
4. **Plan for rollback scenarios**
5. **Validate data integrity thoroughly**
6. **Update documentation and runbooks**
7. **Train team on RDS operations**

## Support

For migration issues:
1. Check RDS logs in CloudWatch
2. Review application logs in ECS
3. Verify network connectivity
4. Contact AWS Support if needed

Remember to clean up temporary files and Docker volumes after successful migration to save disk space.