import got from 'got';
import { Job, generateJobId, logger } from '../utils.js';

/**
 * ✅ RUN #36: Arbeitnow API Scraper
 *
 * Arbeitnow.com - Remote Tech Jobs API
 * - Limit: UNLIMITED (open API, no key needed)
 * - Coverage: Remote tech jobs (Germany-based but worldwide)
 * - Quality: High (tech-focused, curated)
 * - Filter: Client-side keyword matching (API doesn't support search)
 *
 * Expected: +10-20 remote tech jobs/day
 * Cost: $0/month
 *
 * API Docs: https://arbeitnow.com/api/job-board-api
 */

export class ArbeitnowJobScraper {
  private baseUrl = 'https://arbeitnow.com/api/job-board-api';

  /**
   * Search remote tech jobs by keyword
   *
   * Note: API doesn't support search params, so we fetch all
   * recent jobs and filter client-side
   *
   * @param keywords - Search keywords (e.g., "software engineer", "data scientist")
   * @returns Array of matching remote tech jobs
   */
  async searchJobs(keywords: string): Promise<Job[]> {
    try {
      logger.debug(`🔍 Arbeitnow API: Searching for "${keywords}"...`);

      const response = await got(this.baseUrl, {
        responseType: 'json',
        timeout: { request: 10000 },
        headers: {
          'User-Agent': 'A1xAI-JobHunter/1.0'
        }
      });

      const data: any = response.body;
      const jobs = data.data || [];

      // Client-side keyword filtering
      const keywordLower = keywords.toLowerCase();
      const keywordParts = keywordLower.split(/\s+/);

      const filtered = jobs.filter((job: any) => {
        const titleLower = (job.title || '').toLowerCase();
        const descLower = (job.description || '').toLowerCase();
        const tagsLower = (job.tags || []).join(' ').toLowerCase();

        const combinedText = `${titleLower} ${descLower} ${tagsLower}`;

        // Match if ANY keyword part is found
        return keywordParts.some(part => combinedText.includes(part));
      });

      logger.info(`✅ Arbeitnow API: "${keywords}" → ${filtered.length} remote tech jobs (${jobs.length} total)`);

      return filtered.slice(0, 50).map((job: any) => ({
        id: generateJobId(),
        title: job.title,
        company: job.company_name || 'Unknown',
        location: job.location || 'Remote',
        url: job.url,
        description: job.description || '',
        postedDate: job.created_at ? new Date(job.created_at * 1000) : undefined, // Unix timestamp
        platform: 'Arbeitnow',
        source: 'API'
      }));
    } catch (error) {
      logger.error(`❌ Arbeitnow API error:`, error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Get latest remote tech jobs (no keyword filter)
   *
   * @returns Array of latest remote tech jobs
   */
  async getLatestJobs(): Promise<Job[]> {
    try {
      logger.debug(`🔍 Arbeitnow API: Fetching latest remote tech jobs...`);

      const response = await got(this.baseUrl, {
        responseType: 'json',
        timeout: { request: 10000 },
        headers: {
          'User-Agent': 'A1xAI-JobHunter/1.0'
        }
      });

      const data: any = response.body;
      const jobs = data.data || [];

      logger.info(`✅ Arbeitnow API: Latest jobs → ${jobs.length} remote tech jobs`);

      return jobs.slice(0, 50).map((job: any) => ({
        id: generateJobId(),
        title: job.title,
        company: job.company_name || 'Unknown',
        location: job.location || 'Remote',
        url: job.url,
        description: job.description || '',
        postedDate: job.created_at ? new Date(job.created_at * 1000) : undefined,
        platform: 'Arbeitnow',
        source: 'API'
      }));
    } catch (error) {
      logger.error(`❌ Arbeitnow API error (latest):`, error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Search multiple keywords sequentially
   *
   * @param keywords - Array of search keywords
   * @returns Combined array of unique jobs
   */
  async searchMultipleKeywords(keywords: string[]): Promise<Job[]> {
    logger.info(`🔍 Arbeitnow API: Searching ${keywords.length} keywords...`);

    const allJobs: Job[] = [];
    const seen = new Set<string>(); // Deduplicate by URL

    for (const keyword of keywords) {
      const jobs = await this.searchJobs(keyword);

      // Deduplicate
      for (const job of jobs) {
        if (!seen.has(job.url)) {
          allJobs.push(job);
          seen.add(job.url);
        }
      }

      // Rate limit: 1 req/second
      if (keywords.indexOf(keyword) < keywords.length - 1) {
        await this.sleep(1000);
      }
    }

    logger.info(`📊 Arbeitnow API total: ${allJobs.length} unique remote tech jobs across ${keywords.length} keywords`);
    return allJobs;
  }

  /**
   * Sleep utility for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
