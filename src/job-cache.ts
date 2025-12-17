import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { Job, logger } from './utils.js';

interface CachedJob {
  url: string;
  title: string;
  company: string;
  firstSeen: string; // ISO date
  lastSeen: string; // ISO date
  shownToUsers: string[]; // List of usernames
}

/**
 * Job cache to prevent showing duplicate jobs across days
 *
 * Features:
 * - Tracks jobs shown to each user
 * - Filters out jobs shown within last N days
 * - Automatic cleanup of old entries (>30 days)
 * - Persists across runs in .cache/job-cache.json
 */
export class JobCache {
  private cacheDir: string;
  private cachePath: string;
  private cache: Map<string, CachedJob> = new Map();

  constructor() {
    this.cacheDir = resolve(process.cwd(), '.cache');
    this.cachePath = resolve(this.cacheDir, 'job-cache.json');
  }

  /**
   * Load cache from disk
   */
  async load(): Promise<void> {
    if (!existsSync(this.cacheDir)) {
      await mkdir(this.cacheDir, { recursive: true });
    }

    if (existsSync(this.cachePath)) {
      try {
        const data = await readFile(this.cachePath, 'utf-8');
        const cacheData = JSON.parse(data) as CachedJob[];

        for (const cached of cacheData) {
          this.cache.set(cached.url, cached);
        }

        logger.info(`📦 Loaded job cache: ${this.cache.size} jobs`);
      } catch (error) {
        logger.error('❌ Error loading job cache:', error);
      }
    } else {
      logger.info('📦 No existing cache found, starting fresh');
    }
  }

  /**
   * Save cache to disk
   */
  async save(): Promise<void> {
    try {
      const cacheData = Array.from(this.cache.values());
      await writeFile(this.cachePath, JSON.stringify(cacheData, null, 2));
      logger.info(`💾 Saved job cache: ${this.cache.size} jobs`);
    } catch (error) {
      logger.error('❌ Error saving job cache:', error);
    }
  }

  /**
   * Mark job as shown to a user
   */
  markAsShown(job: Job, username: string): void {
    const today = new Date().toISOString().split('T')[0];
    const cached = this.cache.get(job.url);

    if (cached) {
      cached.lastSeen = today;
      if (!cached.shownToUsers.includes(username)) {
        cached.shownToUsers.push(username);
      }
    } else {
      this.cache.set(job.url, {
        url: job.url,
        title: job.title,
        company: job.company,
        firstSeen: today,
        lastSeen: today,
        shownToUsers: [username]
      });
    }
  }

  /**
   * Check if job was shown to user in last N days
   */
  wasShownRecently(job: Job, username: string, withinDays: number = 3): boolean {
    const cached = this.cache.get(job.url);
    if (!cached || !cached.shownToUsers.includes(username)) {
      return false;
    }

    const daysSinceShown = this.daysSince(cached.lastSeen);
    return daysSinceShown < withinDays;
  }

  /**
   * Filter out jobs shown to user recently
   */
  filterRecentlyShown(jobs: Job[], username: string, withinDays: number = 3): Job[] {
    return jobs.filter(job => !this.wasShownRecently(job, username, withinDays));
  }

  /**
   * Get stats for recently shown jobs
   */
  getFilterStats(jobs: Job[], username: string, withinDays: number = 3): {
    total: number;
    fresh: number;
    duplicates: number;
  } {
    const fresh = this.filterRecentlyShown(jobs, username, withinDays);
    return {
      total: jobs.length,
      fresh: fresh.length,
      duplicates: jobs.length - fresh.length
    };
  }

  /**
   * Clean up old cache entries (>30 days)
   */
  cleanup(): void {
    const cutoffDays = 30;
    let removed = 0;

    for (const [url, cached] of this.cache.entries()) {
      if (this.daysSince(cached.lastSeen) > cutoffDays) {
        this.cache.delete(url);
        removed++;
      }
    }

    if (removed > 0) {
      logger.info(`🧹 Cleaned up ${removed} old job entries from cache`);
    }
  }

  /**
   * Calculate days since a date string
   * Uses Math.ceil to prevent same-day repetition (23h 59m counts as 1 day)
   */
  private daysSince(dateStr: string): number {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalJobs: number;
    uniqueUsers: Set<string>;
    oldestEntry: string | null;
    newestEntry: string | null;
  } {
    const users = new Set<string>();
    let oldest: string | null = null;
    let newest: string | null = null;

    for (const cached of this.cache.values()) {
      cached.shownToUsers.forEach(u => users.add(u));

      if (!oldest || cached.firstSeen < oldest) {
        oldest = cached.firstSeen;
      }
      if (!newest || cached.lastSeen > newest) {
        newest = cached.lastSeen;
      }
    }

    return {
      totalJobs: this.cache.size,
      uniqueUsers: users,
      oldestEntry: oldest,
      newestEntry: newest
    };
  }
}
