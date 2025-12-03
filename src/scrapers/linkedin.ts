import { Page } from 'playwright';
import { BaseScraper, PlatformConfig } from './base.js';
import { Job, sanitizeText, extractRequirements, logger } from '../utils.js';

/**
 * LinkedIn Jobs scraper using Playwright with stealth mode
 */
export class LinkedInScraper extends BaseScraper {
  constructor(config: PlatformConfig) {
    super(config);
  }

  /**
   * Build LinkedIn search URL
   */
  protected buildSearchUrl(keyword: string, mode: 'quick' | 'deep'): string {
    const baseUrl = 'https://www.linkedin.com/jobs/search';
    const location = encodeURIComponent(this.config.search_params.location);
    const keywords = encodeURIComponent(keyword);

    // Quick mode: First page only
    // Deep mode: Multiple pages
    const start = mode === 'deep' ? 0 : 0;

    return `${baseUrl}?keywords=${keywords}&location=${location}&start=${start}&f_TPR=r604800`; // Last 7 days
  }

  /**
   * Extract jobs from LinkedIn page
   */
  protected async extractJobs(page: Page): Promise<Job[]> {
    const jobs: Job[] = [];

    try {
      // Wait for job listings to load
      await page.waitForSelector('ul.jobs-search__results-list', { timeout: 10000 }).catch(() => {
        logger.warn('LinkedIn job list not found, page may have changed');
      });

      // Extract job cards
      const jobCards = await page.$$('li.jobs-search-results__list-item');

      logger.debug(`Found ${jobCards.length} job cards on LinkedIn`);

      for (const card of jobCards) {
        try {
          // Extract job details
          const titleElement = await card.$('h3.base-search-card__title');
          const companyElement = await card.$('h4.base-search-card__subtitle');
          const locationElement = await card.$('span.job-search-card__location');
          const linkElement = await card.$('a.base-card__full-link');
          const dateElement = await card.$('time');

          const title = titleElement ? sanitizeText(await titleElement.textContent() || '') : '';
          const company = companyElement ? sanitizeText(await companyElement.textContent() || '') : '';
          const location = locationElement ? sanitizeText(await locationElement.textContent() || '') : '';
          const url = linkElement ? (await linkElement.getAttribute('href'))?.split('?')[0] || '' : '';
          const dateStr = dateElement ? await dateElement.getAttribute('datetime') : null;

          // Skip if missing critical data
          if (!title || !company || !url) {
            continue;
          }

          // Check if location matches Riyadh
          if (!location.toLowerCase().includes('riyadh')) {
            continue;
          }

          // Try to get job description by clicking the card
          let description = '';
          let requirements: string[] = [];

          try {
            await card.click();
            await page.waitForTimeout(1000);

            const descElement = await page.$('div.show-more-less-html__markup');
            if (descElement) {
              description = sanitizeText(await descElement.textContent() || '');
              requirements = extractRequirements(description);
            }
          } catch (error) {
            logger.debug('Could not extract description for job:', title);
          }

          jobs.push({
            id: '', // Will be set by base class
            title,
            company,
            location,
            url,
            description,
            requirements,
            postedDate: dateStr ? new Date(dateStr) : undefined,
            platform: this.config.name
          });

          // Limit jobs in quick mode
          if (jobs.length >= 30) {
            break;
          }
        } catch (error) {
          logger.debug('Error extracting job card:', error);
          continue;
        }
      }

      logger.info(`Extracted ${jobs.length} jobs from LinkedIn`);
    } catch (error) {
      logger.error('Error extracting jobs from LinkedIn:', error);
    }

    return jobs;
  }

  /**
   * Override scan to handle LinkedIn's pagination
   */
  async deepScan(): Promise<Job[]> {
    const allJobs: Job[] = [];
    const keywords = this.config.search_params.keywords;

    for (const keyword of keywords) {
      // Scrape multiple pages for deep scan
      for (let page = 0; page < 4; page++) {
        const url = `https://www.linkedin.com/jobs/search?keywords=${encodeURIComponent(keyword)}&location=${encodeURIComponent(this.config.search_params.location)}&start=${page * 25}&f_TPR=r604800`;

        if (!this.isUrlAllowed(url)) {
          continue;
        }

        const jobs = await this.rateLimiter.schedule(async () => {
          return await this.scrapeWithBrowser(url, async (page) => {
            return await this.extractJobs(page);
          });
        });

        allJobs.push(...jobs);

        // Stop if we got no results
        if (jobs.length === 0) {
          break;
        }

        // Respect rate limits
        await this.sleep(3000);
      }
    }

    return this.deduplicateJobs(allJobs);
  }
}
