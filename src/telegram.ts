import { Telegraf } from 'telegraf';
import { Job, logger, formatRelativeDate } from './utils.js';

/**
 * Format a single job for Telegram with rich formatting
 */
function formatJobMessage(job: Job, _index: number): string {
  const score = job.score || 0;
  const emoji = score >= 85 ? '🌟' : score >= 70 ? '✅' : '👍';

  let message = `\n━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `${emoji} *${job.title}*\n`;
  message += `🏢 ${job.company}\n`;
  message += `📍 ${job.location}\n`;
  message += `📊 Match: ${score}%\n`;

  // Add platform and date
  if (job.platform) {
    message += `🔗 Platform: ${job.platform}\n`;
  }

  if (job.postedDate) {
    message += `📅 Posted: ${formatRelativeDate(job.postedDate)}\n`;
  }

  // Add match reasons
  if (job.matchReasons && job.matchReasons.length > 0) {
    message += `\n*Why it matches:*\n`;
    job.matchReasons.slice(0, 5).forEach(reason => {
      message += `• ${reason}\n`;
    });
  }

  // Add apply link
  if (job.url) {
    message += `\n🔗 [Apply Now](${job.url})\n`;
  }

  return message;
}

/**
 * Split jobs into multiple messages (Telegram has 4096 char limit)
 */
function splitIntoMessages(jobs: Job[], maxCharsPerMessage: number = 4000): string[] {
  const messages: string[] = [];
  let currentMessage = '';

  for (let i = 0; i < jobs.length; i++) {
    const jobMessage = formatJobMessage(jobs[i], i + 1);

    // If adding this job exceeds limit, start a new message
    if (currentMessage.length + jobMessage.length > maxCharsPerMessage) {
      if (currentMessage) {
        messages.push(currentMessage);
      }
      currentMessage = jobMessage;
    } else {
      currentMessage += jobMessage;
    }
  }

  // Add the last message
  if (currentMessage) {
    messages.push(currentMessage);
  }

  return messages;
}

/**
 * Send jobs to Telegram
 */
export async function sendToTelegram(jobs: Job[]): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    logger.error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set');
    logger.info('Skipping Telegram notification');
    return;
  }

  if (jobs.length === 0) {
    logger.warn('No jobs to send to Telegram');
    return;
  }

  try {
    const bot = new Telegraf(botToken);

    // Header message
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const avgScore = Math.round(
      jobs.reduce((sum, job) => sum + (job.score || 0), 0) / jobs.length
    );

    const highMatchCount = jobs.filter(job => (job.score || 0) >= 85).length;

    let headerMessage = `🎯 *A1 Job Hunter - ${date}*\n`;
    headerMessage += `Found ${jobs.length} jobs matching your profile\n`;
    headerMessage += `\n📊 *Summary:*\n`;
    headerMessage += `• Total Jobs: ${jobs.length}\n`;
    headerMessage += `• Avg Match: ${avgScore}%\n`;
    headerMessage += `• High Match (≥85%): ${highMatchCount} jobs\n`;

    await bot.telegram.sendMessage(chatId, headerMessage, { parse_mode: 'Markdown' });

    // Split jobs into multiple messages if needed
    const jobMessages = splitIntoMessages(jobs);

    logger.info(`Sending ${jobMessages.length} message(s) with ${jobs.length} jobs to Telegram`);

    // Send each message
    for (let i = 0; i < jobMessages.length; i++) {
      try {
        await bot.telegram.sendMessage(chatId, jobMessages[i], { parse_mode: 'Markdown' });

        // Rate limit: Wait 1 second between messages
        if (i < jobMessages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        logger.error(`Error sending message ${i + 1}:`, error);
      }
    }

    // Footer message
    const platforms = [...new Set(jobs.map(job => job.platform))].join(', ');
    let footerMessage = `\n━━━━━━━━━━━━━━━━━━━━\n`;
    footerMessage += `\n📊 *Scan Details:*\n`;
    footerMessage += `• Platforms: ${platforms}\n`;
    footerMessage += `• Scan Type: ${process.env.MODE || 'Adaptive'}\n`;
    footerMessage += `\n🤖 *Powered by A1 Job Hunter*\n`;
    footerMessage += `✨ Automated daily at 9:00 AM Riyadh time`;

    await bot.telegram.sendMessage(chatId, footerMessage, { parse_mode: 'Markdown' });

    logger.info(`Successfully sent ${jobs.length} jobs to Telegram`);
  } catch (error) {
    logger.error('Error sending to Telegram:', error);
    throw error;
  }
}

/**
 * Send error notification to Telegram
 */
export async function sendErrorNotification(error: Error): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return;
  }

  try {
    const bot = new Telegraf(botToken);

    const message = `⚠️ *A1 Job Hunter Error*\n\n` +
      `An error occurred during job hunting:\n\n` +
      `\`\`\`\n${error.message}\n\`\`\`\n\n` +
      `Please check the logs for more details.`;

    await bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (sendError) {
    logger.error('Error sending error notification:', sendError);
  }
}

/**
 * Send test message to verify Telegram setup
 */
export async function sendTestMessage(): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set');
  }

  const bot = new Telegraf(botToken);

  const message = `✅ *A1 Job Hunter Test*\n\n` +
    `Telegram integration is working correctly!\n` +
    `Bot will send daily job updates at 9:00 AM Riyadh time.`;

  await bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });

  logger.info('Test message sent successfully');
}
