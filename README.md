# Codebreaker Contest Manager

## Introduction

Codebreaker is the official platform for Singapore Informatics Olympiad training and contests. It is home to 2,000 problems and over 8,000 users, and has performed **national team selection** for the International Olympiad of Informatics teams in Singapore and Indonesia.

The primary motivation for Singapore's migration to Codebreaker is **lowering operating costs**. Despite having run for over 6 years and having graded hundreds of thousands of submissions, the total operational cost of Codebreaker is under S$3000.

Codebreaker Contest System is a fork of the Codebreaker architecture that serves to allow for **easy and independent** usage of Codebreaker to run contests. In that way, Codebreaker Contest serves to be a more **cost-efficient** and more user-friendly version of the gold standard of contest organization and management, CMS.

## Codebreaker Statistics

As of time of writing (March 2026), here are the statistics for [Codebreaker](https://codebreaker.xyz) (main site).

- Codebreaker receives an average of 400,000 to 500,000 monthly page requests (Excluding AI crawlers).
- Codebreaker has graded a total of 800,000 submissions.
- Codebreaker has 8,000+ registered users, coming from a 100+ different countries
- Codebreaker has a total of 2,000+ different problems, coming from a mixture of public sources and the Singapore training system.

## Codebreaker Infrastructure Overview

Codebreaker runs on Amazon Web Services' **Serverless Architecture** for compilation and grading of submissions. By abstracting away all of the heavy computation from the front-end web server, the web server thus only needs the resources necessary to support simple database API call operations and front-end hosting. This also avoids the need to **over-provision** resources, like having a large static server with a large number of workers running to perform grading.

To support problems with hundreds of testcases, we use Express Step Functions to orchestrate our Lambda workflow. This supports the **concurrent invocations** of hundreds of independent Lambda graders that will grade each of the testcases. This allows for extremely quick grading times for an optimal user interface. As per latest benchmark, the problem `housevisit` with 562 testcases is graded in about 11-12 seconds.

Codebreaker Contest is built on CI/CD tools and Infrastructure As Code (IaaC). This allows for **automated deployment** of the entire ecosystem -- Databases, Storage, Compute and Grading instances -- all from the click of (a few) buttons. The entire architecture will be **completely within your own AWS account**, giving users complete ownership of the technical stack. This facilitates better security and permission allocation of testdata and problems, as well as simplified billing.

## Architecture

![Codebreaker Architecture](./docs/Codebreaker-Architecture.png)

1. All AWS resources are provisioned through **Amazon CloudFormation** and **Serverless Application Model (SAM)**. Users are only required to set parameters like judge name and timezone and all the resources will automatically be set up.
2. The front-end web server is a **React Router 7** application with server-side rendering, deployed on an **AWS EC2** instance or containerized with **Docker**. The application uses **TypeScript**, **TailwindCSS**, and **shadcn/ui** components.
3. Codebreaker's grading is performed serverlessly through an **AWS Step Functions** and **AWS Lambda** workflow. The steps are as follows:
   1. The submission is initialized and an entry created in DynamoDB.
   2. The submission is compiled with a custom **Ubuntu OS Docker container** that has GCC and Lambda installed. Lambda relies on the container being built in the user's **Elastic Container Repository (ECR)** instance. As such, CodeBuild will get the set-up scripts from Github and compile the container, before uploading it to ECR. The same tech stack is also used for compilation of checkers, supporting `testlib.h`, the industry-standard Competitive Programming checker and grader library.
   3. Three problem types are supported: **Batch** (standard I/O), **Interactive** (two-way communication), and **Communication** (two separate programs).
   4. Step Functions will concurrently invoke **wrapper Lambda functions** for testcase grading. This supports separation of permissions, allowing Lambda to function as a Sandbox for code execution before the wrapper will update the database. Note that the wrapper can have extremely **low memory allocation**, allowing for negligible compute costs.
   5. When all invocations have completed, a lambda function aggregates the testcase results and provides a final score.
4. The main Codebreaker data storage uses **AWS DynamoDB** as a serverless database that stores user and problem data.
   1. Website functionality is provided through DynamoDB **Global Secondary Indexes** for fast and robust queries.
5. **AWS Simple Storage Service (S3)** is used for file storage for testdata and submissions.
   1. **S3 Lifecycle rules** are used to transfer testcases from older problems to infrequent access storage tier to save costs.
   2. Testdata is uploaded through the admin panel. For each problem, an **ephemeral IAM role** is created with appropriate permissions that allows `PutItem` access to a specific folder of the **testdata bucket**. **Security Token Service (STS)** is used to generate temporary AWS credentials that are passed to the front-end and uses the front-end SDK to upload the files. This allows for direct uploads to S3 with built-in **multipart uploads**.
6. Real-time notifications are delivered through **AWS API Gateway WebSocket**. The system supports four notification types:
   - **Announcements** - Broadcast to all contest participants
   - **Clarifications** - Admins notified of new questions, users notified when answered
   - **Contest End** - Triggered by **AWS EventBridge Scheduler** for precise timing

   Notifications are broadcast via **Step Functions** for parallel delivery to thousands of connections.
7. User accounts and authentication are handled through **Amazon Cognito**. In the context of contests, all user accounts should be created by admins. Random credentials are generated, available for 1-time download and stored securely in an **Amazon Cognito User Pool**.
8. **Multi-contest support** allows users to participate in multiple contests simultaneously. Each contest has its own:
   - Problem set and scoreboard
   - Submission history and scores
   - Announcements and clarifications
9. **Contest timing modes**:
   - **Centralized** - All participants share the same start/end time
   - **Self-timer** - Each participant has a fixed duration starting when they begin

## Getting Started

### Installation

```bash
bun install
cp .env.example .env
```

### Development

```bash
bun dev
```

The application runs at `http://localhost:5173`. By default, it uses mock data - no AWS connection required.

### Production

```bash
bun run build
bun start
```

Set `USE_DYNAMODB=true` in your environment to connect to AWS DynamoDB.

### Initialization Scripts

After deploying your AWS infrastructure, use these scripts to set up test data:

```bash
# Create test users in Cognito (admin, alice, bob, charlie, diana)
bun run init:users

# Create test contest data in DynamoDB (users, contest, submissions)
bun run init:testdata

# Create sample problems and upload to S3 (addition, ping, prisoners)
bun run init:problems

# Run all initialization scripts in order
bun run init:all
```

**Required environment variables:**
```bash
COGNITO_USER_POOL_ID=ap-southeast-1_xxxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=ap-southeast-1
JUDGE_NAME=codebreakercontest01
```

**Test accounts created:**

| Username | Password  | Role   |
|----------|-----------|--------|
| admin    | P@55w0rd  | admin  |
| alice    | P@55w0rd  | member |
| bob      | P@55w0rd  | member |
| charlie  | P@55w0rd  | member |
| diana    | P@55w0rd  | member |

### AWS Validation

Verify all AWS resources are properly configured:

```bash
bun validate
```

This checks DynamoDB tables, S3 buckets, Lambda functions, IAM roles, Step Functions, and other infrastructure components.

## Limitations

Of course, it is natural that some trade-offs have to be made as compared to a system as secure and reliable as CMS. In particular, the grading fluctuations in Codebreaker have a slightly greater variance, and some of the specific memory leakages in interactive problems may not be protected against. However, at the end of the day, our goal isn't to be a completely secure gold standard, it's to provide **free and simple to use** contest management.

If there is demand, it is possible to release a guide on a fully automatically deployed version of Codebreaker (analysis mode judge).
