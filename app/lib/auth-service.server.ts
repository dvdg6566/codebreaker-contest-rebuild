// Auth service - uses AWS Cognito for authentication
// Re-exports cognito.server.ts functions for backwards compatibility

export {
  authenticate,
  refreshTokens,
  createUser,
  deleteUser,
  changePassword,
  getUser,
  getUserRole,
  updateUserRole,
  updateUserEmail,
  listUsers,
  parseIdToken,
  type CognitoUser,
  type AuthResult,
  type UserRole,
} from "./cognito.server";
