#!/bin/bash

# Esoteric Loans - Custom Domain Setup Script
# This script configures a custom domain with SSL for your AWS deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="us-east-1"
ALB_NAME="esoteric-alb"

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

# Get domain name from user
get_domain_info() {
    print_header "Domain Configuration"
    
    echo ""
    print_info "Enter your domain information:"
    echo ""
    
    read -p "Domain name (e.g., mycompany.com): " DOMAIN_NAME
    read -p "Subdomain for frontend (e.g., app or www): " FRONTEND_SUBDOMAIN
    read -p "Subdomain for API (e.g., api): " API_SUBDOMAIN
    
    if [[ -z "$DOMAIN_NAME" ]]; then
        print_error "Domain name is required"
        exit 1
    fi
    
    # Set defaults if not provided
    FRONTEND_SUBDOMAIN=${FRONTEND_SUBDOMAIN:-app}
    API_SUBDOMAIN=${API_SUBDOMAIN:-api}
    
    FRONTEND_DOMAIN="$FRONTEND_SUBDOMAIN.$DOMAIN_NAME"
    API_DOMAIN="$API_SUBDOMAIN.$DOMAIN_NAME"
    
    echo ""
    print_info "Configuration:"
    print_info "  Domain: $DOMAIN_NAME"
    print_info "  Frontend: https://$FRONTEND_DOMAIN"
    print_info "  API: https://$API_DOMAIN"
    echo ""
    
    read -p "Continue with this configuration? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 0
    fi
}

create_hosted_zone() {
    print_header "Setting up Route 53 Hosted Zone"
    
    # Check if hosted zone already exists
    HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name --dns-name $DOMAIN_NAME --region $AWS_REGION --query 'HostedZones[0].Id' --output text 2>/dev/null || echo "None")
    
    if [[ "$HOSTED_ZONE_ID" == "None" || "$HOSTED_ZONE_ID" == "null" ]]; then
        print_info "Creating hosted zone for $DOMAIN_NAME..."
        CALLER_REFERENCE=$(date +%s)
        HOSTED_ZONE_ID=$(aws route53 create-hosted-zone \
            --name $DOMAIN_NAME \
            --caller-reference $CALLER_REFERENCE \
            --query 'HostedZone.Id' \
            --output text)
        print_success "Hosted zone created: $HOSTED_ZONE_ID"
    else
        print_info "Hosted zone already exists: $HOSTED_ZONE_ID"
    fi
    
    # Clean up the zone ID (remove /hostedzone/ prefix)
    HOSTED_ZONE_ID=$(echo $HOSTED_ZONE_ID | sed 's|/hostedzone/||')
    
    # Get name servers
    NAME_SERVERS=$(aws route53 get-hosted-zone --id $HOSTED_ZONE_ID --query 'DelegationSet.NameServers' --output text | tr '\t' '\n')
    
    echo ""
    print_warning "IMPORTANT: Update your domain registrar with these name servers:"
    echo "$NAME_SERVERS" | while read ns; do
        print_info "  $ns"
    done
    echo ""
    print_warning "This change may take up to 48 hours to propagate worldwide"
    echo ""
    
    read -p "Have you updated your domain registrar's name servers? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Please update your name servers and run this script again"
        exit 0
    fi
}

