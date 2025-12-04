import { Telegraf } from 'telegraf';
import { logger } from './utils.js';

interface SystemMetrics {
  totalJobs: number;
  jobsBySource: Record<string, number>;
  usersProcessed: number;
  jobsDelivered: number;
  errors: string[];
  runtime: number; // milliseconds
}

/**
 * System monitoring and alerting
 *
 * Features:
 * - Sends alerts for system issues to admin
 * - Daily summary reports
 * - Health checks
 * - Performance tracking
 */
export class SystemMonitor {
  private adminChatId: string;
  private bot: Telegraf;
  private metrics: SystemMetrics;

  constructor(adminChatId: string) {
    this.adminChatId = adminChatId;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN not set');
    }
    this.bot = new Telegraf(botToken);

    this.metrics = {
      totalJobs: 0,
      jobsBySource: {},
      usersProcessed: 0,
      jobsDelivered: 0,
      errors: [],
      runtime: 0
    };
  }

  /**
   * Record system metrics
   */
  recordMetrics(metrics: Partial<SystemMetrics>): void {
    this.metrics = { ...this.metrics, ...metrics };
  }

  /**
   * Send alert for system issues
   */
  async sendAlert(issue: string, severity: 'warning' | 'error' | 'critical'): Promise<void> {
    const emoji = severity === 'critical' ? '🚨' : severity === 'error' ? '❌' : '⚠️';

    const message = `${emoji} *Job Hunter Alert*\n\n` +
      `*Severity:* ${severity.toUpperCase()}\n` +
      `*Issue:* ${issue}\n` +
      `*Time:* ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })}\n\n` +
      `Check GitHub Actions logs for details.`;

    try {
      await this.bot.telegram.sendMessage(this.adminChatId, message, {
        parse_mode: 'Markdown'
      });
      logger.info(`📢 Alert sent to admin: ${issue}`);
    } catch (error) {
      logger.error('❌ Failed to send alert:', error);
    }
  }

  /**
   * Send daily summary report
   */
  async sendSummary(): Promise<void> {
    const sourcesList = Object.entries(this.metrics.jobsBySource)
      .map(([k, v]) => `${k} (${v})`)
      .join(', ') || 'No sources';

    const message = `📊 *Daily Job Hunter Summary*\n` +
      `${new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Riyadh'
      })}\n\n` +
      `✅ *Jobs Scraped:* ${this.metrics.totalJobs}\n` +
      `📦 *Sources:* ${sourcesList}\n` +
      `👥 *Users Processed:* ${this.metrics.usersProcessed}\n` +
      `📬 *Jobs Delivered:* ${this.metrics.jobsDelivered}\n` +
      `⏱️ *Runtime:* ${Math.round(this.metrics.runtime / 1000)}s\n\n` +
      (this.metrics.errors.length > 0
        ? `⚠️ *Errors:* ${this.metrics.errors.length}\n${this.metrics.errors.slice(0, 3).join('\n')}\n\n`
        : `✅ No errors! 🎉\n\n`) +
      `Next run: Tomorrow at 9:00 AM Riyadh time`;

    try {
      await this.bot.telegram.sendMessage(this.adminChatId, message, {
        parse_mode: 'Markdown'
      });
      logger.info(`📊 Summary sent to admin`);
    } catch (error) {
      logger.error('❌ Failed to send summary:', error);
    }
  }

  /**
   * Health check: Verify system is functioning correctly
   */
  async performHealthCheck(): Promise<void> {
    const issues: string[] = [];

    // Check 1: Did we scrape any jobs?
    if (this.metrics.totalJobs === 0) {
      issues.push('No jobs scraped from any source');
    }

    // Check 2: Did we process all expected users?
    const expectedUsers = 3; // Update if you add more users
    if (this.metrics.usersProcessed < expectedUsers && this.metrics.usersProcessed > 0) {
      issues.push(`Only ${this.metrics.usersProcessed}/${expectedUsers} users processed`);
    }

    // Check 3: Did we deliver any jobs?
    if (this.metrics.jobsDelivered === 0 && this.metrics.totalJobs > 0) {
      issues.push('Jobs scraped but none delivered (matching issue?)');
    }

    // Check 4: Were there errors?
    if (this.metrics.errors.length > 0) {
      issues.push(`${this.metrics.errors.length} errors occurred during run`);
    }

    // Check 5: Did the run take unusually long?
    const MAX_RUNTIME_MS = 5 * 60 * 1000; // 5 minutes
    if (this.metrics.runtime > MAX_RUNTIME_MS) {
      issues.push(`Run took ${Math.round(this.metrics.runtime / 1000)}s (unusually long)`);
    }

    // Send alerts for issues
    if (issues.length > 0) {
      for (const issue of issues) {
        await this.sendAlert(issue, 'warning');
        await this.sleep(500); // Rate limit between alerts
      }
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create monitoring instance
 * Admin chat ID defaults to Hadi's chat ID (442300061)
 */
export function createMonitor(): SystemMonitor {
  const adminChatId = process.env.ADMIN_CHAT_ID || '442300061'; // Hadi's chat ID
  return new SystemMonitor(adminChatId);
}
