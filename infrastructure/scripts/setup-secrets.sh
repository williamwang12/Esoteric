#!/bin/bash

# Esoteric Secrets Manager Setup Script
# Usage: ./setup-secrets.sh [staging|production]

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENVIRONMENT="${1:-staging}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Esoteric Secrets Manager Setup ===${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo ""

# Check prerequisites
if ! command -v aws &> /dev/null; then
    echo -e "${RED}AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}AWS credentials not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

SECRET_NAME="esoteric-app-secrets-${ENVIRONMENT}"

echo -e "${YELLOW}Setting up secrets for environment: ${ENVIRONMENT}${NC}"

# Check if secret exists
if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" &> /dev/null; then
    echo -e "${GREEN}Secret already exists: ${SECRET_NAME}${NC}"
    echo -e "${YELLOW}Updating secret values...${NC}"
    
    # Get current secret value
    CURRENT_SECRET=$(aws secretsmanager get-secret-value --secret-id "$SECRET_NAME" --query SecretString --output text)
    
    echo -e "${BLUE}Current secret keys:${NC}"
    echo "$CURRENT_SECRET" | jq -r 'keys[]' | sort
    echo ""
else
    echo -e "${YELLOW}Secret does not exist yet. It will be created during CDK deployment.${NC}"
    echo -e "${YELLOW}After deployment, run this script again to update the secret values.${NC}"
    exit 0
fi

# Function to prompt for secret value
prompt_for_secret() {
    local key="$1"
    local description="$2"
    local current_value="$3"
    local is_sensitive="${4:-false}"
    
    echo -e "${BLUE}${description}${NC}"
    if [ -n "$current_value" ] && [ "$current_value" != "null" ]; then
        if [ "$is_sensitive" = "true" ]; then
            echo -e "${YELLOW}Current value: [HIDDEN]${NC}"
        else
            echo -e "${YELLOW}Current value: ${current_value}${NC}"
        fi
    fi
    
    if [ "$is_sensitive" = "true" ]; then
        echo -n "Enter new value (leave empty to keep current): "
        read -s new_value
        echo ""
    else
        echo -n "Enter new value (leave empty to keep current): "
        read new_value
    fi
    
    if [ -n "$new_value" ]; then
        echo "$new_value"
    else
        echo "$current_value"
    fi
}

# Extract current values
JWT_SECRET=$(echo "$CURRENT_SECRET" | jq -r '.JWT_SECRET // empty')
JWT_EXPIRES_IN=$(echo "$CURRENT_SECRET" | jq -r '.JWT_EXPIRES_IN // "7d"')
FRONTEND_URL=$(echo "$CURRENT_SECRET" | jq -r '.FRONTEND_URL // empty')
CALENDLY_API_TOKEN=$(echo "$CURRENT_SECRET" | jq -r '.CALENDLY_API_TOKEN // empty')
CALENDLY_USER_URI=$(echo "$CURRENT_SECRET" | jq -r '.CALENDLY_USER_URI // empty')
CALENDLY_API_BASE_URL=$(echo "$CURRENT_SECRET" | jq -r '.CALENDLY_API_BASE_URL // "https://api.calendly.com"')
DOCUSIGN_INTEGRATION_KEY=$(echo "$CURRENT_SECRET" | jq -r '.DOCUSIGN_INTEGRATION_KEY // empty')
DOCUSIGN_CLIENT_SECRET=$(echo "$CURRENT_SECRET" | jq -r '.DOCUSIGN_CLIENT_SECRET // empty')
DOCUSIGN_USER_ID=$(echo "$CURRENT_SECRET" | jq -r '.DOCUSIGN_USER_ID // empty')
DOCUSIGN_ACCOUNT_ID=$(echo "$CURRENT_SECRET" | jq -r '.DOCUSIGN_ACCOUNT_ID // empty')
DOCUSIGN_ENVIRONMENT=$(echo "$CURRENT_SECRET" | jq -r '.DOCUSIGN_ENVIRONMENT // "demo"')
DOCUSIGN_REDIRECT_URI=$(echo "$CURRENT_SECRET" | jq -r '.DOCUSIGN_REDIRECT_URI // "https://developers.docusign.com/platform/auth/consent"')
NODE_ENV=$(echo "$CURRENT_SECRET" | jq -r '.NODE_ENV // empty')
PORT=$(echo "$CURRENT_SECRET" | jq -r '.PORT // "5002"')

echo -e "${YELLOW}Please provide the following secret values:${NC}"
echo ""

