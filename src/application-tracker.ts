import { writeFile, readFile, mkdir } from 'fs/promises';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { logger } from './utils.js';

/**
 * User action on a job (applied or passed)
 */
interface JobAction {
  userId: string;
  jobId: string;
  action: 'applied' | 'passed';
  timestamp: Date;
}

/**
 * Application Tracker - Track user actions on jobs
 *
 * Stores user actions (applied/passed) in .cache/applications.json
 * for future analytics and matching improvements.
 */
export class ApplicationTracker {
  private actions: JobAction[] = [];
  private cachePath: string;

  constructor() {
    this.cachePath = resolve(process.cwd(), '.cache/applications.json');
  }

  /**
   * Load application history from disk
   */
  async load(): Promise<void> {
    try {
      const cacheDir = resolve(process.cwd(), '.cache');
      if (!existsSync(cacheDir)) {
        await mkdir(cacheDir, { recursive: true });
      }

      if (existsSync(this.cachePath)) {
        const data = await readFile(this.cachePath, 'utf-8');
        const parsed = JSON.parse(data);

        this.actions = parsed.actions.map((a: any) => ({
          ...a,
          timestamp: new Date(a.timestamp)
        }));

        logger.debug(`📂 Loaded ${this.actions.length} application actions`);
      }
    } catch (error) {
      logger.error('Error loading application tracker:', error);
      this.actions = [];
    }
  }

  /**
   * Save application history to disk
   */
  async save(): Promise<void> {
    try {
      const cacheDir = resolve(process.cwd(), '.cache');
      if (!existsSync(cacheDir)) {
        await mkdir(cacheDir, { recursive: true });
      }

      const data = {
        actions: this.actions,
        lastUpdated: new Date().toISOString()
      };

      await writeFile(this.cachePath, JSON.stringify(data, null, 2));
      logger.debug(`💾 Saved ${this.actions.length} application actions`);
    } catch (error) {
      logger.error('Error saving application tracker:', error);
    }
  }

  /**
   * Track a user action (applied or passed)
   */
  async trackAction(userId: string, jobId: string, action: 'applied' | 'passed'): Promise<void> {
    // Load existing actions first
    await this.load();

    // Check if action already exists (prevent duplicates)
    const existing = this.actions.find(
      a => a.userId === userId && a.jobId === jobId
    );

    if (existing) {
      // Update existing action
      existing.action = action;
      existing.timestamp = new Date();
    } else {
      // Add new action
      this.actions.push({
        userId,
        jobId,
        action,
        timestamp: new Date()
      });
    }

    // Save to disk
    await this.save();
  }

  /**
   * Get user's application history
   */
  getUserActions(userId: string): JobAction[] {
    return this.actions.filter(a => a.userId === userId);
  }

  /**
   * Get statistics for a user
   */
  getUserStats(userId: string): { applied: number; passed: number; total: number } {
    const userActions = this.getUserActions(userId);

    return {
      applied: userActions.filter(a => a.action === 'applied').length,
      passed: userActions.filter(a => a.action === 'passed').length,
      total: userActions.length
    };
  }

  /**
   * Clean up old actions (older than 90 days)
   */
  cleanup(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    const before = this.actions.length;
    this.actions = this.actions.filter(a => a.timestamp >= cutoffDate);
    const removed = before - this.actions.length;

    if (removed > 0) {
      logger.info(`🧹 Cleaned up ${removed} old application actions (>90 days)`);
    }
  }
}
