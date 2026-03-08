/**
 * DynamoDB Client Configuration
 *
 * Provides a configured DynamoDB client and table name helpers.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
  type GetCommandInput,
  type PutCommandInput,
  type UpdateCommandInput,
  type DeleteCommandInput,
  type ScanCommandInput,
  type QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";

// Configuration from environment
const config = {
  region: process.env.AWS_REGION || "ap-southeast-1",
  judgeName: process.env.JUDGE_NAME || "codebreakercontest01",
};

// Create the low-level DynamoDB client
const client = new DynamoDBClient({
  region: config.region,
});

// Create the document client with marshalling options
export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

// Table name helpers
export const TableNames = {
  users: `${config.judgeName}-users`,
  contests: `${config.judgeName}-contests`,
  problems: `${config.judgeName}-problems`,
  submissions: `${config.judgeName}-submissions`,
  submissionLocks: `${config.judgeName}-submission-locks`,
  announcements: `${config.judgeName}-announcements`,
  clarifications: `${config.judgeName}-clarifications`,
  globalCounters: `${config.judgeName}-global-counters`,
  websocket: `${config.judgeName}-websocket`,
} as const;

// S3 bucket names
export const BucketNames = {
  submissions: `${config.judgeName}-submissions`,
  testdata: `${config.judgeName}-testdata`,
  statements: `${config.judgeName}-statements`,
  attachments: `${config.judgeName}-attachments`,
  checkers: `${config.judgeName}-checkers`,
  graders: `${config.judgeName}-graders`,
} as const;

// Re-export commands for convenience
export {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
};

export type {
  GetCommandInput,
  PutCommandInput,
  UpdateCommandInput,
  DeleteCommandInput,
  ScanCommandInput,
  QueryCommandInput,
};

// Export config for debugging
export { config };
