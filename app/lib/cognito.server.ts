import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminSetUserPasswordCommand,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminListGroupsForUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  ListUsersCommand,
  type AuthenticationResultType,
} from "@aws-sdk/client-cognito-identity-provider";

import type { UserRole } from "~/types/database";

// Cognito configuration from environment
const config = {
  region: process.env.AWS_REGION || "ap-southeast-1",
  userPoolId: process.env.COGNITO_USER_POOL_ID || "",
  clientId: process.env.COGNITO_CLIENT_ID || "",
};

const client = new CognitoIdentityProviderClient({
  region: config.region,
});

// Re-export type
export type { UserRole };

// Map between DynamoDB role names and Cognito group names
// DynamoDB uses "member" but Cognito groups might still use "contestant"
const COGNITO_GROUP_MAP: Record<string, UserRole> = {
  admin: "admin",
  contestant: "member", // Cognito "contestant" group maps to DynamoDB "member" role
  member: "member",
};

const ROLE_TO_COGNITO_GROUP: Record<UserRole, string> = {
  admin: "admin",
  member: "contestant", // DynamoDB "member" role maps to Cognito "contestant" group
};

export interface CognitoUser {
  username: string;
  role: UserRole;
  email?: string;
  createdAt?: Date;
  enabled: boolean;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
}

/**
 * Authenticate user with username and password
 */
export async function authenticate(
  username: string,
  password: string
): Promise<AuthResult> {
  const command = new InitiateAuthCommand({
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: config.clientId,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    },
  });

  const response = await client.send(command);

  if (!response.AuthenticationResult) {
    throw new Error("Authentication failed");
  }

  const result = response.AuthenticationResult as AuthenticationResultType;

  if (!result.AccessToken || !result.RefreshToken || !result.IdToken) {
    throw new Error("Incomplete authentication response");
  }

  return {
    accessToken: result.AccessToken,
    refreshToken: result.RefreshToken,
    idToken: result.IdToken,
    expiresIn: result.ExpiresIn || 3600,
  };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshTokens(refreshToken: string): Promise<AuthResult> {
  const command = new InitiateAuthCommand({
    AuthFlow: "REFRESH_TOKEN_AUTH",
    ClientId: config.clientId,
    AuthParameters: {
      REFRESH_TOKEN: refreshToken,
    },
  });

  const response = await client.send(command);

  if (!response.AuthenticationResult) {
    throw new Error("Token refresh failed");
  }

  const result = response.AuthenticationResult;

  return {
    accessToken: result.AccessToken!,
    // Refresh token is not returned on refresh, use the existing one
    refreshToken: refreshToken,
    idToken: result.IdToken!,
    expiresIn: result.ExpiresIn || 3600,
  };
}

/**
 * Create a new user (admin only)
 */
export async function createUser(
  username: string,
  password: string,
  role: UserRole = "member",
  email?: string
): Promise<CognitoUser> {
  const attributes = email
    ? [{ Name: "email", Value: email }, { Name: "email_verified", Value: "true" }]
    : [];

  // Create the user
  const createCommand = new AdminCreateUserCommand({
    UserPoolId: config.userPoolId,
    Username: username,
    TemporaryPassword: password,
    MessageAction: "SUPPRESS", // Don't send welcome email
    UserAttributes: attributes,
  });

  await client.send(createCommand);

  // Set permanent password
  const setPasswordCommand = new AdminSetUserPasswordCommand({
    UserPoolId: config.userPoolId,
    Username: username,
    Password: password,
    Permanent: true,
  });

  await client.send(setPasswordCommand);

  // Add user to appropriate group (map role to Cognito group name)
  const groupName = ROLE_TO_COGNITO_GROUP[role];
  const addToGroupCommand = new AdminAddUserToGroupCommand({
    UserPoolId: config.userPoolId,
    Username: username,
    GroupName: groupName,
  });

  try {
    await client.send(addToGroupCommand);
  } catch (error) {
    // Group might not exist, which is okay
    console.warn(`Could not add user to group ${groupName}:`, error);
  }

  return {
    username,
    role,
    email,
    enabled: true,
  };
}

/**
 * Delete a user (admin only)
 */
export async function deleteUser(username: string): Promise<void> {
  const command = new AdminDeleteUserCommand({
    UserPoolId: config.userPoolId,
    Username: username,
  });

  await client.send(command);
}

/**
 * Change user's password (admin only)
 */
