# Documentation

This directory contains documentation for the Codebreaker Contest System.

## Documentation

🗄️ **[DATABASE_QUERIES.md](./DATABASE_QUERIES.md)** - Database query patterns and function mappings:
- Query breakdown per route/page
- Database module function reference
- DynamoDB table usage patterns

🖼️ **[Codebreaker-Architecture.png](./Codebreaker-Architecture.png)** - System architecture diagram

## Other Resources

- **[/auto/README.md](../auto/README.md)** - AWS infrastructure deployment guide
- **[Root README.md](../README.md)** - Project overview and getting started

## Quick Reference

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, React Router 7, TailwindCSS 4, shadcn/ui |
| **Backend** | AWS Lambda (Python), DynamoDB, S3, Step Functions |
| **Real-time** | API Gateway WebSocket, EventBridge Scheduler |
| **Auth** | AWS Cognito |
| **Deployment** | CloudFormation via AWS SAM |

## Validation

Verify AWS resources are properly configured:

```bash
bun validate
```
