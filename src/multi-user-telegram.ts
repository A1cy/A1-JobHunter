import { Telegraf } from 'telegraf';
import { Job, logger } from './utils.js';
import { UserMatchResult } from './multi-user-matcher.js';

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Split jobs into messages (max 4096 chars per Telegram message)
 */
function splitIntoMessages(jobs: Job[]): string[] {
  const messages: string[] = [];
  let currentMessage = '';
  const MAX_LENGTH = 4000; // Leave some buffer

  for (const job of jobs) {
    const scoreEmoji = (job.score || 0) >= 85 ? '🌟' : (job.score || 0) >= 70 ? '⭐' : '✅';

    const jobText = `\n${scoreEmoji} *${job.title}* (${job.score || 0}%)\n` +
      `🏢 ${job.company}\n` +
      `📍 ${job.location}\n` +
      `🔗 [Apply Here](${job.url})\n` +
      (job.matchReasons && job.matchReasons.length > 0
        ? `💡 ${job.matchReasons.join(' • ')}\n`
        : '');

    if (currentMessage.length + jobText.length > MAX_LENGTH) {
      messages.push(currentMessage);
      currentMessage = jobText;
    } else {
      currentMessage += jobText;
    }
  }

  if (currentMessage) {
    messages.push(currentMessage);
  }

  return messages;
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
    // Header message with user's name and personalized stats
    const headerMessage = `🎯 *Job Hunter - ${result.profile.name}*\n` +
      `${new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Riyadh'
      })}\n\n` +
      `Found *${result.matched_jobs.length} jobs* matching YOUR profile 🎉\n\n` +
      `📊 *Your Match Summary:*\n` +
      `• Total Jobs Scanned: ${result.stats.total_jobs_checked}\n` +
      `• Jobs Matched: ${result.matched_jobs.length}\n` +
      `• Average Match Score: ${result.stats.avg_score}%\n` +
      `• High Match (≥85%): ${result.stats.high_match_count} jobs\n` +
      `• Threshold: ≥${result.config.matching_threshold}%\n\n` +
      `───────────────────────`;

    await bot.telegram.sendMessage(chatId, headerMessage, {
      parse_mode: 'Markdown'
    });

    // Small delay after header
    await sleep(500);

    // Send job listings
    if (result.matched_jobs.length > 0) {
      const jobMessages = splitIntoMessages(result.matched_jobs);

      for (let i = 0; i < jobMessages.length; i++) {
        await bot.telegram.sendMessage(chatId, jobMessages[i], {
          parse_mode: 'Markdown'
        });

        // Rate limit between messages
        if (i < jobMessages.length - 1) {
          await sleep(1000);
        }
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
      await sendPersonalizedJobs(result, bot);

      // Rate limit between users (1 second)
      if (results.indexOf(result) < results.length - 1) {
        await sleep(1000);
      }
    } catch (error) {
      logger.error(`Failed to send to ${result.username}, continuing with other users...`);
      // Continue with other users even if one fails
    }
  }

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