request_ssl_certificate() {
    print_header "Requesting SSL Certificate"
    
    print_info "Requesting SSL certificate for $DOMAIN_NAME and subdomains..."
    
    # Request certificate with Subject Alternative Names
    CERT_ARN=$(aws acm request-certificate \
        --domain-name $DOMAIN_NAME \
        --subject-alternative-names "*.$DOMAIN_NAME" \
        --validation-method DNS \
        --region $AWS_REGION \
        --query 'CertificateArn' \
        --output text)
    
    print_success "Certificate requested: $CERT_ARN"
    
    print_info "Waiting for certificate details..."
    sleep 10
    
    # Get DNS validation records
    print_info "Getting DNS validation records..."
    aws acm describe-certificate --certificate-arn $CERT_ARN --region $AWS_REGION \
        --query 'Certificate.DomainValidationOptions[].ResourceRecord' \
        --output table
    
    print_warning "You need to add the DNS validation records above to your Route 53 hosted zone"
    print_info "This can be done automatically. Continue?"
    
    read -p "Add DNS validation records automatically? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Get validation records and add them to Route 53
        VALIDATION_RECORDS=$(aws acm describe-certificate \
            --certificate-arn $CERT_ARN \
            --region $AWS_REGION \
            --query 'Certificate.DomainValidationOptions[].ResourceRecord')
        
        # Create change batch for validation records
        CHANGE_BATCH='{
            "Changes": []
        }'
        
        # Add each validation record
        echo "$VALIDATION_RECORDS" | jq -r '.[] | @base64' | while read record; do
            DECODED=$(echo $record | base64 --decode)
            NAME=$(echo $DECODED | jq -r '.Name')
            VALUE=$(echo $DECODED | jq -r '.Value')
            
            aws route53 change-resource-record-sets \
                --hosted-zone-id $HOSTED_ZONE_ID \
                --change-batch '{
                    "Changes": [{
                        "Action": "CREATE",
                        "ResourceRecordSet": {
                            "Name": "'$NAME'",
                            "Type": "CNAME",
                            "TTL": 300,
                            "ResourceRecords": [{"Value": "'$VALUE'"}]
                        }
                    }]
                }' > /dev/null
        done
        
        print_success "DNS validation records added"
    fi
    
    print_info "Waiting for certificate validation (this may take several minutes)..."
    aws acm wait certificate-validated --certificate-arn $CERT_ARN --region $AWS_REGION
    print_success "Certificate validated and issued!"
    
    export CERT_ARN
}

setup_cloudfront() {
    print_header "Setting up CloudFront Distribution"
    
    # Get S3 bucket name from deployment info
    if [ -f "aws-deployment-info.txt" ]; then
        S3_BUCKET_NAME=$(grep "S3 Bucket:" aws-deployment-info.txt | awk '{print $4}')
        S3_DOMAIN="$S3_BUCKET_NAME.s3-website-$AWS_REGION.amazonaws.com"
    else
        print_error "Deployment info not found. Please run full deployment first."
        exit 1
    fi
    
    print_info "Creating CloudFront distribution for frontend..."
    
    # Create distribution config
    cat > /tmp/cloudfront-config.json << EOF
{
    "CallerReference": "esoteric-frontend-$(date +%s)",
    "Comment": "Esoteric Frontend Distribution with Custom Domain",
    "Aliases": {
        "Quantity": 1,
        "Items": ["$FRONTEND_DOMAIN"]
    },
    "DefaultCacheBehavior": {
        "TargetOriginId": "S3-$S3_BUCKET_NAME",
        "ViewerProtocolPolicy": "redirect-to-https",
        "TrustedSigners": {
            "Enabled": false,
            "Quantity": 0
        },
        "ForwardedValues": {
            "QueryString": false,
            "Cookies": {
                "Forward": "none"
            }
        },
        "MinTTL": 0,
        "DefaultTTL": 86400,
        "MaxTTL": 31536000,
        "Compress": true
    },
    "Origins": {
        "Quantity": 1,
        "Items": [{
            "Id": "S3-$S3_BUCKET_NAME",
            "DomainName": "$S3_DOMAIN",
            "CustomOriginConfig": {
                "HTTPPort": 80,
                "HTTPSPort": 443,
                "OriginProtocolPolicy": "http-only",
                "OriginSslProtocols": {
                    "Quantity": 1,
                    "Items": ["TLSv1.2"]
                }
            }
        }]
    },
    "ViewerCertificate": {
        "ACMCertificateArn": "$CERT_ARN",
        "SSLSupportMethod": "sni-only",
        "MinimumProtocolVersion": "TLSv1.2_2019"
    },
    "Enabled": true,
    "PriceClass": "PriceClass_100",
    "CustomErrorResponses": {
        "Quantity": 1,
        "Items": [{
            "ErrorCode": 404,
            "ResponsePagePath": "/index.html",
            "ResponseCode": "200",
            "ErrorCachingMinTTL": 300
        }]
    }
}
EOF
    
    # Create CloudFront distribution
    DISTRIBUTION_ID=$(aws cloudfront create-distribution \
        --distribution-config file:///tmp/cloudfront-config.json \
        --query 'Distribution.Id' \
        --output text)
    
    CLOUDFRONT_DOMAIN=$(aws cloudfront get-distribution \
        --id $DISTRIBUTION_ID \
        --query 'Distribution.DomainName' \
        --output text)
    
    print_success "CloudFront distribution created: $DISTRIBUTION_ID"
    print_info "CloudFront domain: $CLOUDFRONT_DOMAIN"
    
    export DISTRIBUTION_ID CLOUDFRONT_DOMAIN
}

