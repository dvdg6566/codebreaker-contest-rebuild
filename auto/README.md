# Codebreaker Contest - AWS Infrastructure

This directory contains all AWS infrastructure as code for deploying the Codebreaker Contest backend. Everything is deployed via **AWS SAM** (Serverless Application Model) and **CloudFormation**.

## Prerequisites

- AWS CLI configured with appropriate credentials
- AWS SAM CLI installed (`pip install aws-sam-cli`)
- Docker installed (for local testing)
- An S3 bucket for storing deployment artifacts

## Project Structure

```
auto/
├── template.yml                    # Main CloudFormation orchestrator
├── samconfig.toml                  # SAM deployment configuration
├── templates/
│   ├── storage.yml                 # S3 buckets (6 buckets)
│   ├── database.yml                # DynamoDB tables (9 tables)
│   ├── cognito.yml                 # User authentication
│   ├── codebuild.yml               # ECR + CodeBuild + Compiler Lambda
│   ├── apprunner.yml               # ECR + CodeBuild + App Runner webapp
│   ├── lambdas.yml                 # Lambda functions + IAM roles
│   ├── websocket.yml               # WebSocket API Gateway
│   └── step-functions.yml          # Grading + WebSocket state machines
├── lambda-functions/
│   ├── codebuild-trigger/          # Custom Resource for compiler deployment
│   ├── webapp-deploy-trigger/      # Custom Resource for webapp deployment
│   ├── compiler/                   # Code compilation (Docker-based)
│   ├── contest-end-notifier/       # Contest end WebSocket notifications
│   ├── grader-problem-init/        # Initialize submission grading
│   ├── grader-problem-scorer/      # Aggregate testcase scores
│   ├── problem-validation/         # Validate problem configuration
│   ├── regrade-problem/            # Trigger regrade for all submissions
│   ├── testcase-grader/            # Execute code against testcase
│   ├── testcase-grader-wrapper/    # DynamoDB update wrapper
│   ├── websocket-connections/      # WebSocket connect/disconnect handler
│   └── websocket-invoke/           # Send WebSocket notifications
└── state-machines/
    ├── grading.asl.json            # Submission grading workflow
    └── websocket.asl.json          # Parallel notification broadcast
```

## Resources Created

| Category | Resources |
|----------|-----------|
| **DynamoDB** | users, contests, problems, submissions, announcements, clarifications, websocket, global-counters, submission-locks |
| **S3** | submissions, testdata, statements, attachments, checkers, graders |
| **Lambda** | 12 functions (compiler, grading pipeline, WebSocket, notifications, deployment triggers) |
| **Step Functions** | grading (submission workflow), websocket (parallel broadcast) |
| **API Gateway** | WebSocket API for real-time notifications |
| **App Runner** | Web application hosting (React Router SSR) |
| **Cognito** | User pool with admin/contestant groups |
| **EventBridge** | Schedule group for contest end notifications |
| **ECR** | 2 repositories (compiler, webapp) |
| **IAM** | 6 roles (compiler, codebuild, webapp-codebuild, apprunner-access, apprunner-instance, etc.) |

---

## Architecture: Compiler Lambda Auto-Deployment

The compiler Lambda (which compiles user code submissions) requires a Docker image with gcc/g++ installed. This image is built via CodeBuild and stored in ECR. The deployment is fully automated using a CloudFormation Custom Resource.

### Why Custom Resource?

- **Problem**: Lambda requires the Docker image to exist in ECR before the function can be created
- **Problem**: CloudFormation can't natively trigger CodeBuild and wait for completion
- **Solution**: A Custom Resource Lambda that orchestrates the build process

### Deployment Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: Create Base Resources                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CompilerECRRepository     CodeBuildRole     CompilerFunctionRole│
│  (empty ECR repo)          (for CodeBuild)   (for Lambda)        │
│         │                        │                               │
│         └────────────┬───────────┘                               │
│                      ▼                                           │
│              CodeBuildProject                                    │
│              (pulls from GitHub: codebreaker-compiler)           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: Create Trigger Lambda                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CodeBuildTriggerFunction                                        │
│  - Can start CodeBuild builds                                    │
│  - Can poll for build status                                     │
│  - Can create/update/delete Lambda functions                     │
│  - Sends responses back to CloudFormation                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: Custom Resource Execution (~5-10 minutes)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CodeBuildTrigger (Custom::CodeBuildTrigger)                     │
│                                                                  │
│  CloudFormation invokes the trigger Lambda with parameters:      │
│  - ProjectName: <judge>-codebuildproject                         │
│  - JudgeName: <judge>                                            │
│  - ImageUri: <account>.dkr.ecr.<region>.amazonaws.com/...:latest │
│  - CompilerRoleArn: arn:aws:iam::...:role/...-compiler-role      │
│                                                                  │
│  The Lambda then:                                                │
│  1. Calls codebuild.start_build()                                │
│  2. Polls every 10s until build succeeds/fails                   │
│  3. Calls lambda.create_function() with the ECR image            │
│  4. Returns SUCCESS/FAILED to CloudFormation                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 4: Complete                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Outputs available:                                              │
│  - ECRURI: The ECR image URI                                     │
│  - CompilerFunctionArn: The created Lambda ARN                   │
│  - CodeBuildProjectName: For manual rebuilds if needed           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Custom Resource Lifecycle

| Event | Action |
|-------|--------|
| **Create** | Trigger CodeBuild → Wait → Create Compiler Lambda |
| **Update** | Trigger CodeBuild → Wait → Update Compiler Lambda code |
| **Delete** | Delete the Compiler Lambda function |

### Key Files

