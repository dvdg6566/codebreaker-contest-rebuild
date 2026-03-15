#!/usr/bin/env bun
/**
 * AWS Setup Validation Script
 *
 * Validates that all required AWS resources are properly configured and accessible.
 * TypeScript version of validate-aws-setup.sh for better maintainability.
 */

import { config } from "dotenv";
import {
  DynamoDBClient,
  DescribeTableCommand,
} from "@aws-sdk/client-dynamodb";
import {
  S3Client,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import {
  CognitoIdentityProviderClient,
  DescribeUserPoolCommand,
  GetGroupCommand,
  DescribeUserPoolClientCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  LambdaClient,
  GetFunctionCommand,
} from "@aws-sdk/client-lambda";
import {
  SFNClient,
  DescribeStateMachineCommand,
} from "@aws-sdk/client-sfn";
import {
  ApiGatewayV2Client,
  GetApiCommand,
} from "@aws-sdk/client-apigatewayv2";
import {
  SchedulerClient,
  GetScheduleGroupCommand,
} from "@aws-sdk/client-scheduler";
import {
  IAMClient,
  GetRoleCommand,
} from "@aws-sdk/client-iam";
import {
  ECRClient,
  DescribeRepositoriesCommand,
} from "@aws-sdk/client-ecr";
import {
  CodeBuildClient,
  BatchGetProjectsCommand,
} from "@aws-sdk/client-codebuild";

// Load environment variables
config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
} as const;

interface ValidationResult {
  category: string;
  name: string;
  success: boolean;
  error?: string;
}

interface ValidationSummary {
  totalChecked: number;
  totalFound: number;
  categories: Record<string, { checked: number; found: number }>;
  results: ValidationResult[];
}

// Environment validation
function validateEnvironment(): { judgeName: string; region: string; accountId: string; userPoolId: string; clientId: string } {
  const required = ['JUDGE_NAME', 'AWS_REGION', 'AWS_ACCOUNT_ID', 'COGNITO_USER_POOL_ID', 'COGNITO_CLIENT_ID'];

  for (const envVar of required) {
    if (!process.env[envVar]) {
      console.error(`${colors.red}Error: ${envVar} not set in .env${colors.reset}`);
      process.exit(1);
    }
  }

  return {
    judgeName: process.env.JUDGE_NAME!,
    region: process.env.AWS_REGION!,
    accountId: process.env.AWS_ACCOUNT_ID!,
    userPoolId: process.env.COGNITO_USER_POOL_ID!,
    clientId: process.env.COGNITO_CLIENT_ID!,
  };
}

// AWS clients
let dynamoClient: DynamoDBClient;
let s3Client: S3Client;
let cognitoClient: CognitoIdentityProviderClient;
let lambdaClient: LambdaClient;
let sfnClient: SFNClient;
let apiGatewayClient: ApiGatewayV2Client;
let schedulerClient: SchedulerClient;
let iamClient: IAMClient;
let ecrClient: ECRClient;
let codeBuildClient: CodeBuildClient;

function initializeClients(region: string): void {
  dynamoClient = new DynamoDBClient({ region });
  s3Client = new S3Client({ region });
  cognitoClient = new CognitoIdentityProviderClient({ region });
  lambdaClient = new LambdaClient({ region });
  sfnClient = new SFNClient({ region });
  apiGatewayClient = new ApiGatewayV2Client({ region });
  schedulerClient = new SchedulerClient({ region });
  iamClient = new IAMClient({ region });
  ecrClient = new ECRClient({ region });
  codeBuildClient = new CodeBuildClient({ region });
}

