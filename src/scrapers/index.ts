import { readFile } from 'fs/promises';
import { resolve } from 'path';
import pLimit from 'p-limit';
import { BaseScraper, PlatformConfig } from './base.js';
import { LinkedInScraper } from './linkedin.js';
import { IndeedScraper } from './indeed.js';
import { BaytScraper } from './bayt.js';
import { Job, logger, deduplicateJobs } from '../utils.js';

// Export new scrapers for external use
export { RSSJobScraper } from './rss-scraper.js';
export { WebSearchJobScraper } from './websearch-scraper.js';
export { JoobleJobScraper } from './jooble-scraper.js';
export { JSearchJobScraper } from './jsearch-scraper.js';
export { SearchAPIJobScraper } from './searchapi-scraper.js';

/**
 * Load platform configurations from JSON
 */
export async function loadPlatformConfigs(): Promise<PlatformConfig[]> {
  try {
    const configPath = resolve(process.cwd(), 'config/platforms.json');
    const configData = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);
    return config.platforms.filter((p: PlatformConfig) => p.enabled);
  } catch (error) {
    logger.error('Failed to load platform configs:', error);
    return [];
  }
}

/**
 * Create scraper instance for a platform
 */
export function createScraper(config: PlatformConfig): BaseScraper | null {
  try {
    switch (config.id) {
      case 'linkedin':
        return new LinkedInScraper(config);
      case 'indeed':
        return new IndeedScraper(config);
      case 'bayt':
        return new BaytScraper(config);
      // Add more scrapers here as they're implemented
      default:
        logger.warn(`No scraper implementation for platform: ${config.id}`);
        return null;
    }
  } catch (error) {
    logger.error(`Failed to create scraper for ${config.id}:`, error);
    return null;
  }
}

/**
 * Scan all platforms in parallel (limited concurrency)
 */
export async function scanAllPlatforms(mode: 'quick' | 'deep' = 'quick'): Promise<Job[]> {
  logger.info(`Starting ${mode} scan of all enabled platforms`);

  const configs = await loadPlatformConfigs();

  if (configs.length === 0) {
    logger.error('No enabled platforms found');
    return [];
  }

  logger.info(`Found ${configs.length} enabled platforms`);

  // Create scrapers for all platforms
  const scrapers: { scraper: BaseScraper; config: PlatformConfig }[] = [];

  for (const config of configs) {
    const scraper = createScraper(config);
    if (scraper) {
      await scraper.initialize();
      scrapers.push({ scraper, config });
    }
  }

  if (scrapers.length === 0) {
    logger.error('Failed to initialize any scrapers');
    return [];
  }

  // Parallel execution with concurrency limit (max 3 platforms at once)
  const limit = pLimit(3);
  const allJobs: Job[] = [];

  const scanPromises = scrapers.map(({ scraper, config }) =>
    limit(async () => {
      try {
        logger.info(`Starting scan: ${config.name}`);

        const jobs = mode === 'quick'
          ? await scraper.quickScan()
          : await scraper.deepScan();

        logger.info(`${config.name} completed: ${jobs.length} jobs found`);

        return jobs;
      } catch (error) {
        logger.error(`Error scanning ${config.name}:`, error);
        return [];
      } finally {
        // Cleanup scraper resources
        await scraper.cleanup();
      }
    })
  );

  // Wait for all scans to complete
  const results = await Promise.all(scanPromises);

  // Flatten and combine all jobs
  for (const jobs of results) {
    allJobs.push(...jobs);
  }

  // Deduplicate across all platforms
  const uniqueJobs = deduplicateJobs(allJobs);

  logger.info(`Scan complete: ${uniqueJobs.length} unique jobs found across ${scrapers.length} platforms`);

  return uniqueJobs;
}

/**
 * Adaptive scan: Quick scan first, then deep scan if needed
 */
export async function adaptiveScan(minJobsTarget: number = 10): Promise<Job[]> {
  logger.info(`Starting adaptive scan (target: ${minJobsTarget} jobs)`);

  // Try quick scan first
  let jobs = await scanAllPlatforms('quick');

  logger.info(`Quick scan found ${jobs.length} jobs`);

  // If we didn't get enough jobs, trigger deep scan
  if (jobs.length < minJobsTarget) {
    logger.warn(`Only ${jobs.length} jobs found, triggering deep scan...`);
    const moreJobs = await scanAllPlatforms('deep');

    // Combine and deduplicate
    jobs = deduplicateJobs([...jobs, ...moreJobs]);

    logger.info(`After deep scan: ${jobs.length} total jobs`);
  }

  return jobs;
}
