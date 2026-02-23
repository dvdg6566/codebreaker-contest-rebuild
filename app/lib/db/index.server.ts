/**
 * Database Service Layer - Entry Point
 *
 * This module provides a unified interface for database operations using DynamoDB.
 */

// Re-export all service modules
export * from "./users.server";
export * from "./contests.server";
export * from "./problems.server";
export * from "./submissions.server";
export * from "./announcements.server";
export * from "./clarifications.server";
export * from "./counters.server";

// Re-export DynamoDB client config
export { TableNames, BucketNames, config } from "./dynamodb-client.server";
