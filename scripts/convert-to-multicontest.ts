#!/usr/bin/env bun
/**
 * Convert existing single-contest data to multi-contest format
 *
 * This script transforms legacy user data to the new multi-contest schema.
 * Run this once to convert existing database entries.
 */

import { listUsers, updateUser } from "~/lib/db/users.server";
import type { User, ContestParticipation } from "~/types/database";
import { formatDateTime } from "~/types/database";

interface LegacyUser {
  username: string;
  role: string;
  fullname: string;
  email: string;
  label: string;

  // Legacy fields to convert
  contest?: string;
  problemScores?: Record<string, number>;
  problemSubmissions?: Record<string, number>;
  latestSubmissions?: Record<string, string>;
  latestScoreChange?: string;
}

export async function convertUsersToMultiContest() {
  console.log("🔄 Converting users to multi-contest format...");

  try {
    const users = await listUsers();
    console.log(`📊 Found ${users.length} users to process`);

    let converted = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
      try {
        const legacyUser = user as any as LegacyUser;

        // Skip if user already has multi-contest format
        if (user.activeContests && typeof user.activeContests === 'object') {
          console.log(`✅ ${user.username} already in new format`);
          skipped++;
          continue;
        }

        // Convert to new format
        const updates: Partial<User> = {
          activeContests: {},
          contestScores: {},
          contestSubmissions: {},
          contestLatestSubmissions: {},
        };

        // Convert single contest assignment to multi-contest
        if (legacyUser.contest) {
          const now = formatDateTime(new Date());
          const startTime = legacyUser.latestScoreChange || now;

          updates.activeContests = {
            [legacyUser.contest]: {
              status: "started", // Assume existing users have started
              joinedAt: startTime,
              startedAt: startTime,
            } as ContestParticipation
          };

          // Migrate scores to contest-specific format
          if (legacyUser.problemScores) {
            updates.contestScores = {
              [legacyUser.contest]: legacyUser.problemScores
            };
          }

          if (legacyUser.problemSubmissions) {
            updates.contestSubmissions = {
              [legacyUser.contest]: legacyUser.problemSubmissions
            };
          }

          if (legacyUser.latestSubmissions) {
            updates.contestLatestSubmissions = {
              [legacyUser.contest]: legacyUser.latestSubmissions
            };
          }

          console.log(`🔄 Converting ${user.username}: contest=${legacyUser.contest}, scores=${Object.keys(legacyUser.problemScores || {}).length}`);
        } else {
          // User has no contest assignment - just add empty multi-contest structure
          console.log(`🔄 Converting ${user.username}: no contest assignment`);
        }

        // Update user with new format
        await updateUser(user.username, updates);
        converted++;

        console.log(`✅ Converted ${user.username}`);

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Failed to convert ${user.username}: ${errorMsg}`);
        errors++;
      }
    }

    console.log("\n🎉 Conversion Summary:");
    console.log(`✅ Successfully converted: ${converted} users`);
    console.log(`⏭️  Already converted: ${skipped} users`);
    console.log(`❌ Failed conversions: ${errors} users`);

    if (errors > 0) {
      console.log("\n⚠️  Some users failed to convert. Check the errors above and run the script again if needed.");
      process.exit(1);
    } else {
      console.log("\n🎊 All users successfully converted to multi-contest format!");
    }

  } catch (error) {
    console.error("💥 Conversion failed:", error);
    process.exit(1);
  }
}

// Run conversion if this script is called directly
if (import.meta.main) {
  convertUsersToMultiContest()
    .then(() => process.exit(0))
    .catch(error => {
      console.error("💥 Script failed:", error);
      process.exit(1);
    });
}