import got from 'got';
import * as cheerio from 'cheerio';
import { Job, logger, generateJobId, sanitizeText } from '../utils.js';

/**
 * RSS Job Scraper - Bot-friendly Tier 1 method
 *
 * Scrapes job listings from RSS feeds provided by job platforms.
 * RSS feeds are designed for automated access, so no bot detection issues.
 */
export class RSSJobScraper {
  /**
   * Scrape jobs from RSS feed
   *
   * @param keyword - Job keyword to search for
   * @param location - Location (e.g., "Riyadh")
   * @param platform - Platform name (e.g., "indeed")
   * @returns Array of Job objects
   */
  async scrapeRSS(keyword: string, location: string, platform: string): Promise<Job[]> {
    const jobs: Job[] = [];

    try {
      // Build RSS URL based on platform
      let rssUrl = '';

      if (platform === 'indeed') {
        // Indeed RSS format: https://sa.indeed.com/rss?q=KEYWORD&l=LOCATION
        rssUrl = `https://sa.indeed.com/rss?q=${encodeURIComponent(keyword)}&l=${encodeURIComponent(location)}`;
      } else {
        logger.warn(`RSS feed not configured for platform: ${platform}`);
        return [];
      }

      logger.debug(`Fetching RSS feed: ${rssUrl}`);

      // Fetch RSS feed with timeout
      const response = await got(rssUrl, {
        timeout: { request: 10000 },
        headers: {
          'User-Agent': 'A1xAI-JobHunter/1.0 (RSS Feed Reader)',
          'Accept': 'application/rss+xml, application/xml, text/xml'
        }
      });

      // Parse XML with cheerio in XML mode
      const $ = cheerio.load(response.body, { xmlMode: true });

      // Extract job items from RSS feed
      $('item').each((_i, elem) => {
        try {
          const title = $(elem).find('title').text().trim();
          const link = $(elem).find('link').text().trim();
          const description = $(elem).find('description').text().trim();
          const pubDate = $(elem).find('pubDate').text().trim();

          // Skip if essential fields are missing
          if (!title || !link) {
            logger.debug(`Skipping RSS item with missing title or link`);
            return;
          }

          // Extract company from title (format: "Job Title - Company Name")
          let jobTitle = title;
          let company = 'Unknown';

          if (title.includes(' - ')) {
            const parts = title.split(' - ');
            jobTitle = parts[0].trim();
            company = parts.slice(1).join(' - ').trim(); // Handle multiple " - " in title
          }

          // Create job object
          jobs.push({
            id: generateJobId(),
            title: sanitizeText(jobTitle),
            company: sanitizeText(company),
            location: location,
            url: link,
            description: sanitizeText(description).substring(0, 500), // Limit description length
            postedDate: pubDate ? new Date(pubDate) : undefined,
            platform: platform
          });
        } catch (itemError) {
          logger.warn(`Error parsing RSS item:`, itemError);
        }
      });

      logger.info(`✅ RSS scraper found ${jobs.length} jobs for "${keyword}" from ${platform}`);
    } catch (error) {
      logger.error(`❌ RSS scraping failed for "${keyword}" on ${platform}:`, error);
    }

    return jobs;
  }

  /**
   * Scrape multiple keywords in sequence
   *
   * @param keywords - Array of keywords to search
   * @param location - Location (e.g., "Riyadh")
   * @param platform - Platform name (e.g., "indeed")
   * @returns Combined array of Job objects
   */
  async scrapeMultipleKeywords(
    keywords: string[],
    location: string,
    platform: string
  ): Promise<Job[]> {
    const allJobs: Job[] = [];

    for (const keyword of keywords) {
      const jobs = await this.scrapeRSS(keyword, location, platform);
      allJobs.push(...jobs);

      // Small delay between requests to be respectful
      if (keywords.indexOf(keyword) < keywords.length - 1) {
        await this.sleep(1000); // 1 second delay
      }
    }

    logger.info(`📊 RSS scraper total: ${allJobs.length} jobs across ${keywords.length} keywords`);
    return allJobs;
  }

  /**
   * Sleep utility for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get available RSS platforms
   *
   * @returns Array of platform IDs that support RSS
   */
  static getAvailablePlatforms(): string[] {
    return ['indeed']; // Add more platforms as RSS feeds are discovered
  }

  /**
   * Check if platform has RSS support
   *
   * @param platform - Platform ID to check
   * @returns True if RSS is available
   */
  static hasRSSSupport(platform: string): boolean {
    return this.getAvailablePlatforms().includes(platform);
  }
}
