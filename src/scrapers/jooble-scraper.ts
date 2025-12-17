import got from 'got';
import pRetry from 'p-retry';
import { Job, generateJobId, logger } from '../utils.js';

interface JoobleJob {
  title: string;
  company: string;
  location: string;
  link: string;
  snippet?: string;
  updated?: string;
}

interface JoobleResponse {
  totalCount: number;
  jobs: JoobleJob[];
}

/**
 * Jooble Job Scraper - PRIMARY SOURCE (Tier 1)
 *
 * Official REST API from Jooble aggregating 1000+ job boards
 * Free tier: ~500 requests (2,745/month)
 * Our usage: 6 calls/day = 182/month (6.6% of limit)
 */
export class JoobleJobScraper {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.JOOBLE_API_KEY || '';

    if (!this.apiKey) {
      logger.warn('⚠️  JOOBLE_API_KEY not found in environment variables');
    }
  }

  /**
   * Validate if location is in Riyadh (HARD REJECT non-Riyadh jobs)
   */
  private isRiyadhLocation(location: string): boolean {
    const locationLower = location.toLowerCase();

    // Accept Riyadh only
    if (locationLower.includes('riyadh')) {
      return true;
    }

    // REJECT all others
    logger.debug(`❌ [Jooble] Rejected non-Riyadh: ${location}`);
    return false;
  }

  /**
   * Search jobs on Jooble API
   *
   * @param keywords - Job keywords to search (e.g., "AI Engineer")
   * @param location - Location (e.g., "Riyadh")
   * @param page - Page number (default: 1)
   * @returns Array of Job objects
   */
  async searchJobs(keywords: string, location: string, page = 1): Promise<Job[]> {
    if (!this.apiKey) {
      logger.error('❌ Cannot search Jooble: API key not configured');
      return [];
    }

    // Wrap API call with retry logic
    return await pRetry(
      async () => {
        try {
          const url = `https://jooble.org/api/${this.apiKey}`;
          const body = { keywords, location, page };

          logger.debug(`Jooble API request: ${keywords}, ${location}, page ${page}`);

          const response = await got.post(url, {
            json: body,
            responseType: 'json',
            timeout: { request: 10000 }
          });

          const data = response.body as JoobleResponse;

          logger.info(`✅ Jooble: "${keywords}" → ${data.jobs?.length || 0} jobs`);

          return (data.jobs || [])
            .filter(job => this.isRiyadhLocation(job.location))
            .map(job => ({
              id: generateJobId(),
              title: job.title,
              company: job.company,
              location: job.location,
              url: job.link,
              description: job.snippet || '',
              postedDate: job.updated ? new Date(job.updated) : undefined,
              platform: 'Jooble',
              source: 'API'
            }));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.warn(`⚠️  Jooble API error (will retry): ${message}`);
          throw error; // pRetry will catch and retry
        }
      },
      {
        retries: 3, // 3 retries = 4 total attempts
        factor: 2, // Exponential backoff: 1s, 2s, 4s
        minTimeout: 1000, // Start with 1 second
        maxTimeout: 10000, // Max 10 seconds between retries
        onFailedAttempt: (error) => {
          logger.warn(
            `⚠️  Jooble retry ${error.attemptNumber}/${error.retriesLeft + error.attemptNumber} ` +
            `failed: ${error.message}`
          );
        }
      }
    ).catch(error => {
      logger.error(`❌ Jooble failed after all retries for "${keywords}":`, error);
      return []; // Return empty array on final failure
    });
  }

  /**
   * Search multiple keywords sequentially with rate limiting
   *
   * @param keywords - Array of keywords to search
   * @param location - Location (e.g., "Riyadh")
   * @returns Combined array of Job objects
   */
  async searchMultipleKeywords(keywords: string[], location: string): Promise<Job[]> {
    const allJobs: Job[] = [];

    logger.info(`🔍 Jooble: Searching ${keywords.length} keywords...`);

    for (const keyword of keywords) {
      const jobs = await this.searchJobs(keyword, location);
      allJobs.push(...jobs);

      // Rate limiting: 1 request/second (respectful API usage)
      if (keywords.indexOf(keyword) < keywords.length - 1) {
        await this.sleep(1000);
      }
    }

    logger.info(`📊 Jooble total: ${allJobs.length} jobs across ${keywords.length} keywords`);
    return allJobs;
  }

  /**
   * Sleep utility for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
