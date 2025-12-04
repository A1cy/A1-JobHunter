import got from 'got';
import { Job, generateJobId, logger } from '../utils.js';

interface JSearchJob {
  job_id: string;
  job_title: string;
  employer_name: string;
  job_city?: string;
  job_country?: string;
  job_apply_link?: string;
  job_description?: string;
  job_posted_at_datetime_utc?: string;
}

interface JSearchResponse {
  status: string;
  data: JSearchJob[];
}

/**
 * JSearch Job Scraper - SECONDARY SOURCE (Tier 2)
 *
 * OpenWebNinja JSearch API - Google Jobs aggregator
 * Free tier: Generous free tier (exact limit TBD)
 * Our usage: 0-1 calls/day (only when Jooble returns <10 jobs)
 */
export class JSearchJobScraper {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENWEBNINJA_API_KEY || '';

    if (!this.apiKey) {
      logger.warn('⚠️  OPENWEBNINJA_API_KEY not found in environment variables');
    }
  }

  /**
   * Search jobs on JSearch API (Google Jobs)
   *
   * @param query - Job query (e.g., "Software Engineer OR AI Engineer")
   * @param location - Location (e.g., "Riyadh, Saudi Arabia")
   * @returns Array of Job objects
   */
  async searchJobs(query: string, location: string): Promise<Job[]> {
    if (!this.apiKey) {
      logger.error('❌ Cannot search JSearch: API key not configured');
      return [];
    }

    try {
      const url = 'https://api.openwebninja.com/jsearch/search';

      logger.debug(`JSearch API request: ${query}, ${location}`);

      const response = await got(url, {
        searchParams: {
          query: `${query} in ${location}`,
          num_pages: 1,
          page: 1,
          date_posted: 'week' // Only jobs from last week
        },
        headers: {
          'x-api-key': this.apiKey
        },
        responseType: 'json',
        timeout: { request: 10000 }
      });

      const data = response.body as JSearchResponse;

      logger.info(`✅ JSearch: "${query}" → ${data.data?.length || 0} jobs`);

      return (data.data || []).map(job => ({
        id: generateJobId(),
        title: job.job_title,
        company: job.employer_name,
        location: `${job.job_city || ''}, ${job.job_country || ''}`.trim().replace(/^,\s*/, ''),
        url: job.job_apply_link || '',
        description: job.job_description || '',
        postedDate: job.job_posted_at_datetime_utc
          ? new Date(job.job_posted_at_datetime_utc)
          : undefined,
        platform: 'JSearch',
        source: 'API'
      }));
    } catch (error) {
      logger.error(`❌ JSearch error for "${query}":`, error);
      return [];
    }
  }
}
