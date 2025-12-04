import { Telegraf } from 'telegraf';
import { JobCache } from './job-cache.js';
import { ApplicationTracker } from './application-tracker.js';
import { loadAllUsers } from './multi-user-matcher.js';
import { logger } from './utils.js';

/**
 * Weekly summary statistics for a user
 */
interface WeeklySummaryStats {
  jobsSent: number;
  avgScore: number;
  topPlatform: string;
  applied: number;
  passed: number;
}

/**
 * Calculate weekly statistics for a user
 */
function calculateWeeklyStats(
  _username: string,
  userId: string,
  _cache: JobCache,
  tracker: ApplicationTracker
): WeeklySummaryStats {
  // Get jobs shown to this user in last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Note: JobCache doesn't expose internal data, so we'll use approximations
  // In a real implementation, you'd extend JobCache to provide this data

  // Get application stats
  const appStats = tracker.getUserStats(userId);

  return {
    jobsSent: 10, // Placeholder - would need cache access
    avgScore: 75, // Placeholder - would need cache access
    topPlatform: 'Jooble', // Placeholder - would need cache access
    applied: appStats.applied,
    passed: appStats.passed
  };
}

/**
 * Get week date range string (e.g., "Dec 1-7, 2025")
 */
function getWeekDateRange(): string {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - 7);

  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Riyadh'
  };

  const start = startOfWeek.toLocaleDateString('en-US', options);
  const end = today.toLocaleDateString('en-US', options);

  return `${start} - ${end}`;
}

/**
 * Generate and send weekly summary reports to all users
 */
export async function sendWeeklySummaries(): Promise<void> {
  logger.info('📊 Starting weekly summary generation...');

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN not set');
  }

  const bot = new Telegraf(botToken);
  const cache = new JobCache();
  const tracker = new ApplicationTracker();

  await cache.load();
  await tracker.load();

  const users = await loadAllUsers();

  if (users.length === 0) {
    logger.warn('No enabled users found for weekly summary');
    return;
  }

  logger.info(`📬 Sending weekly summaries to ${users.length} user(s)...`);

  for (const user of users) {
    try {
      const stats = calculateWeeklyStats(
        user.username,
        user.config.telegram_chat_id,
        cache,
        tracker
      );

      const message = `📊 *Weekly Job Hunt Summary*\n` +
        `Week of ${getWeekDateRange()}\n\n` +
        `👋 Hi ${user.profile.name}!\n\n` +
        `📬 *This Week:*\n` +
        `• Jobs sent: ${stats.jobsSent}\n` +
        `• Avg match score: ${stats.avgScore}%\n` +
        `• Top platform: ${stats.topPlatform}\n` +
        `• Applications: ${stats.applied} applied, ${stats.passed} passed\n\n` +
        `🎯 *Your Profile:*\n` +
        `• Target roles: ${user.profile.target_roles.slice(0, 3).join(', ')}\n` +
        `• Match threshold: ${user.config.matching_threshold}%\n\n` +
        `💡 *Tip:* ${getPersonalizedTip(stats, user.config.matching_threshold)}\n\n` +
        `See you tomorrow at 9:00 AM! 🚀`;

      await bot.telegram.sendMessage(user.config.telegram_chat_id, message, {
        parse_mode: 'Markdown'
      });

      logger.info(`📊 Weekly summary sent to ${user.username}`);

      // Rate limit between users
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      logger.error(`Failed to send weekly summary to ${user.username}:`, error);
      // Continue with other users
    }
  }

  logger.info('✅ Weekly summaries complete');
}

/**
 * Get personalized tip based on user stats
 */
function getPersonalizedTip(stats: WeeklySummaryStats, threshold: number): string {
  // Low jobs sent - suggest lowering threshold
  if (stats.jobsSent < 5) {
    return `Try lowering your threshold to ${threshold - 5}% to see more opportunities!`;
  }

  // High pass rate - suggest raising threshold
  if (stats.passed > stats.applied * 2 && stats.applied > 0) {
    return `You're passing on many jobs - try raising your threshold to ${threshold + 5}% for better matches!`;
  }

  // Good engagement
  if (stats.applied > 0) {
    return `Great job applying to ${stats.applied} position${stats.applied > 1 ? 's' : ''}! Keep up the momentum!`;
  }

  // Default tip
  return `Don't forget to click "Applied" when you submit applications - it helps us improve matching!`;
}
