/**
 * EventBridge Scheduler Service
 *
 * Creates and manages schedules for contest end notifications.
 * Uses EventBridge Scheduler for precise one-time triggers.
 */

import {
  SchedulerClient,
  CreateScheduleCommand,
  DeleteScheduleCommand,
  GetScheduleCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-scheduler";

// Configuration - deterministic ARNs based on judgeName
const config = {
  region: process.env.AWS_REGION || "ap-southeast-1",
  judgeName: process.env.JUDGE_NAME || "codebreakercontest01",
  accountId: process.env.AWS_ACCOUNT_ID || "927878278795",
};

const NOTIFIER_ARN = `arn:aws:lambda:${config.region}:${config.accountId}:function:${config.judgeName}-contest-end-notifier`;
const SCHEDULER_ROLE_ARN = `arn:aws:iam::${config.accountId}:role/${config.judgeName}-contest-end-scheduler-role`;
const SCHEDULE_GROUP = `${config.judgeName}-contest-end`;

// Create client
const scheduler = new SchedulerClient({ region: config.region });

/**
 * Format date for EventBridge Scheduler at() expression
 * Format: YYYY-MM-DDTHH:MM:SS
 */
function formatScheduleTime(date: Date): string {
  return date.toISOString().slice(0, 19);
}

/**
 * Generate schedule name for a contest (centralized mode)
 */
function getContestScheduleName(contestId: string): string {
  return `contest-${contestId}`;
}

/**
 * Generate schedule name for a user's self-timer
 */
function getUserScheduleName(contestId: string, username: string): string {
  // Replace characters that aren't allowed in schedule names
  const safeUsername = username.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `contest-${contestId}-user-${safeUsername}`;
}

/**
 * Check if a schedule exists
 */
async function scheduleExists(name: string): Promise<boolean> {
  try {
    await scheduler.send(
      new GetScheduleCommand({
        Name: name,
        GroupName: SCHEDULE_GROUP,
      })
    );
    return true;
  } catch (error) {
    if (error instanceof ResourceNotFoundException) {
      return false;
    }
    throw error;
  }
}

/**
 * Schedule contest end notification (centralized mode)
 *
 * Called when a contest is created or updated with a new endTime.
 */
export async function scheduleContestEnd(
  contestId: string,
  endTime: Date
): Promise<void> {
  const scheduleName = getContestScheduleName(contestId);

  // Delete existing schedule if any
  await cancelContestEndSchedule(contestId);

  // Don't schedule if endTime is in the past
  if (endTime <= new Date()) {
    return;
  }

  await scheduler.send(
    new CreateScheduleCommand({
      Name: scheduleName,
      GroupName: SCHEDULE_GROUP,
      ScheduleExpression: `at(${formatScheduleTime(endTime)})`,
      Target: {
        Arn: NOTIFIER_ARN,
        RoleArn: SCHEDULER_ROLE_ARN,
        Input: JSON.stringify({
          contestId,
          mode: "centralized",
        }),
      },
      FlexibleTimeWindow: { Mode: "OFF" },
      ActionAfterCompletion: "DELETE",
    })
  );
}

/**
 * Schedule user's contest end notification (self-timer mode)
 *
 * Called when a user starts a self-timer contest.
 */
export async function scheduleUserContestEnd(
  contestId: string,
  username: string,
  endTime: Date
): Promise<void> {
  const scheduleName = getUserScheduleName(contestId, username);

  // Delete existing schedule if any
  await cancelUserContestEndSchedule(contestId, username);

  // Don't schedule if endTime is in the past
  if (endTime <= new Date()) {
    return;
  }

  await scheduler.send(
    new CreateScheduleCommand({
      Name: scheduleName,
      GroupName: SCHEDULE_GROUP,
      ScheduleExpression: `at(${formatScheduleTime(endTime)})`,
      Target: {
        Arn: NOTIFIER_ARN,
        RoleArn: SCHEDULER_ROLE_ARN,
        Input: JSON.stringify({
          contestId,
          username,
          mode: "self-timer",
        }),
      },
      FlexibleTimeWindow: { Mode: "OFF" },
      ActionAfterCompletion: "DELETE",
    })
  );
}

/**
 * Cancel contest end schedule (centralized mode)
 *
 * Called when a contest is deleted or endTime is changed.
 */
export async function cancelContestEndSchedule(contestId: string): Promise<void> {
  const scheduleName = getContestScheduleName(contestId);

  try {
    const exists = await scheduleExists(scheduleName);
    if (!exists) {
      return;
    }

    await scheduler.send(
      new DeleteScheduleCommand({
        Name: scheduleName,
        GroupName: SCHEDULE_GROUP,
      })
    );
  } catch (error) {
    if (error instanceof ResourceNotFoundException) {
      // Schedule doesn't exist, that's fine
      return;
    }
    console.error(`Failed to cancel contest end schedule: ${contestId}`, error);
    throw error;
  }
}

/**
 * Cancel user's contest end schedule (self-timer mode)
 *
 * Called when a user finishes early or contest is deleted.
 */
export async function cancelUserContestEndSchedule(
  contestId: string,
  username: string
): Promise<void> {
  const scheduleName = getUserScheduleName(contestId, username);

  try {
    const exists = await scheduleExists(scheduleName);
    if (!exists) {
      return;
    }

    await scheduler.send(
      new DeleteScheduleCommand({
        Name: scheduleName,
        GroupName: SCHEDULE_GROUP,
      })
    );
  } catch (error) {
    if (error instanceof ResourceNotFoundException) {
      // Schedule doesn't exist, that's fine
      return;
    }
    console.error(`Failed to cancel user contest end schedule: ${username} in ${contestId}`, error);
    throw error;
  }
}