setup_load_balancer_ssl() {
    print_header "Configuring Load Balancer with SSL"
    
    # Get ALB ARN
    ALB_ARN=$(aws elbv2 describe-load-balancers --names $ALB_NAME --region $AWS_REGION --query 'LoadBalancers[0].LoadBalancerArn' --output text)
    
    # Get target group ARN
    TG_ARN=$(aws elbv2 describe-target-groups --names esoteric-tg --region $AWS_REGION --query 'TargetGroups[0].TargetGroupArn' --output text)
    
    print_info "Adding HTTPS listener to load balancer..."
    
    # Create HTTPS listener
    aws elbv2 create-listener \
        --load-balancer-arn $ALB_ARN \
        --protocol HTTPS \
        --port 443 \
        --certificates CertificateArn=$CERT_ARN \
        --default-actions Type=forward,TargetGroupArn=$TG_ARN \
        --region $AWS_REGION
    
    print_success "HTTPS listener added to load balancer"
}

create_dns_records() {
    print_header "Creating DNS Records"
    
    # Get ALB details
    ALB_DNS=$(aws elbv2 describe-load-balancers --names $ALB_NAME --region $AWS_REGION --query 'LoadBalancers[0].DNSName' --output text)
    ALB_ZONE_ID=$(aws elbv2 describe-load-balancers --names $ALB_NAME --region $AWS_REGION --query 'LoadBalancers[0].CanonicalHostedZoneId' --output text)
    
    print_info "Creating DNS records..."
    
    # Create API subdomain record (points to ALB)
    aws route53 change-resource-record-sets \
        --hosted-zone-id $HOSTED_ZONE_ID \
        --change-batch '{
            "Changes": [{
                "Action": "UPSERT",
                "ResourceRecordSet": {
                    "Name": "'$API_DOMAIN'",
                    "Type": "A",
                    "AliasTarget": {
                        "DNSName": "'$ALB_DNS'",
                        "EvaluateTargetHealth": false,
                        "HostedZoneId": "'$ALB_ZONE_ID'"
                    }
                }
            }]
        }' > /dev/null
    
    # Create frontend subdomain record (points to CloudFront)
    aws route53 change-resource-record-sets \
        --hosted-zone-id $HOSTED_ZONE_ID \
        --change-batch '{
            "Changes": [{
                "Action": "UPSERT",
                "ResourceRecordSet": {
                    "Name": "'$FRONTEND_DOMAIN'",
                    "Type": "A",
                    "AliasTarget": {
                        "DNSName": "'$CLOUDFRONT_DOMAIN'",
                        "EvaluateTargetHealth": false,
                        "HostedZoneId": "Z2FDTNDATAQYW2"
                    }
                }
            }]
        }' > /dev/null
    
    print_success "DNS records created"
}

update_frontend_config() {
    print_header "Updating Frontend Configuration"
    
    cd frontend
    
    # Update environment to use custom domain
    echo "REACT_APP_API_URL=https://$API_DOMAIN/api" > .env.local
    echo "GENERATE_SOURCEMAP=false" >> .env.local
    
    # Rebuild frontend
    print_info "Rebuilding frontend with custom domain..."
    npm run build
    
    # Upload to S3
    if [ -f "../aws-deployment-info.txt" ]; then
        S3_BUCKET_NAME=$(grep "S3 Bucket:" ../aws-deployment-info.txt | awk '{print $4}')
        print_info "Uploading updated frontend..."
        aws s3 sync build/ s3://$S3_BUCKET_NAME --delete --region $AWS_REGION
        print_success "Frontend updated with custom domain"
    fi
    
    cd ..
}

