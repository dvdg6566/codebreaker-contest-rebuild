#!/usr/bin/env bun
/**
 * Initialize Test Users in AWS Cognito
 *
 * This script creates test user accounts in the Cognito User Pool:
 * - admin (role: admin)
 * - alice, bob, charlie, diana (role: member/contestant)
 *
 * Required environment variables:
 * - COGNITO_USER_POOL_ID: The Cognito User Pool ID
 * - COGNITO_CLIENT_ID: The Cognito App Client ID
 * - AWS_REGION: AWS region (default: ap-southeast-1)
 *
 * Usage: bun run scripts/init-users.ts
 *
 * Default password for all users: P@55w0rd
 */

import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminAddUserToGroupCommand,
  AdminGetUserCommand,
  CreateGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";

// Configuration
const config = {
  region: process.env.AWS_REGION || "ap-southeast-1",
  userPoolId: process.env.COGNITO_USER_POOL_ID || "",
  clientId: process.env.COGNITO_CLIENT_ID || "",
};

if (!config.userPoolId) {
  console.error("Error: COGNITO_USER_POOL_ID environment variable is required");
  process.exit(1);
}

const client = new CognitoIdentityProviderClient({
  region: config.region,
});

// Default password for all test users
const DEFAULT_PASSWORD = "P@55w0rd";

// Test users to create (matches init-testdata.ts)
const TEST_USERS = [
  {
    username: "admin",
    email: "admin@example.com",
    fullname: "Admin User",
    role: "admin" as const,
  },
  {
    username: "alice",
    email: "alice@example.com",
    fullname: "Alice Chen",
    role: "member" as const,
  },
  {
    username: "bob",
    email: "bob@example.com",
    fullname: "Bob Smith",
    role: "member" as const,
  },
  {
    username: "charlie",
    email: "charlie@example.com",
    fullname: "Charlie Brown",
    role: "member" as const,
  },
  {
    username: "diana",
    email: "diana@example.com",
    fullname: "Diana Prince",
    role: "member" as const,
  },
];

// Map roles to Cognito group names
const ROLE_TO_GROUP: Record<string, string> = {
  admin: "admin",
  member: "contestant",
};

/**
 * Ensure Cognito groups exist
 */
async function ensureGroupsExist(): Promise<void> {
  const groups = ["admin", "contestant"];

  for (const groupName of groups) {
    try {
      await client.send(
        new CreateGroupCommand({
          UserPoolId: config.userPoolId,
          GroupName: groupName,
          Description: `${groupName} group for contest users`,
        })
      );
      console.log(`  Created group: ${groupName}`);
    } catch (error) {
      if ((error as Error).name === "GroupExistsException") {
        console.log(`  Group already exists: ${groupName}`);
      } else {
        throw error;
      }
    }
  }
}

/**
 * Check if user already exists
 */
async function userExists(username: string): Promise<boolean> {
  try {
    await client.send(
      new AdminGetUserCommand({
        UserPoolId: config.userPoolId,
        Username: username,
      })
    );
    return true;
  } catch (error) {
    if ((error as Error).name === "UserNotFoundException") {
      return false;
    }
    throw error;
  }
}

/**
 * Create a user in Cognito
 */
async function createUser(user: (typeof TEST_USERS)[0]): Promise<void> {
  const { username, email, fullname, role } = user;

  // Check if user already exists
  if (await userExists(username)) {
    console.log(`  User already exists: ${username} (skipping)`);
    return;
  }

  // Create the user with temporary password
  await client.send(
    new AdminCreateUserCommand({
      UserPoolId: config.userPoolId,
      Username: username,
      TemporaryPassword: DEFAULT_PASSWORD,
      MessageAction: "SUPPRESS", // Don't send welcome email
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "email_verified", Value: "true" },
        { Name: "name", Value: fullname },
      ],
    })
  );

  // Set permanent password (so user doesn't need to change on first login)
  await client.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: config.userPoolId,
      Username: username,
      Password: DEFAULT_PASSWORD,
      Permanent: true,
    })
  );

  // Add user to appropriate group
  const groupName = ROLE_TO_GROUP[role];
  await client.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: config.userPoolId,
      Username: username,
      GroupName: groupName,
    })
  );

  console.log(`  Created user: ${username} (${role}) -> group: ${groupName}`);
}

// ============================================================================
// Main
// ============================================================================
async function main(): Promise<void> {
  console.log("=== Initializing Cognito Test Users ===");
  console.log(`User Pool ID: ${config.userPoolId}`);
  console.log(`Region: ${config.region}`);
  console.log(`Default Password: ${DEFAULT_PASSWORD}`);

  try {
    // Ensure groups exist
    console.log("\n--- Ensuring Groups Exist ---");
    await ensureGroupsExist();

    // Create users
    console.log("\n--- Creating Users ---");
    for (const user of TEST_USERS) {
      await createUser(user);
    }

    console.log("\n=== Cognito User Initialization Complete ===");
    console.log("\nTest accounts created:");
    console.log("┌─────────────┬─────────────┬──────────────┐");
    console.log("│ Username    │ Password    │ Role         │");
    console.log("├─────────────┼─────────────┼──────────────┤");
    for (const user of TEST_USERS) {
      const username = user.username.padEnd(11);
      const password = DEFAULT_PASSWORD.padEnd(11);
      const role = user.role.padEnd(12);
      console.log(`│ ${username} │ ${password} │ ${role} │`);
    }
    console.log("└─────────────┴─────────────┴──────────────┘");

    console.log("\nNext steps:");
    console.log("1. Run 'bun run scripts/init-testdata.ts' to create DynamoDB records");
    console.log("2. Run 'bun run scripts/init-problems.ts' to create sample problems");
  } catch (error) {
    console.error("Error during initialization:", error);
    process.exit(1);
  }
}

main();
