import axios from 'axios';
import { Job, logger, generateJobId, sanitizeText } from '../utils.js';
import { PlatformConfig } from './base.js';

export interface AdzunaConfig extends PlatformConfig {
  api?: {
    app_id: string;
    api_key: string;
    country: string;
  };
}

/**
 * Adzuna API scraper (FREE tier: 250 requests/day)
 *
 * Official job search API with Saudi Arabia coverage
 * No bot detection issues, clean JSON responses
 */
export class AdzunaScraper {
  private config: AdzunaConfig;
  private baseUrl: string;
  private jobCache: Set<string> = new Set();
  private appId: string;
  private apiKey: string;

  constructor(config: AdzunaConfig) {
    this.config = config;

    // Get API credentials from environment or config
    this.appId = process.env.ADZUNA_APP_ID || config.api?.app_id || '';
    this.apiKey = process.env.ADZUNA_API_KEY || config.api?.api_key || '';

    const country = config.api?.country || 'sa';
    this.baseUrl = `https://api.adzuna.com/v1/api/jobs/${country}/search`;
  }

  /**
   * Initialize scraper (check API credentials)
   */
  async initialize(): Promise<void> {
    if (!this.appId || !this.apiKey) {
      logger.error('Adzuna API credentials not configured');
      throw new Error('ADZUNA_APP_ID and ADZUNA_API_KEY must be set');
    }

    logger.info(`${this.config.name} scraper initialized (API mode)`);
  }

  /**
   * Search jobs via Adzuna API
   */
  async searchJobs(keyword: string, page: number = 1): Promise<Job[]> {
    const jobs: Job[] = [];

    try {
      const params = {
        app_id: this.appId,
        app_key: this.apiKey,
        results_per_page: 20,
        what: keyword,
        where: this.config.search_params.location,
        page: page,
        sort_by: 'date',
        max_days_old: 7
      };

      logger.debug(`Adzuna API request: ${this.baseUrl}/${page}`);

      const response = await axios.get(`${this.baseUrl}/${page}`, {
        params,
        timeout: 10000
      });

      if (!response.data?.results) {
        logger.warn(`Adzuna API returned no results for "${keyword}"`);
        return jobs;
      }

      logger.info(`Adzuna: ${response.data.results.length} jobs for "${keyword}" (page ${page})`);

      for (const result of response.data.results) {
        try {
          // Extract location from various formats
          const location =
            result.location?.display_name ||
            result.location?.area?.[0] ||
            result.location?.area?.[1] ||
            'Unknown';

          // Filter for Riyadh only
          const locationLower = location.toLowerCase();
          if (!locationLower.includes('riyadh') &&
              !locationLower.includes('الرياض')) {
            continue;
          }

          // Extract company name
          const company = sanitizeText(
            result.company?.display_name ||
            result.company_name ||
            'Unknown'
          );

          // Build job object
          const job: Job = {
            id: generateJobId(),
            title: sanitizeText(result.title),
            company,
            location: sanitizeText(location),
            url: result.redirect_url,
            description: sanitizeText(result.description || '').substring(0, 500),
            requirements: [],
            postedDate: result.created ? new Date(result.created) : undefined,
            platform: this.config.name
          };

          // Deduplicate by URL
          if (!this.jobCache.has(job.url)) {
            this.jobCache.add(job.url);
            jobs.push(job);
          }
        } catch (parseError) {
          logger.debug('Error parsing Adzuna result:', parseError);
        }
      }

      logger.info(`Extracted ${jobs.length} Riyadh jobs from Adzuna (page ${page})`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          logger.error('Adzuna rate limit exceeded (250 requests/day)');
        } else if (error.response?.status === 401) {
          logger.error('Adzuna authentication failed - check API credentials');
        } else {
          logger.error(`Adzuna API error: ${error.message}`);
        }
      } else {
        logger.error('Adzuna request failed:', error);
      }
    }

    return jobs;
  }

  /**
   * Quick scan (first page only for each keyword)
   */
  async quickScan(): Promise<Job[]> {
    logger.info('Adzuna quick scan (first page only)');
    const allJobs: Job[] = [];

    for (const keyword of this.config.search_params.keywords) {
      const jobs = await this.searchJobs(keyword, 1);
      allJobs.push(...jobs);

      // Rate limiting: 1 request per second
      await this.sleep(1000);
    }

    logger.info(`Adzuna quick scan complete: ${allJobs.length} jobs`);
    return allJobs;
  }

  /**
   * Deep scan (up to 5 pages per keyword)
   */
  async deepScan(): Promise<Job[]> {
    logger.info('Adzuna deep scan (up to 5 pages per keyword)');
    const allJobs: Job[] = [];

    for (const keyword of this.config.search_params.keywords) {
      // Scan multiple pages
      for (let page = 1; page <= 5; page++) {
        const jobs = await this.searchJobs(keyword, page);
        allJobs.push(...jobs);

        // If no jobs on this page, stop pagination
        if (jobs.length === 0) {
          logger.debug(`No more jobs for "${keyword}" on page ${page}`);
          break;
        }

        // Rate limiting: 1 request per second
        await this.sleep(1000);
      }
    }

    logger.info(`Adzuna deep scan complete: ${allJobs.length} jobs`);
    return allJobs;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.jobCache.clear();
    logger.debug('Adzuna scraper cleaned up');
  }

  /**
   * Sleep utility for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