# Prompt for each secret
NEW_JWT_SECRET=$(prompt_for_secret "JWT_SECRET" "JWT Secret for token signing" "$JWT_SECRET" "true")
NEW_JWT_EXPIRES_IN=$(prompt_for_secret "JWT_EXPIRES_IN" "JWT Token expiration time (e.g., 7d)" "$JWT_EXPIRES_IN")
NEW_FRONTEND_URL=$(prompt_for_secret "FRONTEND_URL" "Frontend URL (e.g., https://app.esoteric.com)" "$FRONTEND_URL")

echo ""
echo -e "${YELLOW}Calendly Integration:${NC}"
NEW_CALENDLY_API_TOKEN=$(prompt_for_secret "CALENDLY_API_TOKEN" "Calendly API Token" "$CALENDLY_API_TOKEN" "true")
NEW_CALENDLY_USER_URI=$(prompt_for_secret "CALENDLY_USER_URI" "Calendly User URI" "$CALENDLY_USER_URI")

echo ""
echo -e "${YELLOW}DocuSign Integration:${NC}"
NEW_DOCUSIGN_INTEGRATION_KEY=$(prompt_for_secret "DOCUSIGN_INTEGRATION_KEY" "DocuSign Integration Key" "$DOCUSIGN_INTEGRATION_KEY")
NEW_DOCUSIGN_CLIENT_SECRET=$(prompt_for_secret "DOCUSIGN_CLIENT_SECRET" "DocuSign Client Secret" "$DOCUSIGN_CLIENT_SECRET" "true")
NEW_DOCUSIGN_USER_ID=$(prompt_for_secret "DOCUSIGN_USER_ID" "DocuSign User ID" "$DOCUSIGN_USER_ID")
NEW_DOCUSIGN_ACCOUNT_ID=$(prompt_for_secret "DOCUSIGN_ACCOUNT_ID" "DocuSign Account ID" "$DOCUSIGN_ACCOUNT_ID")

# Create new secret JSON
NEW_SECRET_JSON=$(jq -n \
    --arg jwt_secret "$NEW_JWT_SECRET" \
    --arg jwt_expires_in "$NEW_JWT_EXPIRES_IN" \
    --arg frontend_url "$NEW_FRONTEND_URL" \
    --arg calendly_api_token "$NEW_CALENDLY_API_TOKEN" \
    --arg calendly_user_uri "$NEW_CALENDLY_USER_URI" \
    --arg calendly_api_base_url "$CALENDLY_API_BASE_URL" \
    --arg docusign_integration_key "$NEW_DOCUSIGN_INTEGRATION_KEY" \
    --arg docusign_client_secret "$NEW_DOCUSIGN_CLIENT_SECRET" \
    --arg docusign_user_id "$NEW_DOCUSIGN_USER_ID" \
    --arg docusign_account_id "$NEW_DOCUSIGN_ACCOUNT_ID" \
    --arg docusign_environment "$DOCUSIGN_ENVIRONMENT" \
    --arg docusign_redirect_uri "$DOCUSIGN_REDIRECT_URI" \
    --arg node_env "$NODE_ENV" \
    --arg port "$PORT" \
    '{
        JWT_SECRET: $jwt_secret,
        JWT_EXPIRES_IN: $jwt_expires_in,
        FRONTEND_URL: $frontend_url,
        CALENDLY_API_TOKEN: $calendly_api_token,
        CALENDLY_USER_URI: $calendly_user_uri,
        CALENDLY_API_BASE_URL: $calendly_api_base_url,
        DOCUSIGN_INTEGRATION_KEY: $docusign_integration_key,
        DOCUSIGN_CLIENT_SECRET: $docusign_client_secret,
        DOCUSIGN_USER_ID: $docusign_user_id,
        DOCUSIGN_ACCOUNT_ID: $docusign_account_id,
        DOCUSIGN_ENVIRONMENT: $docusign_environment,
        DOCUSIGN_REDIRECT_URI: $docusign_redirect_uri,
        NODE_ENV: $node_env,
        PORT: $port
    }')

echo ""
echo -e "${YELLOW}Updating secret in AWS Secrets Manager...${NC}"

# Update secret
aws secretsmanager update-secret \
    --secret-id "$SECRET_NAME" \
    --secret-string "$NEW_SECRET_JSON"

echo -e "${GREEN}Secret updated successfully!${NC}"
echo ""
echo -e "${BLUE}Secret ARN:${NC}"
aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --query ARN --output text

echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Restart your ECS service to pick up the new secret values"
echo -e "2. Check the application logs to ensure everything is working correctly"
echo -e "3. Test the application functionality"