| File | Purpose |
|------|---------|
| `templates/codebuild.yml` | Defines ECR, CodeBuild project, IAM roles, trigger Lambda, and Custom Resource |
| `lambda-functions/codebuild-trigger/lambda_function.py` | Custom Resource handler that orchestrates the build |

### Troubleshooting

**Build takes too long**: CodeBuild typically takes 5-10 minutes. The Custom Resource has a 15-minute timeout.

**Build fails**: Check CodeBuild logs in CloudWatch at `/aws/codebuild/<judge>-codebuildproject`

---

## Architecture: Web App Auto-Deployment (App Runner)

The web application (React Router SSR) is deployed to AWS App Runner via a similar Custom Resource pattern.

### Deployment Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: Create Base Resources                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  WebAppECRRepository    WebAppCodeBuildRole    AppRunnerRoles    │
│  (empty ECR repo)       (for CodeBuild)        (access+instance) │
│         │                      │                                 │
│         └──────────┬───────────┘                                 │
│                    ▼                                             │
│            WebAppCodeBuildProject                                │
│            (pulls from GitHub: codebreaker-contest-rebuild)      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: Custom Resource Execution (~6 minutes)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  WebAppTrigger (Custom::WebAppTrigger)                           │
│                                                                  │
│  The Lambda:                                                     │
│  1. Triggers CodeBuild to build Docker image (~2 min)            │
│  2. Pushes image to ECR                                          │
│  3. Creates App Runner service with environment variables        │
│  4. Waits for App Runner to reach RUNNING status (~4 min)        │
│  5. Returns service URL to CloudFormation                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: App Initialization (First Request)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  On first request, the app checks if data exists and:            │
│  - Creates admin user in Cognito (sends email with temp password)│
│  - Creates test users (alice, bob, charlie, diana)               │
│  - Uploads sample problems to S3                                 │
│  - Compiles problem checkers via compiler Lambda                 │
│  - Creates sample contest and submissions                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `templates/apprunner.yml` | Defines ECR, CodeBuild, App Runner roles, trigger Lambda, and Custom Resource |
| `lambda-functions/webapp-deploy-trigger/lambda_function.py` | Custom Resource handler for CodeBuild + App Runner |
| `Dockerfile` | Multi-stage build: Bun for build, Node.js for runtime |
| `buildspec-webapp.yml` | CodeBuild spec for Docker build and ECR push |
| `app/lib/init.server.ts` | First-run data initialization logic |

### Environment Variables

The App Runner service is configured with:

| Variable | Source |
|----------|--------|
| `JUDGE_NAME` | CloudFormation parameter |
| `AWS_REGION` | Current region |
| `COGNITO_USER_POOL_ID` | From Cognito stack |
| `COGNITO_CLIENT_ID` | From Cognito stack |
| `API_GATEWAY_LINK` | WebSocket endpoint from WebSocket stack |
| `SESSION_SECRET` | Auto-generated |
| `ADMIN_EMAIL` | CloudFormation parameter (for first-run admin user) |

---

## Local Development

### Validate Templates

```bash
# Validate main template
sam validate --template template.yml

# Validate individual nested templates
sam validate --template templates/storage.yml
sam validate --template templates/database.yml
sam validate --template templates/cognito.yml
sam validate --template templates/codebuild.yml
sam validate --template templates/lambdas.yml
sam validate --template templates/websocket.yml
sam validate --template templates/step-functions.yml
```

### Build

```bash
sam build --template template.yml
```

---

## Deployment

### Option 1: Interactive Deployment (Development)

```bash
sam build && sam deploy --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND
```

**Required capabilities:**

| Capability | Permission |
|------------|------------|
| `CAPABILITY_NAMED_IAM` | The templates create IAM roles with custom names (e.g., `${JudgeName}-codebuild`, `${JudgeName}-compiler-role`). CloudFormation requires explicit acknowledgment to create named IAM resources. |
| `CAPABILITY_AUTO_EXPAND` | Nested templates (`lambdas.yml`, `websocket.yml`, `step-functions.yml`) use the SAM transform (`AWS::Serverless-2016-10-31`), which is a CloudFormation macro. This capability allows CloudFormation to expand these macros in nested stacks. |

This will prompt for:
- Stack name
- AWS region
- JudgeName parameter
- S3 bucket for artifacts
- Confirmation of IAM resource creation

### Option 2: Non-Interactive Deployment

```bash
sam build --template template.yml

sam deploy \
  --stack-name codebreaker-contest \
  --parameter-overrides JudgeName=mycontest \
  --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --resolve-s3
```

### Option 3: Using samconfig.toml

After running `sam deploy --guided` once, settings are saved to `samconfig.toml`. Subsequent deployments:

```bash
sam build && sam deploy
```

---

## Post-Deployment Steps

### 1. Compiler Lambda (Automatic)

The compiler Lambda is now deployed automatically via a CloudFormation Custom Resource:

1. **CodeBuild triggers automatically** when the stack is created
2. **Docker image is built** and pushed to ECR (~5-10 minutes)
3. **Compiler Lambda is created** from the ECR image

You can monitor progress in the CloudFormation console - the `CodeBuildTrigger` resource will show `CREATE_IN_PROGRESS` while building.

**Note:** Initial deployment takes ~10-15 minutes due to CodeBuild. Subsequent updates that don't modify the compiler will be faster.

### 2. Verify Deployment

```bash
# Check stack status
aws cloudformation describe-stacks --stack-name codebreaker-contest

# List stack outputs
aws cloudformation describe-stacks --stack-name codebreaker-contest --query 'Stacks[0].Outputs'
```

---

## Updating the Stack

```bash
# Make changes to templates, then:
sam build && sam deploy
```

CloudFormation will only update resources that changed.

For one-click deployment packaging, see [ONE_CLICK_DEPLOYMENT.md](./ONE_CLICK_DEPLOYMENT.md).