export async function changePassword(
  username: string,
  newPassword: string
): Promise<void> {
  const command = new AdminSetUserPasswordCommand({
    UserPoolId: config.userPoolId,
    Username: username,
    Password: newPassword,
    Permanent: true,
  });

  await client.send(command);
}

/**
 * Get user details
 */
export async function getUser(username: string): Promise<CognitoUser | null> {
  try {
    const command = new AdminGetUserCommand({
      UserPoolId: config.userPoolId,
      Username: username,
    });

    const response = await client.send(command);

    // Get user groups to determine role
    const groupsCommand = new AdminListGroupsForUserCommand({
      UserPoolId: config.userPoolId,
      Username: username,
    });

    const groupsResponse = await client.send(groupsCommand);
    const groups = groupsResponse.Groups?.map((g) => g.GroupName) || [];

    // Map Cognito groups to DynamoDB role
    let role: UserRole = "member";
    for (const group of groups) {
      if (group && COGNITO_GROUP_MAP[group]) {
        if (COGNITO_GROUP_MAP[group] === "admin") {
          role = "admin";
          break;
        }
      }
    }

    // Extract email from attributes
    const email = response.UserAttributes?.find(
      (attr) => attr.Name === "email"
    )?.Value;

    return {
      username: response.Username!,
      role,
      email,
      createdAt: response.UserCreateDate,
      enabled: response.Enabled ?? true,
    };
  } catch (error) {
    if ((error as Error).name === "UserNotFoundException") {
      return null;
    }
    throw error;
  }
}

/**
 * Get user role from their groups
 */
export async function getUserRole(username: string): Promise<UserRole> {
  const command = new AdminListGroupsForUserCommand({
    UserPoolId: config.userPoolId,
    Username: username,
  });

  const response = await client.send(command);
  const groups = response.Groups?.map((g) => g.GroupName) || [];

  // Map Cognito groups to DynamoDB role
  for (const group of groups) {
    if (group && COGNITO_GROUP_MAP[group] === "admin") {
      return "admin";
    }
  }
  return "member";
}

/**
 * Update user role
 */
export async function updateUserRole(
  username: string,
  newRole: UserRole
): Promise<void> {
  const currentRole = await getUserRole(username);

  if (currentRole === newRole) {
    return;
  }

  // Remove from current Cognito group
  const currentGroupName = ROLE_TO_COGNITO_GROUP[currentRole];
  const removeCommand = new AdminRemoveUserFromGroupCommand({
    UserPoolId: config.userPoolId,
    Username: username,
    GroupName: currentGroupName,
  });

  try {
    await client.send(removeCommand);
  } catch (error) {
    // Group membership might not exist
  }

  // Add to new Cognito group
  const newGroupName = ROLE_TO_COGNITO_GROUP[newRole];
  const addCommand = new AdminAddUserToGroupCommand({
    UserPoolId: config.userPoolId,
    Username: username,
    GroupName: newGroupName,
  });

  await client.send(addCommand);
}

/**
 * Update user email
 */
export async function updateUserEmail(
  username: string,
  email: string
): Promise<void> {
  const command = new AdminUpdateUserAttributesCommand({
    UserPoolId: config.userPoolId,
    Username: username,
    UserAttributes: [
      { Name: "email", Value: email },
      { Name: "email_verified", Value: "true" },
    ],
  });

  await client.send(command);
}

/**
 * List all users
 */
export async function listUsers(limit = 60): Promise<CognitoUser[]> {
  const command = new ListUsersCommand({
    UserPoolId: config.userPoolId,
    Limit: limit,
  });

  const response = await client.send(command);
  const users: CognitoUser[] = [];

  for (const user of response.Users || []) {
    const email = user.Attributes?.find((attr) => attr.Name === "email")?.Value;
    const role = await getUserRole(user.Username!);

    users.push({
      username: user.Username!,
      role,
      email,
      createdAt: user.UserCreateDate,
      enabled: user.Enabled ?? true,
    });
  }

  return users;
}

/**
 * Parse JWT token to extract claims (for client-side validation)
 */
export function parseIdToken(idToken: string): {
  username: string;
  email?: string;
  groups?: string[];
} {
  try {
    const payload = idToken.split(".")[1];
    const decoded = JSON.parse(Buffer.from(payload, "base64").toString());

    return {
      username: decoded["cognito:username"] || decoded.sub,
      email: decoded.email,
      groups: decoded["cognito:groups"] || [],
    };
  } catch {
    throw new Error("Invalid ID token");
  }
}
