import { BaseScraper, PlatformConfig } from './base.js';
import { Job, sanitizeText, extractRequirements, logger } from '../utils.js';

/**
 * Bayt scraper using Cheerio for fast static HTML parsing
 */
export class BaytScraper extends BaseScraper {
  constructor(config: PlatformConfig) {
    super(config);
  }

  /**
   * Build Bayt search URL
   */
  protected buildSearchUrl(keyword: string, mode: 'quick' | 'deep'): string {
    const baseUrl = 'https://www.bayt.com/en/saudi-arabia/jobs';
    const query = encodeURIComponent(keyword);
    const location = 'riyadh'; // Bayt uses location in URL path

    // Quick mode: First page
    // Deep mode: We'll handle pagination separately
    const page = mode === 'deep' ? 1 : 1;

    return `${baseUrl}/${query}-${location}-jobs/?page=${page}`;
  }

  /**
   * Extract jobs from Bayt page
   */
  protected extractJobs($: cheerio.CheerioAPI): Job[] {
    const jobs: Job[] = [];

    try {
      // Bayt uses job listing cards
      const jobCards = $('li.has-pointer-d, div.jb-data');

      logger.debug(`Found ${jobCards.length} job cards on Bayt`);

      jobCards.each((_, element) => {
        try {
          const $card = $(element);

          // Extract job details
          const titleElement = $card.find('h2 a, a.job-title');
          const companyElement = $card.find('b.jb-name, div.company-name a');
          const locationElement = $card.find('span.jb-loc, div.location');
          const dateElement = $card.find('span.jb-date, div.date-posted');
          const snippetElement = $card.find('p.jb-desc, div.job-description');

          const title = sanitizeText(titleElement.text());
          const company = sanitizeText(companyElement.text());
          const location = sanitizeText(locationElement.text());
          const url = titleElement.attr('href') || '';
          const snippet = sanitizeText(snippetElement.text());
          const dateText = sanitizeText(dateElement.text());

          // Skip if missing critical data
          if (!title || !company || !url) {
            return; // Continue to next iteration
          }

          // Ensure full URL
          const fullUrl = url.startsWith('http') ? url : `https://www.bayt.com${url}`;

          // Check if location matches Riyadh
          if (!location.toLowerCase().includes('riyadh') && !location.toLowerCase().includes('الرياض')) {
            return;
          }

          // Extract requirements from snippet
          const requirements = snippet ? extractRequirements(snippet) : [];

          // Parse posted date
          let postedDate: Date | undefined;
          if (dateText) {
            // Bayt uses formats like "2 days ago", "1 week ago"
            const daysMatch = dateText.match(/(\d+)\s+day/i);
            const weeksMatch = dateText.match(/(\d+)\s+week/i);

            if (dateText.toLowerCase().includes('today')) {
              postedDate = new Date();
            } else if (daysMatch) {
              postedDate = new Date();
              postedDate.setDate(postedDate.getDate() - parseInt(daysMatch[1]));
            } else if (weeksMatch) {
              postedDate = new Date();
              postedDate.setDate(postedDate.getDate() - parseInt(weeksMatch[1]) * 7);
            }
          }

          jobs.push({
            id: '', // Will be set by base class
            title,
            company,
            location,
            url: fullUrl,
            description: snippet,
            requirements,
            postedDate,
            platform: this.config.name
          });
        } catch (error) {
          logger.debug('Error extracting Bayt job card:', error);
        }
      });

      logger.info(`Extracted ${jobs.length} jobs from Bayt`);
    } catch (error) {
      logger.error('Error extracting jobs from Bayt:', error);
    }

    return jobs;
  }

  /**
   * Override scan for Bayt's pagination
   */
  async deepScan(): Promise<Job[]> {
    const allJobs: Job[] = [];
    const keywords = this.config.search_params.keywords;

    for (const keyword of keywords) {
      // Scrape multiple pages (Bayt shows ~20 jobs per page)
      for (let page = 1; page <= 5; page++) {
        const query = encodeURIComponent(keyword);
        const url = `https://www.bayt.com/en/saudi-arabia/jobs/${query}-riyadh-jobs/?page=${page}`;

        if (!this.isUrlAllowed(url)) {
          continue;
        }

        const jobs = await this.rateLimiter.schedule(async () => {
          return await this.scrapeWithCheerio(url, ($) => {
            return this.extractJobs($);
          });
        });

        allJobs.push(...jobs);

        // Stop if we got no results
        if (jobs.length === 0) {
          logger.debug(`No more jobs found on Bayt page ${page}`);
          break;
        }

        // Respect rate limits (2 seconds between requests)
        await this.sleep(2000);
      }
    }

    return this.deduplicateJobs(allJobs);
  }
}
