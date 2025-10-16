#!/bin/bash

# Esoteric Loans - AWS Cleanup Script
# This script cleans up all AWS resources created by the deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="us-east-1"
ECR_REPOSITORY="esoteric-backend"
CLUSTER_NAME="esoteric-cluster"
SERVICE_NAME="esoteric-service"
ALB_NAME="esoteric-alb"
DB_IDENTIFIER="esoteric-postgres-east"

print_header() {
    echo -e "${BLUE}=================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}=================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_header "AWS Resource Cleanup"

echo ""
print_warning "This will delete ALL AWS resources created by the Esoteric deployment:"
print_info "• ECS Service and Cluster"
print_info "• Application Load Balancer and Target Groups"
print_info "• RDS PostgreSQL Database"
print_info "• S3 Buckets (frontend hosting)"
print_info "• ECR Repository and Docker images"
print_info "• Security Groups"
print_info "• IAM Roles"
print_info "• CloudWatch Log Groups"
echo ""
print_warning "💰 This action is IRREVERSIBLE and will delete all data!"
echo ""

read -p "Are you sure you want to continue? Type 'DELETE' to confirm: " -r
echo
if [ "$REPLY" != "DELETE" ]; then
    echo "Cleanup cancelled."
    exit 0
fi

# Delete ECS Service
print_header "Cleaning up ECS Resources"
if aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $AWS_REGION &> /dev/null; then
    print_info "Scaling down ECS service..."
    aws ecs update-service --cluster $CLUSTER_NAME --service $SERVICE_NAME --desired-count 0 --region $AWS_REGION &> /dev/null
    
    print_info "Waiting for tasks to stop..."
    aws ecs wait services-stable --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $AWS_REGION
    
    print_info "Deleting ECS service..."
    aws ecs delete-service --cluster $CLUSTER_NAME --service $SERVICE_NAME --region $AWS_REGION &> /dev/null
    print_success "ECS service deleted"
else
    print_info "ECS service not found"
fi

# Delete ECS Cluster
if aws ecs describe-clusters --clusters $CLUSTER_NAME --region $AWS_REGION &> /dev/null; then
    print_info "Deleting ECS cluster..."
    aws ecs delete-cluster --cluster $CLUSTER_NAME --region $AWS_REGION &> /dev/null
    print_success "ECS cluster deleted"
fi

# Delete Load Balancer
print_header "Cleaning up Load Balancer"
ALB_ARN=$(aws elbv2 describe-load-balancers --names $ALB_NAME --region $AWS_REGION --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null || echo "None")
if [ "$ALB_ARN" != "None" ]; then
    print_info "Deleting load balancer..."
    aws elbv2 delete-load-balancer --load-balancer-arn $ALB_ARN --region $AWS_REGION
    
    print_info "Waiting for load balancer to be deleted..."
    aws elbv2 wait load-balancer-deleted --load-balancer-arns $ALB_ARN --region $AWS_REGION
    print_success "Load balancer deleted"
fi

# Delete Target Groups
TG_ARN=$(aws elbv2 describe-target-groups --names esoteric-tg --region $AWS_REGION --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || echo "None")
if [ "$TG_ARN" != "None" ]; then
    print_info "Deleting target group..."
    aws elbv2 delete-target-group --target-group-arn $TG_ARN --region $AWS_REGION
    print_success "Target group deleted"
fi

# Delete RDS Database
print_header "Cleaning up Database"
if aws rds describe-db-instances --db-instance-identifier $DB_IDENTIFIER --region $AWS_REGION &> /dev/null; then
    print_info "Deleting RDS database (this may take several minutes)..."
    aws rds delete-db-instance \
        --db-instance-identifier $DB_IDENTIFIER \
        --skip-final-snapshot \
        --delete-automated-backups \
        --region $AWS_REGION
    
    print_info "Waiting for database to be deleted..."
    aws rds wait db-instance-deleted --db-instance-identifier $DB_IDENTIFIER --region $AWS_REGION
    print_success "RDS database deleted"
else
    print_info "RDS database not found"
fi

# Delete S3 Buckets
print_header "Cleaning up S3 Buckets"
S3_BUCKETS=$(aws s3api list-buckets --query 'Buckets[?contains(Name, `esoteric-frontend`)].Name' --output text)
if [ -n "$S3_BUCKETS" ]; then
    for bucket in $S3_BUCKETS; do
        print_info "Deleting S3 bucket: $bucket"
        aws s3 rm s3://$bucket --recursive --region $AWS_REGION
        aws s3api delete-bucket --bucket $bucket --region $AWS_REGION
        print_success "S3 bucket $bucket deleted"
    done
else
    print_info "No Esoteric S3 buckets found"
fi

# Delete ECR Repository
print_header "Cleaning up ECR Repository"
if aws ecr describe-repositories --repository-names $ECR_REPOSITORY --region $AWS_REGION &> /dev/null; then
    print_info "Deleting ECR repository..."
    aws ecr delete-repository --repository-name $ECR_REPOSITORY --force --region $AWS_REGION
    print_success "ECR repository deleted"
else
    print_info "ECR repository not found"
fi

# Delete Security Groups
print_header "Cleaning up Security Groups"
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --region $AWS_REGION --query 'Vpcs[0].VpcId' --output text)

# Delete ECS Security Group
ECS_SG_ID=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=esoteric-ecs-sg" --region $AWS_REGION --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "None")
if [ "$ECS_SG_ID" != "None" ]; then
    print_info "Deleting ECS security group..."
    aws ec2 delete-security-group --group-id $ECS_SG_ID --region $AWS_REGION
    print_success "ECS security group deleted"
fi

# Delete ALB Security Group
ALB_SG_ID=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=esoteric-alb-sg" --region $AWS_REGION --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "None")
if [ "$ALB_SG_ID" != "None" ]; then
    print_info "Deleting ALB security group..."
    aws ec2 delete-security-group --group-id $ALB_SG_ID --region $AWS_REGION
    print_success "ALB security group deleted"
fi

# Delete IAM Role
print_header "Cleaning up IAM Resources"
if aws iam get-role --role-name ecsTaskExecutionRole &> /dev/null; then
    print_info "Detaching policies from ECS execution role..."
    aws iam detach-role-policy --role-name ecsTaskExecutionRole --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
    
    print_info "Deleting ECS execution role..."
    aws iam delete-role --role-name ecsTaskExecutionRole
    print_success "ECS execution role deleted"
fi

# Delete CloudWatch Log Groups
print_header "Cleaning up CloudWatch Logs"
if aws logs describe-log-groups --log-group-name-prefix "/ecs/esoteric" --region $AWS_REGION &> /dev/null; then
    LOG_GROUPS=$(aws logs describe-log-groups --log-group-name-prefix "/ecs/esoteric" --region $AWS_REGION --query 'logGroups[].logGroupName' --output text)
    for log_group in $LOG_GROUPS; do
        print_info "Deleting log group: $log_group"
        aws logs delete-log-group --log-group-name $log_group --region $AWS_REGION
        print_success "Log group $log_group deleted"
    done
else
    print_info "No Esoteric log groups found"
fi

# Clean up local files
print_header "Cleaning up Local Files"
if [ -f "aws-deployment-info.txt" ]; then
    rm aws-deployment-info.txt
    print_success "Deployment info file deleted"
fi

print_header "Cleanup Complete!"
echo ""
print_success "🧹 All AWS resources have been cleaned up successfully!"
print_success "💰 You should no longer be charged for Esoteric resources"
echo ""
print_info "Note: It may take a few minutes for billing to reflect the changes"
print_info "Double-check your AWS console to ensure all resources are deleted"