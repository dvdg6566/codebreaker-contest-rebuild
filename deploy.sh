#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  Codebreaker Contest Manager Deploy  ${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Check for required tools
command -v aws >/dev/null 2>&1 || { echo -e "${RED}AWS CLI is required but not installed.${NC}"; exit 1; }
command -v sam >/dev/null 2>&1 || { echo -e "${RED}AWS SAM CLI is required but not installed.${NC}"; exit 1; }
command -v bun >/dev/null 2>&1 || { echo -e "${RED}Bun is required but not installed.${NC}"; exit 1; }

# Generate session secret if not set
if [ -z "$SESSION_SECRET" ]; then
    SESSION_SECRET=$(openssl rand -hex 32)
    echo -e "${YELLOW}Generated SESSION_SECRET: ${SESSION_SECRET}${NC}"
    echo "Add this to your .env file"
fi

# Generate admin password
ADMIN_PASSWORD=$(openssl rand -base64 12 | tr -d '/+=' | head -c 16)

echo ""
echo -e "${GREEN}Step 1: Building the application...${NC}"
bun install
bun run build

echo ""
echo -e "${GREEN}Step 2: Deploying infrastructure with SAM...${NC}"
echo -e "${YELLOW}This will create Cognito, DynamoDB, S3, Lambda, and other resources.${NC}"

# Check if this is a guided deploy or using existing config
if [ -f "samconfig.toml" ]; then
    echo "Using existing SAM configuration..."
    sam deploy
else
    echo "Running guided deployment..."
    sam deploy --guided --capabilities CAPABILITY_NAMED_IAM
fi

# Get stack outputs
STACK_NAME=${STACK_NAME:-"codebreaker"}
echo ""
echo -e "${GREEN}Step 3: Retrieving stack outputs...${NC}"

COGNITO_USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
    --output text 2>/dev/null || echo "")

COGNITO_CLIENT_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
    --output text 2>/dev/null || echo "")

API_GATEWAY_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`WebSocketURL`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -n "$COGNITO_USER_POOL_ID" ]; then
    echo ""
    echo -e "${GREEN}Step 4: Creating admin user...${NC}"

    # Create admin user
    aws cognito-idp admin-create-user \
        --user-pool-id "$COGNITO_USER_POOL_ID" \
        --username admin \
        --temporary-password "$ADMIN_PASSWORD" \
        --message-action SUPPRESS \
        2>/dev/null || echo "Admin user may already exist"

    # Set permanent password
    aws cognito-idp admin-set-user-password \
        --user-pool-id "$COGNITO_USER_POOL_ID" \
        --username admin \
        --password "$ADMIN_PASSWORD" \
        --permanent \
        2>/dev/null || echo "Could not set admin password"

    # Add to admin group (create group if it doesn't exist)
    aws cognito-idp create-group \
        --user-pool-id "$COGNITO_USER_POOL_ID" \
        --group-name admin \
        2>/dev/null || true

    aws cognito-idp admin-add-user-to-group \
        --user-pool-id "$COGNITO_USER_POOL_ID" \
        --username admin \
        --group-name admin \
        2>/dev/null || echo "Could not add admin to group"
fi

echo ""
echo -e "${BLUE}======================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo -e "${YELLOW}Configuration values (add to .env):${NC}"
echo ""
echo "COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID"
echo "COGNITO_CLIENT_ID=$COGNITO_CLIENT_ID"
echo "API_GATEWAY_LINK=$API_GATEWAY_URL"
echo "SESSION_SECRET=$SESSION_SECRET"
echo ""
echo -e "${GREEN}Admin Credentials:${NC}"
echo "Username: admin"
echo "Password: $ADMIN_PASSWORD"
echo ""
echo -e "${YELLOW}Important: Save these credentials securely!${NC}"
echo ""
echo -e "${GREEN}To start the application:${NC}"
echo "1. Copy the configuration above to your .env file"
echo "2. Run: bun dev"
echo "3. Open: http://localhost:5173"
