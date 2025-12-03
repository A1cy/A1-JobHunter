import { chromium as playwrightChromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'playwright';
import * as cheerio from 'cheerio';
import got from 'got';
import Bottleneck from 'bottleneck';
import pRetry from 'p-retry';
import RobotsParser from 'robots-parser';
import { getRandomUserAgent, logger, Job, generateJobId } from '../utils.js';

// Apply stealth plugin to playwright
playwrightChromium.use(stealth());

export interface PlatformConfig {
  id: string;
  name: string;
  url: string;
  requiresJS: boolean;
  priority: number;
  enabled: boolean;
  search_params: {
    location: string;
    keywords: string[];
  };
}

export interface ScanOptions {
  mode: 'quick' | 'deep';
  maxJobs?: number;
  timeout?: number;
}

/**
 * Abstract base scraper class with intelligent scraping strategies
 */
export abstract class BaseScraper {
  protected config: PlatformConfig;
  protected rateLimiter: Bottleneck;
  protected robotsParser?: ReturnType<typeof RobotsParser>;
  protected browser?: Browser;
  protected jobCache: Set<string> = new Set();

  constructor(config: PlatformConfig) {
    this.config = config;

    // Rate limiter: 1 request per 2 seconds per platform
    this.rateLimiter = new Bottleneck({
      minTime: 2000,
      maxConcurrent: 1
    });
  }

  /**
   * Initialize scraper (load robots.txt, setup browser if needed)
   */
  async initialize(): Promise<void> {
    try {
      // Load robots.txt
      await this.loadRobotsTxt();

      // Initialize browser for JS-heavy sites
      if (this.config.requiresJS) {
        await this.initBrowser();
      }

      logger.info(`${this.config.name} scraper initialized`);
    } catch (error) {
      logger.warn(`Failed to initialize ${this.config.name}:`, error);
    }
  }

  /**
   * Load and parse robots.txt
   */
  protected async loadRobotsTxt(): Promise<void> {
    try {
      const robotsUrl = new URL('/robots.txt', this.config.url).href;
      const response = await got(robotsUrl, {
        timeout: { request: 5000 },
        throwHttpErrors: false
      });

      if (response.statusCode === 200) {
        this.robotsParser = RobotsParser(robotsUrl, response.body);
      }
    } catch (error) {
      logger.debug(`Could not load robots.txt for ${this.config.name}`);
    }
  }

  /**
   * Initialize Playwright browser with enhanced stealth
   */
  protected async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await playwrightChromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
        ]
      });
    }
  }

  /**
   * Get random referrer for more realistic requests
   */
  protected getRandomReferer(): string {
    const referers = [
      'https://www.google.com/search?q=jobs+riyadh',
      'https://www.google.sa/',
      'https://www.linkedin.com/',
      'https://www.indeed.com/',
      'https://www.bayt.com/',
      'https://www.tanqeeb.com/'
    ];
    return referers[Math.floor(Math.random() * referers.length)];
  }

  /**
   * Check if URL is allowed by robots.txt
   */
  protected isUrlAllowed(url: string): boolean {
    if (!this.robotsParser) return true;
    return this.robotsParser.isAllowed(url, 'A1xAI-JobHunter') ?? true;
  }

  /**
   * Scrape with Playwright (for JS-heavy sites) - Enhanced stealth
   */
  protected async scrapeWithBrowser(url: string, extractFn: (page: Page) => Promise<Job[]>): Promise<Job[]> {
    if (!this.browser) {
      await this.initBrowser();
    }

    // Create context with realistic browser fingerprint
    const context = await this.browser!.newContext({
      viewport: {
        width: 1920 + Math.floor(Math.random() * 100),
        height: 1080 + Math.floor(Math.random() * 100)
      },
      userAgent: getRandomUserAgent(),
      locale: 'en-US',
      timezoneId: 'Asia/Riyadh',
      geolocation: { longitude: 46.6753, latitude: 24.7136 }, // Riyadh coordinates
      permissions: ['geolocation'],
    });

    const page = await context.newPage();

    try {
      // Set realistic headers
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Referer': this.getRandomReferer()
      });

      // Navigate with retry logic
      await pRetry(
        async () => {
          await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
        },
        {
          retries: 3,
          minTimeout: 2000,
          maxTimeout: 10000,
          onFailedAttempt: (error: any) => {
            logger.warn(`Retry ${error.attemptNumber} for ${url}: ${error.message}`);
          }
        }
      );

      // Random delay to appear more human
      await page.waitForTimeout(1500 + Math.floor(Math.random() * 1000));

      // Extract jobs using platform-specific logic
      const jobs = await extractFn(page);

      return jobs;
    } catch (error) {
      logger.error(`Browser scraping failed for ${url}:`, error);
      return [];
    } finally {
      await page.close();
      await context.close();
    }
  }

  /**
   * Scrape with Cheerio (for static HTML sites) - Enhanced headers
   */
  protected async scrapeWithCheerio(url: string, extractFn: ($: cheerio.CheerioAPI) => Job[]): Promise<Job[]> {
    try {
      // Random delay before request to appear more human
      await this.sleep(500 + Math.floor(Math.random() * 1000));

      const response = await pRetry(
        async () => {
          return await got(url, {
            headers: {
              'User-Agent': getRandomUserAgent(),
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
              'Accept-Encoding': 'gzip, deflate, br',
              'DNT': '1',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1',
              'Referer': this.getRandomReferer(),
              'Cache-Control': 'max-age=0'
            },
            timeout: { request: 15000 },
            followRedirect: true,
            retry: {
              limit: 0 // Disable got's internal retry, we use pRetry instead
            }
          });
        },
        {
          retries: 4,
          minTimeout: 2000,
          maxTimeout: 10000,
          onFailedAttempt: (error: any) => {
            logger.warn(`Retry ${error.attemptNumber} for ${url}: ${error.message}`);
          }
        }
      );

      const $ = cheerio.load(response.body) as cheerio.CheerioAPI;
      const jobs = extractFn($);

      return jobs;
    } catch (error) {
      logger.error(`Cheerio scraping failed for ${url}:`, error);
      throw error;  // ✅ Re-throw to trigger proxy fallback in scan()
    }
  }

  /**
   * Build ScraperAPI proxy URL
   */
  protected buildProxyUrl(targetUrl: string): string {
    const apiKey = process.env.SCRAPERAPI_KEY;
    if (!apiKey) {
      logger.warn('SCRAPERAPI_KEY not set, cannot use proxy');
      return targetUrl;
    }

    // ScraperAPI format: http://api.scraperapi.com?api_key=KEY&url=TARGET_URL
    const proxyUrl = `http://api.scraperapi.com/?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}&country_code=sa&render=false`;
    return proxyUrl;
  }

  /**
   * Scrape with ScraperAPI proxy (fallback when direct scraping blocked)
   */
  protected async scrapeWithProxy(url: string, extractFn: ($: cheerio.CheerioAPI) => Job[]): Promise<Job[]> {
    const apiKey = process.env.SCRAPERAPI_KEY;
    if (!apiKey) {
      logger.error('SCRAPERAPI_KEY not set, cannot use proxy fallback');
      return [];
    }

    try {
      logger.info(`Using ScraperAPI proxy for ${url}`);

      // Random delay before request
      await this.sleep(500 + Math.floor(Math.random() * 1000));

      const proxyUrl = this.buildProxyUrl(url);

      const response = await pRetry(
        async () => {
          return await got(proxyUrl, {
            headers: {
              'User-Agent': getRandomUserAgent(),
            },
            timeout: { request: 30000 }, // Proxy takes longer
            followRedirect: true,
            retry: {
              limit: 0 // Disable got's internal retry, we use pRetry instead
            }
          });
        },
        {
          retries: 2, // Proxy is more reliable, fewer retries needed
          minTimeout: 3000,
          maxTimeout: 10000,
          onFailedAttempt: (error: any) => {
            logger.warn(`Proxy retry ${error.attemptNumber} for ${url}: ${error.message}`);
          }
        }
      );

      const $ = cheerio.load(response.body) as cheerio.CheerioAPI;
      const jobs = extractFn($);

      logger.info(`✅ Proxy successfully retrieved ${jobs.length} jobs from ${url}`);

      return jobs;
    } catch (error) {
      logger.error(`Proxy scraping failed for ${url}:`, error);
      return [];
    }
  }

  /**
   * Deduplicate jobs using cache
   */
  protected deduplicateJobs(jobs: Job[]): Job[] {
    const unique: Job[] = [];

    for (const job of jobs) {
      const key = job.url || `${job.title}|${job.company}`;

      if (!this.jobCache.has(key)) {
        this.jobCache.add(key);
        unique.push(job);
      }
    }

    return unique;
  }

  /**
   * Build search URL with keywords and location
   */
  protected abstract buildSearchUrl(keyword: string, mode: 'quick' | 'deep'): string;

  /**
   * Extract jobs from page (platform-specific implementation)
   */
  protected abstract extractJobs(pageOrDom: Page | cheerio.CheerioAPI): Promise<Job[]> | Job[];

  /**
   * Scan platform for jobs
   */
  async scan(options: ScanOptions = { mode: 'quick' }): Promise<Job[]> {
    if (!this.config.enabled) {
      logger.info(`${this.config.name} is disabled, skipping`);
      return [];
    }

    logger.info(`Starting ${options.mode} scan of ${this.config.name}`);

    const allJobs: Job[] = [];
    const keywords = this.config.search_params.keywords;

    try {
      // Scan each keyword
      for (const keyword of keywords) {
        const url = this.buildSearchUrl(keyword, options.mode);

        // Check robots.txt
        if (!this.isUrlAllowed(url)) {
          logger.warn(`URL blocked by robots.txt: ${url}`);
          continue;
        }

        // Apply rate limiting with 2-tier fallback: direct → proxy
        const jobs = await this.rateLimiter.schedule(async () => {
          if (this.config.requiresJS) {
            // JS-heavy sites: use Playwright with stealth
            return await this.scrapeWithBrowser(url, async (page) => {
              const result = await this.extractJobs(page);
              return Array.isArray(result) ? result : [];
            });
          } else {
            // Static sites: Try direct Cheerio first, fallback to proxy if blocked
            try {
              return await this.scrapeWithCheerio(url, (dom) => {
                const result = this.extractJobs(dom);
                return Array.isArray(result) ? result : [];
              });
            } catch (error: any) {
              // If 403 Forbidden, try ScraperAPI proxy as fallback
              if (error.response?.statusCode === 403 || error.code === 'ERR_NON_2XX_3XX_RESPONSE') {
                logger.warn(`Direct scraping blocked (403), trying ScraperAPI proxy...`);
                return await this.scrapeWithProxy(url, (dom) => {
                  const result = this.extractJobs(dom);
                  return Array.isArray(result) ? result : [];
                });
              }
              // Re-throw other errors
              throw error;
            }
          }
        });

        // Add platform info and deduplicate
        const jobsWithPlatform = jobs.map(job => ({
          ...job,
          platform: this.config.name,
          id: job.id || generateJobId()
        }));

        allJobs.push(...jobsWithPlatform);

        logger.info(`Found ${jobs.length} jobs for keyword "${keyword}" on ${this.config.name}`);

        // Respect rate limits between keywords
        if (keywords.indexOf(keyword) < keywords.length - 1) {
          await this.sleep(2000);
        }
      }

      // Deduplicate all jobs
      const uniqueJobs = this.deduplicateJobs(allJobs);

      logger.info(`${this.config.name} scan complete: ${uniqueJobs.length} unique jobs found`);

      return uniqueJobs;
    } catch (error) {
      logger.error(`Error scanning ${this.config.name}:`, error);
      return allJobs; // Return partial results
    }
  }

  /**
   * Quick scan (first 20-30 listings)
   */
  async quickScan(): Promise<Job[]> {
    return await this.scan({ mode: 'quick', maxJobs: 30 });
  }

  /**
   * Deep scan (100+ listings)
   */
  async deepScan(): Promise<Job[]> {
    return await this.scan({ mode: 'deep', maxJobs: 100 });
  }

  /**
   * Sleep utility
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
    }
    this.jobCache.clear();
  }
}
