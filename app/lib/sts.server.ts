/**
 * STS Client for Temporary Credentials
 *
 * Provides scoped temporary AWS credentials for secure client-side uploads.
 */

import {
  STSClient,
  AssumeRoleCommand,
  GetCallerIdentityCommand,
} from "@aws-sdk/client-sts";
import { BucketNames, config as dbConfig } from "./db/dynamodb-client.server";

// Configuration
const config = {
  region: process.env.AWS_REGION || "ap-southeast-1",
  judgeName: dbConfig.judgeName,
};

// Create the STS client
const stsClient = new STSClient({
  region: config.region,
});

// Cache for AWS account ID
let cachedAccountId: string | null = null;

/**
 * Get AWS account ID using STS GetCallerIdentity
 */
async function getAccountId(): Promise<string> {
  if (cachedAccountId) {
    return cachedAccountId;
  }

  const response = await stsClient.send(new GetCallerIdentityCommand({}));
  if (!response.Account) {
    throw new Error("Failed to get AWS account ID");
  }

  cachedAccountId = response.Account;
  return cachedAccountId;
}

/**
 * Get the testdata upload role ARN (derived from account ID + judge name)
 */
async function getTestdataUploadRoleArn(): Promise<string> {
  const accountId = await getAccountId();
  return `arn:aws:iam::${accountId}:role/${config.judgeName}-testdata-upload-role`;
}

/**
 * Temporary credentials with expiration
 */
export interface TemporaryCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
}

/**
 * Get temporary credentials scoped to a specific S3 path
 */
async function getScopedCredentials(
  roleArn: string,
  bucket: string,
  keyPrefix: string,
  sessionName: string,
  durationSeconds = 3600
): Promise<TemporaryCredentials> {
  // Policy that restricts access to specific S3 path
  const policy = JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: ["s3:PutObject"],
        Resource: [`arn:aws:s3:::${bucket}/${keyPrefix}*`],
      },
    ],
  });

  const response = await stsClient.send(
    new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: sessionName,
      DurationSeconds: durationSeconds,
      Policy: policy,
    })
  );

  if (!response.Credentials) {
    throw new Error("Failed to assume role - no credentials returned");
  }

  const creds = response.Credentials;
  return {
    accessKeyId: creds.AccessKeyId!,
    secretAccessKey: creds.SecretAccessKey!,
    sessionToken: creds.SessionToken!,
    expiration: creds.Expiration!,
  };
}

/**
 * Testdata upload credentials with S3 details
 */
export interface TestdataUploadCredentials extends TemporaryCredentials {
  bucket: string;
  region: string;
  problemName: string;
}

/**
 * Get temporary credentials for uploading testdata
 */
export async function getTestdataUploadCredentials(
  problemName: string,
  username: string
): Promise<TestdataUploadCredentials> {
  const roleArn = await getTestdataUploadRoleArn();
  const keyPrefix = `${problemName}/`;
  const sessionName = `testdata-upload-${username}-${Date.now()}`;

  const creds = await getScopedCredentials(
    roleArn,
    BucketNames.testdata,
    keyPrefix,
    sessionName,
    3600 // 1 hour
  );

  return {
    ...creds,
    bucket: BucketNames.testdata,
    region: config.region,
    problemName,
  };
}

export { config };
