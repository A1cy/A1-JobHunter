import { Telegraf, Markup } from 'telegraf';
import { Job, logger } from './utils.js';
import { UserMatchResult } from './multi-user-matcher.js';
import { JobCache } from './job-cache.js';
import { ApplicationTracker } from './application-tracker.js';

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format a single job message with inline action buttons
 */
function formatJobMessage(job: Job): { text: string; keyboard: any } {
  const scoreEmoji = (job.score || 0) >= 85 ? '🌟' : (job.score || 0) >= 70 ? '⭐' : '✅';

  // ✅ Enhanced message format (better readability, more match reasons)
  const text = `*${job.title}*\n` +
    `🏢 ${job.company} | 📍 ${job.location}\n` +
    `📊 Match: ${job.score || 0}% ${scoreEmoji}\n` +
    (job.matchReasons && job.matchReasons.length > 0
      ? `\n💡 *Why this matches:*\n${job.matchReasons.slice(0, 3).map(r => `   • ${r}`).join('\n')}\n`
      : '') +
    `\n━━━━━━━━━━━━━━━━`;

  // ✅ Interactive buttons for job tracking (Applied/Passed) + Apply Now
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Applied', `applied_${job.id}`),
      Markup.button.callback('❌ Passed', `passed_${job.id}`)
    ],
    [Markup.button.url('🔗 Apply Now', job.url)]
  ]);

  return { text, keyboard };
}

/**
 * Send personalized jobs to a single user
 */
async function sendPersonalizedJobs(
  result: UserMatchResult,
  bot: Telegraf
): Promise<void> {
  const chatId = result.config.telegram_chat_id;

  try {
    // 🔒 Privacy-first: Use first name only by default, full name if explicitly enabled
    const displayName = result.config.message_options?.show_full_name
      ? result.profile.name
      : result.profile.name.split(' ')[0]; // Just first name

    let headerMessage = `🎯 *Job Hunter - ${displayName}*\n` +
      `${new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Riyadh'
      })}\n\n` +
      `Found *${result.matched_jobs.length} jobs* matching YOUR profile 🎉\n\n`;

    // Only show detailed stats if any are enabled
    const showAnyStats = result.config.message_options?.show_total_scanned ||
                         result.config.message_options?.show_avg_score ||
                         result.config.message_options?.show_threshold ||
                         result.config.message_options?.show_high_match_count !== false;

    if (showAnyStats) {
      headerMessage += `📊 *Your Match Summary:*\n`;

      if (result.config.message_options?.show_total_scanned) {
        headerMessage += `• Total Jobs Scanned: ${result.stats.total_jobs_checked}\n`;
      }

      // Jobs Matched always shown (core feature)
      headerMessage += `• Jobs Matched: ${result.matched_jobs.length}\n`;

      if (result.config.message_options?.show_avg_score) {
        headerMessage += `• Average Match Score: ${result.stats.avg_score}%\n`;
      }

      if (result.config.message_options?.show_high_match_count !== false) {
        headerMessage += `• High Match (≥85%): ${result.stats.high_match_count} jobs\n`;
      }

      if (result.config.message_options?.show_threshold) {
        headerMessage += `• Threshold: ≥${result.config.matching_threshold}%\n`;
      }

      headerMessage += `\n`;
    }

    headerMessage += `───────────────────────`;

    await bot.telegram.sendMessage(chatId, headerMessage, {
      parse_mode: 'Markdown'
    });

    // Small delay after header
    await sleep(500);

    // Send each job with action buttons
    if (result.matched_jobs.length > 0) {
      for (const job of result.matched_jobs) {
        const { text, keyboard } = formatJobMessage(job);

        await bot.telegram.sendMessage(chatId, text, {
          parse_mode: 'Markdown',
          ...keyboard
        });

        // Rate limit between messages (500ms)
        await sleep(500);
      }
    }

    // Footer message
    const footerMessage = `\n───────────────────────\n` +
      `✨ *Daily Job Hunt Complete!*\n\n` +
      `💼 Best of luck with your applications!\n` +
      `🔔 Next update: Tomorrow at 9:00 AM Riyadh time`;

    await bot.telegram.sendMessage(chatId, footerMessage, {
      parse_mode: 'Markdown'
    });

    logger.info(`✅ Sent ${result.matched_jobs.length} jobs to ${result.username} (${result.profile.name})`);

  } catch (error) {
    logger.error(`❌ Error sending to ${result.username}:`, error);
    throw error;
  }
}

/**
 * Send jobs to all users with personalized matching
 */