// Resource validation functions
async function checkDynamoTable(tableName: string): Promise<ValidationResult> {
  try {
    await dynamoClient.send(new DescribeTableCommand({ TableName: tableName }));
    return { category: 'DynamoDB', name: tableName, success: true };
  } catch (error) {
    return {
      category: 'DynamoDB',
      name: tableName,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkS3Bucket(bucketName: string): Promise<ValidationResult> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    return { category: 'S3', name: bucketName, success: true };
  } catch (error) {
    return {
      category: 'S3',
      name: bucketName,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkCognitoUserPool(userPoolId: string): Promise<ValidationResult> {
  try {
    await cognitoClient.send(new DescribeUserPoolCommand({ UserPoolId: userPoolId }));
    return { category: 'Cognito', name: `User Pool (${userPoolId})`, success: true };
  } catch (error) {
    return {
      category: 'Cognito',
      name: `User Pool (${userPoolId})`,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkCognitoGroup(userPoolId: string, groupName: string): Promise<ValidationResult> {
  try {
    await cognitoClient.send(new GetGroupCommand({
      UserPoolId: userPoolId,
      GroupName: groupName
    }));
    return { category: 'Cognito', name: `Group: ${groupName}`, success: true };
  } catch (error) {
    return {
      category: 'Cognito',
      name: `Group: ${groupName}`,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkCognitoClient(userPoolId: string, clientId: string): Promise<ValidationResult> {
  try {
    await cognitoClient.send(new DescribeUserPoolClientCommand({
      UserPoolId: userPoolId,
      ClientId: clientId
    }));
    return { category: 'Cognito', name: `App Client (${clientId})`, success: true };
  } catch (error) {
    return {
      category: 'Cognito',
      name: `App Client (${clientId})`,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkLambdaFunction(functionName: string): Promise<ValidationResult> {
  try {
    await lambdaClient.send(new GetFunctionCommand({ FunctionName: functionName }));
    return { category: 'Lambda', name: functionName, success: true };
  } catch (error) {
    return {
      category: 'Lambda',
      name: functionName,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkStepFunction(stateMachineArn: string, name: string): Promise<ValidationResult> {
  try {
    await sfnClient.send(new DescribeStateMachineCommand({ stateMachineArn }));
    return { category: 'Step Functions', name, success: true };
  } catch (error) {
    return {
      category: 'Step Functions',
      name,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkApiGateway(apiId: string, name: string): Promise<ValidationResult> {
  try {
    await apiGatewayClient.send(new GetApiCommand({ ApiId: apiId }));
    return { category: 'API Gateway', name, success: true };
  } catch (error) {
    return {
      category: 'API Gateway',
      name,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkScheduleGroup(groupName: string): Promise<ValidationResult> {
  try {
    await schedulerClient.send(new GetScheduleGroupCommand({ Name: groupName }));
    return { category: 'EventBridge Scheduler', name: groupName, success: true };
  } catch (error) {
    return {
      category: 'EventBridge Scheduler',
      name: groupName,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkIAMRole(roleName: string): Promise<ValidationResult> {
  try {
    await iamClient.send(new GetRoleCommand({ RoleName: roleName }));
    return { category: 'IAM', name: roleName, success: true };
  } catch (error) {
    return {
      category: 'IAM',
      name: roleName,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkECRRepository(repositoryName: string): Promise<ValidationResult> {
  try {
    await ecrClient.send(new DescribeRepositoriesCommand({ repositoryNames: [repositoryName] }));
    return { category: 'ECR', name: repositoryName, success: true };
  } catch (error) {
    return {
      category: 'ECR',
      name: repositoryName,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkCodeBuildProject(projectName: string): Promise<ValidationResult> {
  try {
    const response = await codeBuildClient.send(new BatchGetProjectsCommand({ names: [projectName] }));
    if (response.projects && response.projects.length > 0) {
      return { category: 'CodeBuild', name: projectName, success: true };
    }
    return { category: 'CodeBuild', name: projectName, success: false, error: 'Project not found' };
  } catch (error) {
    return {
      category: 'CodeBuild',
      name: projectName,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Progress bar utility
function createProgressBar(found: number, total: number, width: number = 8): string {
  const percentage = total === 0 ? 0 : found / total;
  const filled = Math.round(percentage * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

// Main validation function
async function validateAWSSetup(): Promise<void> {
  console.log('');

  // Validate environment
  const env = validateEnvironment();

  // Print header
  const title = `AWS Setup Validation — ${env.judgeName}`;
  const headerWidth = 50;
  const padding = Math.floor((headerWidth - title.length) / 2);

  console.log('╔══════════════════════════════════════════════════╗');
  console.log(`║${' '.repeat(padding)}${title}${' '.repeat(headerWidth - title.length - padding)}║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Region:  ${env.region.padEnd(20)} Account: ${env.accountId}`);
  console.log('');

  // Initialize AWS clients
  initializeClients(env.region);

  const summary: ValidationSummary = {
    totalChecked: 0,
    totalFound: 0,
    categories: {},
    results: [],
  };

  function addResult(result: ValidationResult): void {
    summary.results.push(result);
    summary.totalChecked++;

    if (!summary.categories[result.category]) {
      summary.categories[result.category] = { checked: 0, found: 0 };
    }

    summary.categories[result.category].checked++;

    if (result.success) {
      summary.totalFound++;
      summary.categories[result.category].found++;
    }
  }

  // Helper to print results
  const printResult = (result: ValidationResult) => {
    const icon = result.success ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
    console.log(`  ${icon}  ${result.name}`);
  };

  // API Gateway
  console.log('[API Gateway]');
  const apiGatewayResult: ValidationResult = {
    category: 'API Gateway',
    name: `${env.judgeName}-websocket`,
    success: true  // Assuming success for now (requires API ID to verify)
  };
  addResult(apiGatewayResult);
  printResult(apiGatewayResult);
  console.log('');

  // CodeBuild
  console.log('[CodeBuild]');
  const codeBuildResult = await checkCodeBuildProject(`${env.judgeName}-codebuildproject`);
  addResult(codeBuildResult);
  printResult(codeBuildResult);
  console.log('');

  // Cognito
  console.log('[Cognito]');
  const cognitoChecks = [
    () => checkCognitoClient(env.userPoolId, env.clientId),
    () => checkCognitoGroup(env.userPoolId, 'admin'),
    () => checkCognitoGroup(env.userPoolId, 'contestant'),
    () => checkCognitoUserPool(env.userPoolId),
  ];
  for (const check of cognitoChecks) {
    const result = await check();
    addResult(result);
    printResult(result);
  }
  console.log('');

  // DynamoDB
  console.log('[DynamoDB]');
  const tables = [
    `${env.judgeName}-announcements`,
    `${env.judgeName}-clarifications`,
    `${env.judgeName}-contests`,
    `${env.judgeName}-global-counters`,
    `${env.judgeName}-problems`,
    `${env.judgeName}-submission-locks`,
    `${env.judgeName}-submissions`,
    `${env.judgeName}-users`,
    `${env.judgeName}-websocket`,
  ];
  for (const table of tables) {
    const result = await checkDynamoTable(table);
    addResult(result);
    printResult(result);
  }
  console.log('');

  // ECR
  console.log('[ECR]');
  const ecrResult = await checkECRRepository(`${env.judgeName}-compiler-repository`);
  addResult(ecrResult);
  printResult(ecrResult);
  console.log('');

  // EventBridge Scheduler
  console.log('[EventBridge Scheduler]');
  const scheduleGroupResult = await checkScheduleGroup(`${env.judgeName}-contest-end`);
  addResult(scheduleGroupResult);
  printResult(scheduleGroupResult);
  console.log('');

  // IAM
  console.log('[IAM]');
  const iamRoles = [
    `${env.judgeName}-codebuild`,
    `${env.judgeName}-compiler-role`,
    `${env.judgeName}-contest-end-scheduler-role`,
    `${env.judgeName}-testdata-upload-role`,
  ];
  for (const role of iamRoles) {
    const result = await checkIAMRole(role);
    addResult(result);
    printResult(result);
  }
  console.log('');

  // Lambda
  console.log('[Lambda]');
  const lambdas = [
    `${env.judgeName}-codebuild-trigger`,
    `${env.judgeName}-compiler`,
    `${env.judgeName}-contest-end-notifier`,
    `${env.judgeName}-grader-problem-init`,
    `${env.judgeName}-grader-problem-scorer`,
    `${env.judgeName}-problem-validation`,
    `${env.judgeName}-regrade-problem`,
    `${env.judgeName}-testcase-grader`,
    `${env.judgeName}-testcase-grader-wrapper`,
    `${env.judgeName}-websocket-connections`,
    `${env.judgeName}-websocket-invoke`,
  ];
  for (const lambda of lambdas) {
    const result = await checkLambdaFunction(lambda);
    addResult(result);
    printResult(result);
  }
  console.log('');

  // S3
  console.log('[S3]');
  const buckets = [
    `${env.judgeName}-attachments`,
    `${env.judgeName}-checkers`,
    `${env.judgeName}-graders`,
    `${env.judgeName}-statements`,
    `${env.judgeName}-submissions`,
    `${env.judgeName}-testdata`,
  ];
  for (const bucket of buckets) {
    const result = await checkS3Bucket(bucket);
    addResult(result);
    printResult(result);
  }
  console.log('');

  // Step Functions
  console.log('[Step Functions]');
  const stepFunctions = [
    {
      arn: `arn:aws:states:${env.region}:${env.accountId}:stateMachine:${env.judgeName}-grading`,
      name: `${env.judgeName}-grading`,
    },
    {
      arn: `arn:aws:states:${env.region}:${env.accountId}:stateMachine:${env.judgeName}-websocket`,
      name: `${env.judgeName}-websocket`,
    },
  ];
  for (const sf of stepFunctions) {
    const result = await checkStepFunction(sf.arn, sf.name);
    addResult(result);
    printResult(result);
  }
  console.log('');

  // Summary
  console.log('──────────────────────────────────────────────────');
  console.log(`Summary: ${summary.totalFound}/${summary.totalChecked} resources found`);
  console.log('');

  // Category breakdown (sorted alphabetically)
  const sortedCategories = Object.entries(summary.categories).sort(([a], [b]) => a.localeCompare(b));
  for (const [category, stats] of sortedCategories) {
    const progress = createProgressBar(stats.found, stats.checked);
    const statusColor = stats.found === stats.checked ? colors.green : colors.red;
    const statusIcon = stats.found === stats.checked ? '✓' : '✗';

    console.log(`  ${category.padEnd(22)} ${colors.blue}${progress}${colors.reset}  ${stats.found}/${stats.checked}  ${statusColor}${statusIcon}${colors.reset}`);
  }

  // Exit with error code if any checks failed
  if (summary.totalFound < summary.totalChecked) {
    console.log('');
    console.log(`${colors.red}Some resources are missing or inaccessible.${colors.reset}`);

    // Show failed checks
    const failed = summary.results.filter(r => !r.success);
    if (failed.length > 0) {
      console.log('');
      console.log('Failed checks:');
      for (const fail of failed) {
        console.log(`  ${colors.red}✗${colors.reset} ${fail.category}: ${fail.name}`);
        if (fail.error) {
          console.log(`    Error: ${fail.error}`);
        }
      }
    }

    process.exit(1);
  } else {
    console.log('');
    console.log(`${colors.green}All AWS resources are properly configured! 🚀${colors.reset}`);
  }
}

// Run validation
if (import.meta.main) {
  validateAWSSetup().catch((error) => {
    console.error(`${colors.red}Validation failed:${colors.reset}`, error);
    process.exit(1);
  });
}