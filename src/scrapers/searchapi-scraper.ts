import got from 'got';
import { Job, generateJobId, logger } from '../utils.js';

/**
 * SearchAPI Job Scraper - EMERGENCY BACKUP (Tier 4)
 *
 * SearchAPI.io Google Jobs API
 * Free tier: 100 searches/month
 * Our usage: 0 calls most days (only when Tiers 1-3 all fail)
 */
export class SearchAPIJobScraper {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.SEARCHAPI_KEY || '';

    if (!this.apiKey) {
      logger.warn('⚠️  SEARCHAPI_KEY not found in environment variables');
    }
  }

  /**
   * Search jobs on SearchAPI.io (Google Jobs)
   *
   * @param query - Job query (e.g., "software developer OR engineer")
   * @param location - Location (e.g., "Riyadh Saudi Arabia")
   * @returns Array of Job objects
   */
  async searchJobs(query: string, location: string): Promise<Job[]> {
    if (!this.apiKey) {
      logger.error('❌ Cannot search SearchAPI: API key not configured');
      return [];
    }

    try {
      const url = 'https://www.searchapi.io/api/v1/search';

      logger.debug(`SearchAPI request: ${query}, ${location}`);

      const response = await got(url, {
        searchParams: {
          engine: 'google_jobs',
          q: `${query} in ${location}`,
          api_key: this.apiKey
        },
        responseType: 'json',
        timeout: { request: 10000 }
      });

      const data = response.body as any;
      const jobs = data.jobs_results || [];

      logger.info(`✅ SearchAPI: "${query}" → ${jobs.length} jobs`);

      return jobs.map((job: any) => ({
        id: generateJobId(),
        title: job.title || 'No Title',
        company: job.company_name || 'Unknown Company',
        location: job.location || location,
        url: job.apply_link || job.share_link || '',
        description: job.description || '',
        platform: 'SearchAPI',
        source: 'API'
      }));
    } catch (error) {
      logger.error(`❌ SearchAPI error for "${query}":`, error);
      return [];
    }
  }
}