export async function sendToAllUsers(results: UserMatchResult[]): Promise<void> {
  // Load job cache to filter duplicates
  const cache = new JobCache();
  await cache.load();

  // Handle case where no jobs were found at all (empty array passed)
  if (results.length === 0) {
    logger.warn('⚠️  No jobs to send - notifying all users');

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN environment variable is not set');
    }

    const { loadAllUsers } = await import('./multi-user-matcher.js');
    const users = await loadAllUsers();

    if (users.length === 0) {
      logger.warn('⚠️  No enabled users found');
      return;
    }

    const bot = new Telegraf(botToken);
    const noJobsMessage = `🔍 *Job Hunter - Daily Update*\n` +
      `${new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Riyadh'
      })}\n\n` +
      `No new jobs found today matching your profile.\n\n` +
      `Don't worry! We'll keep searching and notify you tomorrow at 9:00 AM Riyadh time. 🎯`;

    for (const user of users) {
      try {
        await bot.telegram.sendMessage(user.config.telegram_chat_id, noJobsMessage, {
          parse_mode: 'Markdown'
        });
        logger.info(`✅ Sent "no jobs" notification to ${user.username}`);
        await sleep(500);
      } catch (error) {
        logger.error(`Failed to notify ${user.username}:`, error);
      }
    }

    return;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN environment variable is not set');
  }

  const bot = new Telegraf(botToken);

  logger.info(`📱 Sending personalized jobs to ${results.length} user(s)...`);

  for (const result of results) {
    try {
      // Filter out jobs shown to this user in last 3 days
      const freshJobs = cache.filterRecentlyShown(
        result.matched_jobs,
        result.username,
        3 // Don't show same job within 3 days
      );

      const stats = cache.getFilterStats(result.matched_jobs, result.username, 3);
      logger.info(
        `📊 ${result.username}: ${stats.total} matched → ` +
        `${stats.fresh} fresh (filtered ${stats.duplicates} duplicates)`
      );

      if (freshJobs.length > 0) {
        // Send fresh jobs to user
        await sendPersonalizedJobs(
          { ...result, matched_jobs: freshJobs },
          bot
        );

        // Mark jobs as shown
        for (const job of freshJobs) {
          cache.markAsShown(job, result.username);
        }
      } else {
        // Send "no new jobs" message with privacy
        const displayName = result.config.message_options?.show_full_name
          ? result.profile.name
          : result.profile.name.split(' ')[0];

        const noNewJobsMessage = `🔍 *Job Hunter - ${displayName}*\n` +
          `${new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'Asia/Riyadh'
          })}\n\n` +
          `No new jobs today (${stats.total} jobs matched but already shown recently).\n\n` +
          `We'll keep searching! 🎯`;

        await bot.telegram.sendMessage(
          result.config.telegram_chat_id,
          noNewJobsMessage,
          { parse_mode: 'Markdown' }
        );
        logger.info(`ℹ️  No fresh jobs for ${result.username} (all ${stats.total} were duplicates)`);
      }

      // Rate limit between users (1 second)
      if (results.indexOf(result) < results.length - 1) {
        await sleep(1000);
      }
    } catch (error) {
      logger.error(`Failed to send to ${result.username}, continuing with other users...`);
      // Continue with other users even if one fails
    }
  }

  // Clean up old cache entries and save
  cache.cleanup();
  await cache.save();

  logger.info(`✅ Telegram delivery complete for all users`);
}

/**
 * Send error notification to all enabled users
 */
export async function sendErrorNotificationToAllUsers(error: Error): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    logger.error('Cannot send error notification: TELEGRAM_BOT_TOKEN not set');
    return;
  }

  try {
    const { loadAllUsers } = await import('./multi-user-matcher.js');
    const users = await loadAllUsers();

    if (users.length === 0) {
      logger.warn('No users to notify about error');
      return;
    }

    const bot = new Telegraf(botToken);
    const errorMessage = `⚠️ *Job Hunter Error*\n\n` +
      `Failed to complete daily job hunt.\n\n` +
      `*Error:* ${error.message}\n\n` +
      `The system will retry on the next scheduled run.`;

    for (const user of users) {
      try {
        await bot.telegram.sendMessage(user.config.telegram_chat_id, errorMessage, {
          parse_mode: 'Markdown'
        });
        await sleep(500);
      } catch (sendError) {
        logger.error(`Failed to send error notification to ${user.username}:`, sendError);
      }
    }
  } catch (loadError) {
    logger.error('Error loading users for error notification:', loadError);
  }
}
