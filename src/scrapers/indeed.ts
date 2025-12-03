import { BaseScraper, PlatformConfig } from './base.js';
import { Job, sanitizeText, extractRequirements, logger } from '../utils.js';

/**
 * Indeed Saudi scraper using Cheerio for fast static HTML parsing
 */
export class IndeedScraper extends BaseScraper {
  constructor(config: PlatformConfig) {
    super(config);
  }

  /**
   * Build Indeed Saudi search URL
   */
  protected buildSearchUrl(keyword: string, mode: 'quick' | 'deep'): string {
    const baseUrl = 'https://sa.indeed.com/jobs';
    const query = encodeURIComponent(keyword);
    const location = encodeURIComponent(this.config.search_params.location);

    // Quick mode: First page (start=0)
    // Deep mode: Multiple pages (we'll handle pagination separately)
    const start = mode === 'deep' ? 0 : 0;

    return `${baseUrl}?q=${query}&l=${location}&start=${start}&fromage=7`; // Last 7 days
  }

  /**
   * Extract jobs from Indeed page
   */
  protected extractJobs($: cheerio.CheerioAPI): Job[] {
    const jobs: Job[] = [];

    try {
      // Indeed uses different selectors for job cards
      const jobCards = $('div.job_seen_beacon, div.cardOutline');

      logger.debug(`Found ${jobCards.length} job cards on Indeed`);

      jobCards.each((_, element) => {
        try {
          const $card = $(element);

          // Extract job details
          const titleElement = $card.find('h2.jobTitle a, h2.jobTitle span[title]');
          const companyElement = $card.find('span.companyName, span[data-testid="company-name"]');
          const locationElement = $card.find('div.companyLocation, div[data-testid="text-location"]');
          const linkElement = $card.find('h2.jobTitle a');
          const snippetElement = $card.find('div.job-snippet, div[data-testid="job-snippet"]');
          const dateElement = $card.find('span.date, span[data-testid="myJobsStateDate"]');

          const title = sanitizeText(titleElement.text() || titleElement.attr('title') || '');
          const company = sanitizeText(companyElement.text());
          const location = sanitizeText(locationElement.text());
          const relativeLink = linkElement.attr('href');
          const url = relativeLink ? `https://sa.indeed.com${relativeLink}` : '';
          const snippet = sanitizeText(snippetElement.text());
          const dateText = sanitizeText(dateElement.text());

          // Skip if missing critical data
          if (!title || !company || !url) {
            return; // Continue to next iteration
          }

          // Check if location matches Riyadh
          if (!location.toLowerCase().includes('riyadh') && !location.toLowerCase().includes('الرياض')) {
            return;
          }

          // Extract requirements from snippet
          const requirements = snippet ? extractRequirements(snippet) : [];

          // Parse posted date (e.g., "2 days ago", "Today", "Just posted")
          let postedDate: Date | undefined;
          if (dateText.includes('today') || dateText.includes('just posted')) {
            postedDate = new Date();
          } else {
            const daysMatch = dateText.match(/(\d+)\s+day/i);
            if (daysMatch) {
              postedDate = new Date();
              postedDate.setDate(postedDate.getDate() - parseInt(daysMatch[1]));
            }
          }

          jobs.push({
            id: '', // Will be set by base class
            title,
            company,
            location,
            url,
            description: snippet,
            requirements,
            postedDate,
            platform: this.config.name
          });
        } catch (error) {
          logger.debug('Error extracting Indeed job card:', error);
        }
      });

      logger.info(`Extracted ${jobs.length} jobs from Indeed`);
    } catch (error) {
      logger.error('Error extracting jobs from Indeed:', error);
    }

    return jobs;
  }

  /**
   * Override scan for Indeed's pagination
   */
  async deepScan(): Promise<Job[]> {
    const allJobs: Job[] = [];
    const keywords = this.config.search_params.keywords;

    for (const keyword of keywords) {
      // Scrape multiple pages (Indeed shows 10-15 jobs per page)
      for (let page = 0; page < 7; page++) {
        const start = page * 10;
        const url = `https://sa.indeed.com/jobs?q=${encodeURIComponent(keyword)}&l=${encodeURIComponent(this.config.search_params.location)}&start=${start}&fromage=7`;

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
          logger.debug(`No more jobs found on Indeed page ${page + 1}`);
          break;
        }

        // Respect rate limits (2 seconds between requests)
        await this.sleep(2000);
      }
    }

    return this.deduplicateJobs(allJobs);
  }
}
