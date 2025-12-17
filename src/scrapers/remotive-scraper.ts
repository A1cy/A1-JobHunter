import got from 'got';
import { Job, generateJobId, logger } from '../utils.js';

/**
 * ✅ RUN #36: Remotive API Scraper
 *
 * Remotive.com - Remote Jobs API
 * - Limit: UNLIMITED (no API key needed!)
 * - Coverage: Remote jobs (IT, Product, Marketing, Design)
 * - Quality: High (curated listings)
 * - Saudi-friendly: Filter for "Worldwide" or "Middle East" allowed locations
 *
 * Expected: +20-30 remote jobs/day
 * Cost: $0/month
 *
 * API Docs: https://remotive.com/api/remote-jobs
 */

export class RemotiveJobScraper {
  private baseUrl = 'https://remotive.com/api/remote-jobs';

  /**
   * Search remote jobs by keyword
   *
   * @param keywords - Search keywords (e.g., "software engineer", "product manager")
   * @returns Array of remote jobs
   */
  async searchJobs(keywords: string): Promise<Job[]> {
    try {
      logger.debug(`🔍 Remotive API: Searching for "${keywords}"...`);

      const response = await got(this.baseUrl, {
        searchParams: {
          search: keywords,
          limit: 100 // Max results per query
        },
        responseType: 'json',
        timeout: { request: 10000 },
        headers: {
          'User-Agent': 'A1xAI-JobHunter/1.0'
        }
      });

      const data: any = response.body;
      const jobs = data.jobs || [];

      // Filter for Saudi-friendly remote jobs
      const filtered = jobs.filter((job: any) => {
        const location = job.candidate_required_location || '';

        // Allow: empty (worldwide), "Worldwide", or "Middle East"
        return (
          location === '' ||
          location.toLowerCase().includes('worldwide') ||
          location.toLowerCase().includes('world wide') ||
          location.toLowerCase().includes('middle east') ||
          location.toLowerCase().includes('global') ||
          location.toLowerCase().includes('anywhere')
        );
      });

      logger.info(`✅ Remotive API: "${keywords}" → ${filtered.length} remote jobs (${jobs.length} total, ${filtered.length} Saudi-friendly)`);

      return filtered.map((job: any) => {
        // Parse salary if available
        let salary: any = undefined;
        if (job.salary) {
          salary = { raw: job.salary };
        }

        return {
          id: generateJobId(),
          title: job.title,
          company: job.company_name,
          location: 'Remote (Riyadh-friendly)',
          url: job.url,
          description: job.description || job.description_plain || '',
          salary,
          postedDate: job.publication_date ? new Date(job.publication_date) : undefined,
          platform: 'Remotive',
          source: 'API'
        };
      });
    } catch (error) {
      logger.error(`❌ Remotive API error:`, error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Search multiple keywords in parallel
   *
   * @param keywords - Array of search keywords
   * @returns Combined array of unique remote jobs
   */
  async searchMultipleKeywords(keywords: string[]): Promise<Job[]> {
    logger.info(`🔍 Remotive API: Searching ${keywords.length} keywords...`);

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

      // Rate limit: 1 req/second (be respectful)
      if (keywords.indexOf(keyword) < keywords.length - 1) {
        await this.sleep(1000);
      }
    }

    logger.info(`📊 Remotive API total: ${allJobs.length} unique remote jobs across ${keywords.length} keywords`);
    return allJobs;
  }

  /**
   * Get latest remote jobs (no keyword filter)
   *
   * @returns Array of latest remote jobs
   */
  async getLatestJobs(): Promise<Job[]> {
    try {
      logger.debug(`🔍 Remotive API: Fetching latest remote jobs...`);

      const response = await got(this.baseUrl, {
        searchParams: {
          limit: 50 // Get top 50 latest
        },
        responseType: 'json',
        timeout: { request: 10000 },
        headers: {
          'User-Agent': 'A1xAI-JobHunter/1.0'
        }
      });

      const data: any = response.body;
      const jobs = data.jobs || [];

      // Filter for Saudi-friendly remote jobs
      const filtered = jobs.filter((job: any) => {
        const location = job.candidate_required_location || '';
        return (
          location === '' ||
          location.toLowerCase().includes('worldwide') ||
          location.toLowerCase().includes('middle east')
        );
      });

      logger.info(`✅ Remotive API: Latest jobs → ${filtered.length} Saudi-friendly remote jobs`);

      return filtered.map((job: any) => ({
        id: generateJobId(),
        title: job.title,
        company: job.company_name,
        location: 'Remote (Riyadh-friendly)',
        url: job.url,
        description: job.description || job.description_plain || '',
        salary: job.salary ? { raw: job.salary } : undefined,
        postedDate: job.publication_date ? new Date(job.publication_date) : undefined,
        platform: 'Remotive',
        source: 'API'
      }));
    } catch (error) {
      logger.error(`❌ Remotive API error (latest):`, error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Sleep utility for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
