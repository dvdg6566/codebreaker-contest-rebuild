# Documentation

This directory contains comprehensive documentation for the Codebreaker Contest System.

## Primary Documentation

📖 **[SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)** - Complete technical documentation covering:
- Frontend React Router 7 application
- AWS serverless backend architecture
- Database schemas (DynamoDB)
- Lambda functions and workflows
- WebSocket real-time infrastructure
- Deployment and configuration

🗄️ **[DATABASE_QUERIES.md](./DATABASE_QUERIES.md)** - Database query patterns and function mappings:
- Query breakdown per route/page
- Database module function reference
- DynamoDB table usage patterns

## Visual Resources

🖼️ **[Codebreaker-Architecture.png](./Codebreaker-Architecture.png)** - System architecture diagram

## Getting Started

1. Read the [System Architecture documentation](./SYSTEM_ARCHITECTURE.md) for complete technical details
2. Follow the deployment instructions in Section 12
3. Use the validation script (`scripts/validate-aws-setup.ts`) to verify your setup

## Quick Reference

- **Frontend:** React 19 + React Router 7 + TailwindCSS 4
- **Backend:** AWS Lambda + DynamoDB + S3 + Step Functions
- **Real-time:** API Gateway WebSocket + Step Functions
- **Authentication:** AWS Cognito
- **Deployment:** CloudFormation via AWS SAM