update_backend_cors() {
    print_header "Updating Backend CORS Configuration"
    
    # Get current task definition
    TASK_FAMILY="esoteric-backend"
    CURRENT_TASK_DEF=$(aws ecs describe-task-definition --task-definition $TASK_FAMILY --region $AWS_REGION --query 'taskDefinition')
    
    # Create updated task definition with new frontend URL
    UPDATED_TASK_DEF_FILE="/tmp/updated-task-definition-$(date +%s).json"
    echo "$CURRENT_TASK_DEF" | jq --arg frontend_url "https://$FRONTEND_DOMAIN" '
        .containerDefinitions[0].environment = (.containerDefinitions[0].environment | map(
            if .name == "FRONTEND_URL" then .value = $frontend_url else . end
        )) |
        del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy)
    ' > $UPDATED_TASK_DEF_FILE
    
    # Register updated task definition
    print_info "Updating backend CORS configuration..."
    UPDATED_TASK_DEF_ARN=$(aws ecs register-task-definition --cli-input-json file://$UPDATED_TASK_DEF_FILE --region $AWS_REGION --query 'taskDefinition.taskDefinitionArn' --output text)
    
    # Update ECS service
    CLUSTER_NAME="esoteric-cluster"
    SERVICE_NAME="esoteric-service"
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service $SERVICE_NAME \
        --task-definition $UPDATED_TASK_DEF_ARN \
        --region $AWS_REGION > /dev/null
    
    print_success "Backend CORS updated"
}

wait_for_deployment() {
    print_header "Waiting for Deployment"
    
    print_info "Waiting for CloudFront distribution to deploy (this may take 15-20 minutes)..."
    aws cloudfront wait distribution-deployed --id $DISTRIBUTION_ID
    
    print_info "Waiting for ECS service to stabilize..."
    aws ecs wait services-stable --cluster esoteric-cluster --services esoteric-service --region $AWS_REGION
    
    print_success "Deployment complete!"
}

save_domain_info() {
    # Update deployment info with custom domain
    cat >> aws-deployment-info.txt << EOF

🌐 Custom Domain Configuration:
   Frontend URL: https://$FRONTEND_DOMAIN
   API URL: https://$API_DOMAIN
   Certificate ARN: $CERT_ARN
   CloudFront Distribution: $DISTRIBUTION_ID
   
🔧 DNS Configuration:
   Domain: $DOMAIN_NAME
   Hosted Zone ID: $HOSTED_ZONE_ID
   
⏰ Note: DNS changes may take up to 48 hours to propagate worldwide
EOF
}

display_results() {
    print_header "Custom Domain Setup Complete!"
    
    echo ""
    print_success "🌐 Your application is now available at:"
    print_success "   Frontend: https://$FRONTEND_DOMAIN"
    print_success "   API: https://$API_DOMAIN"
    echo ""
    print_info "🔐 SSL certificates are configured and auto-renewing"
    print_info "📱 CloudFront provides global CDN acceleration"
    print_info "🔒 HTTPS is enforced for all connections"
    echo ""
    print_warning "⏰ DNS propagation may take up to 48 hours worldwide"
    print_info "💡 Test your domain: curl -I https://$FRONTEND_DOMAIN"
    echo ""
    print_info "📄 Domain details saved to: aws-deployment-info.txt"
}

# Main execution
main() {
    print_header "Esoteric Loans - Custom Domain Setup"
    
    # Change to project root
    cd "$(dirname "$0")/.."
    
    # Check prerequisites
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI not found"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        print_error "jq not found. Please install it first."
        exit 1
    fi
    
    # Check if deployment exists
    if ! aws elbv2 describe-load-balancers --names $ALB_NAME --region $AWS_REGION &> /dev/null; then
        print_error "Load balancer not found. Run full deployment first:"
        print_error "   ./scripts/deploy-aws-complete.sh"
        exit 1
    fi
    
    get_domain_info
    create_hosted_zone
    request_ssl_certificate
    setup_cloudfront
    setup_load_balancer_ssl
    create_dns_records
    update_frontend_config
    update_backend_cors
    wait_for_deployment
    save_domain_info
    display_results
}

# Handle help
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    echo "Esoteric Loans Custom Domain Setup Script"
    echo ""
    echo "This script configures a custom domain with SSL for your AWS deployment."
    echo ""
    echo "Prerequisites:"
    echo "  • Domain name registered with any registrar"
    echo "  • AWS deployment already completed"
    echo "  • Access to your domain's DNS settings"
    echo ""
    echo "What this script does:"
    echo "  • Creates Route 53 hosted zone"
    echo "  • Requests and validates SSL certificates"
    echo "  • Sets up CloudFront distribution for frontend"
    echo "  • Configures HTTPS on load balancer for API"
    echo "  • Creates DNS records for your subdomains"
    echo "  • Updates frontend and backend configurations"
    echo ""
    echo "After running this script:"
    echo "  • Update your domain registrar's name servers"
    echo "  • Wait for DNS propagation (up to 48 hours)"
    echo "  • Access your app at your custom domain with HTTPS"
    exit 0
fi

main "$@"