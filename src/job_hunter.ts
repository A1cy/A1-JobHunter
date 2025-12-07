#!/usr/bin/env tsx
/**
 * A1 Job Hunter - Automated Daily Job Search
 *
 * Runs daily at 9:00 AM Saudi time to find matching tech jobs in Riyadh
 * Uses AI-powered matching with Claude and delivers results via Telegram
 */

import { config } from 'dotenv';
import { writeFile, mkdir, readFile, readdir } from 'fs/promises';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { Telegraf } from 'telegraf';
import got from 'got';
import { JoobleJobScraper } from './scrapers/jooble-scraper.js';
import { JSearchJobScraper } from './scrapers/jsearch-scraper.js';
import { SearchAPIJobScraper } from './scrapers/searchapi-scraper.js';
import { BaytScraper } from './scrapers/bayt.js';
import { IndeedScraper } from './scrapers/indeed.js';
import { LinkedInScraper } from './scrapers/linkedin.js';
import { RSSJobScraper } from './scrapers/rss-scraper.js';
import { matchJobsForAllUsers } from './multi-user-matcher.js';
import { sendToAllUsers, sendErrorNotificationToAllUsers } from './multi-user-telegram.js';
import { logger, deduplicateJobs, Job, generateJobId } from './utils.js';
import { createMonitor } from './monitoring.js';

// Load environment variables
config();

/**
 * Save results to JSON file
 */
async function saveResults(jobs: any[]): Promise<void> {
  try {
    const resultsDir = resolve(process.cwd(), 'results');

    // Ensure results directory exists
    await mkdir(resultsDir, { recursive: true });

    // Save as latest.json
    const latestPath = resolve(resultsDir, 'latest.json');
    await writeFile(latestPath, JSON.stringify(jobs, null, 2));

    logger.info(`Results saved to ${latestPath}`);
  } catch (error) {
    logger.error('Error saving results:', error);
  }
}

/**
 * Main job hunting workflow
 */
async function main() {
  const startTime = Date.now();
  const monitor = createMonitor();

  logger.info('🚀 A1 Job Hunter starting...');
  logger.info(`Mode: ${process.env.MODE || 'adaptive'}`);
  logger.info(`Date: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })}`);

  try {
    // Step 0: Load all user profiles to extract search keywords (MULTI-USER FIX)
    logger.info('📋 Step 0: Loading user profiles for keyword extraction...');

    const { loadAllUsers } = await import('./multi-user-matcher.js');
    const users = await loadAllUsers();

    if (users.length === 0) {
      logger.error('❌ No enabled users found');
      return;
    }

    // Extract unique keywords from all user profiles WITH DOMAIN CATEGORIZATION
    // This ensures balanced scraping across HR, Product, and IT domains
    const domainKeywords = {
      hr: new Set<string>(),
      product: new Set<string>(),
      it: new Set<string>()
    };

    for (const user of users) {
      // Detect user's domain (hr/product/it)
      const domain = detectUserDomain(user.profile);

      // Add target roles as keywords
      for (const role of user.profile.target_roles) {
        domainKeywords[domain].add(role);
      }

      // Add primary skills as keywords
      if (user.profile.skills?.primary) {
        for (const skill of user.profile.skills.primary) {
          domainKeywords[domain].add(skill);
        }
      }
    }

    // TRUE ROUND-ROBIN INTERLEAVING: hr1, product1, it1, hr2, product2, it2, ...
    // This ensures balanced domain representation in Google search query
    const searchKeywords: string[] = [];

    const hrArray = Array.from(domainKeywords.hr);
    const productArray = Array.from(domainKeywords.product);
    const itArray = Array.from(domainKeywords.it);

    const maxLength = Math.max(hrArray.length, productArray.length, itArray.length);

    for (let i = 0; i < maxLength; i++) {
      if (i < hrArray.length) searchKeywords.push(hrArray[i]);
      if (i < productArray.length) searchKeywords.push(productArray[i]);
      if (i < itArray.length) searchKeywords.push(itArray[i]);
    }

    logger.info(`📊 Keyword diversity by domain:`);
    logger.info(`   HR: ${domainKeywords.hr.size} keywords`);
    logger.info(`   Product: ${domainKeywords.product.size} keywords`);
    logger.info(`   IT: ${domainKeywords.it.size} keywords`);
    logger.info(`   Total: ${searchKeywords.length} keywords for scraping`);
    logger.info(`🔍 Sample keywords: ${searchKeywords.slice(0, 10).join(', ')}...`);

    /**
     * Helper function to detect user's domain based on their target roles
     */
    function detectUserDomain(profile: any): 'hr' | 'product' | 'it' {
      const rolesStr = profile.target_roles.join(' ').toLowerCase();

      if (rolesStr.includes('hr') || rolesStr.includes('recruitment') ||
          rolesStr.includes('human resources') || rolesStr.includes('payroll')) {
        return 'hr';
      }
      if (rolesStr.includes('product') || rolesStr.includes('brand') ||
          rolesStr.includes('marketing')) {
        return 'product';
      }
      return 'it'; // Default to IT
    }

    /**
     * Parallel scraper functions for concurrent execution
     */

    // 🆕 NEW: Google Custom Search API Scraper (TIER 1 - PRIMARY)
    async function scrapeGoogle(keywords: string[]): Promise<Job[]> {
      try {
        logger.info('🔍 [Google] Starting (TIER 1 - PRIMARY)...');
        logger.info(`🔑 [Google] API Key configured: ${!!process.env.GOOGLE_API_KEY}`);
        logger.info(`🔑 [Google] CX configured: ${!!process.env.GOOGLE_CX}`);

        const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
        const GOOGLE_CX = process.env.GOOGLE_CX;

        if (!GOOGLE_API_KEY || !GOOGLE_CX) {
          logger.warn('⚠️  [Google] API key or CX not configured, skipping Google Custom Search');
          return [];
        }

        const allJobs: Job[] = [];

        // 🚀 NEW STRATEGY: 3 domain-specific queries for better coverage
        // Instead of 1 query with 30 mixed keywords, run 3 focused queries
        // Benefits: Better domain distribution, more diverse results
        // API Usage: 3 queries × 4 pages = 12 requests/day (12% of 100 free quota)

        // 🌐 Comprehensive MENA job board coverage (15+ platforms)
        // Tier 1: Primary platforms (always include)
        const tier1 = 'site:linkedin.com/jobs OR site:bayt.com OR site:sa.indeed.com OR ' +
                      'site:naukrigulf.com OR site:gulftalent.com';

        // Tier 2: Secondary platforms (high quality)
        const tier2 = 'site:tanqeeb.com OR site:glassdoor.com/Job OR site:forasna.com OR ' +
                      'site:akhtaboot.com OR site:gulf.monster.com';

        // Tier 3: Additional coverage
        const tier3 = 'site:mihnati.com OR site:laimoon.com OR site:jobzella.com OR ' +
                      'site:daleel-madani.org OR site:careerjet.com.sa';

        const siteFilter = ` (${tier1} OR ${tier2} OR ${tier3})`;

        // ✅ CRITICAL FIX: Removed site:linkedin.com/in (returns profiles NOT jobs!)
        // ✅ ADDED: 15+ job platforms for maximum MENA coverage
        const locationFilter = ' Riyadh Saudi Arabia';

        // Prepare 3 domain-specific queries
        const domainQueries = [
          {
            name: 'HR',
            keywords: hrArray.slice(0, 10),
            color: '👔'
          },
          {
            name: 'Product',
            keywords: productArray.slice(0, 10),
            color: '📦'
          },
          {
            name: 'IT',
            keywords: itArray.slice(0, 10),
            color: '💻'
          }
        ];

        logger.info(`📝 [Google] Optimized 3-query strategy:`);
        logger.info(`   Total keywords available: ${keywords.length}`);
        logger.info(`   HR Query: ${domainQueries[0].keywords.length} keywords`);
        logger.info(`   Product Query: ${domainQueries[1].keywords.length} keywords`);
        logger.info(`   IT Query: ${domainQueries[2].keywords.length} keywords`);
        logger.info(`   Site filter: 9 job platforms`);
        logger.info(`   Expected API usage: 12 requests/day (12% of free quota)\n`);

        // Execute 3 domain-specific queries
        for (const domainQuery of domainQueries) {
          // ✅ FIX #3: Skip queries with no keywords (debug logging)
          if (domainQuery.keywords.length === 0) {
            logger.warn(`⚠️  [Google] Skipping ${domainQuery.name} query - no keywords available`);
            continue;
          }

          logger.info(`${domainQuery.color} [Google] Starting ${domainQuery.name} query...`);

          const searchQuery = domainQuery.keywords.join(' OR ');
          // 🎯 Force job-related pages with explicit job keywords
          const jobKeywords = ' (jobs OR hiring OR careers OR vacancy OR vacancies OR employment OR positions)';
          const fullQuery = `${searchQuery}${jobKeywords}${locationFilter}${siteFilter}`;

          logger.info(`   Keywords: ${domainQuery.keywords.join(', ')}`);

          // Fetch 4 pages per domain (40 results per domain)
          // Total: 3 domains × 4 pages = 12 requests/day
          for (let page = 0; page < 4; page++) {
            const startIndex = page * 10 + 1; // 1, 11, 21, 31

            logger.info(`   📄 Page ${page + 1}/4 (startIndex: ${startIndex})...`);

            const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(fullQuery)}&start=${startIndex}`;

            try {
              const response = await got(url, {
                timeout: { request: 10000 },
                responseType: 'json'
              });

              const data = response.body as any;

              logger.info(`   📦 Response: ${data.items?.length || 0} items`);

              if (!data.items || data.items.length === 0) {
                logger.info(`   ⚠️  No more results for ${domainQuery.name}, stopping pagination`);
                break; // No more results
              }

              // Parse Google results into Job format
              for (const item of data.items) {
                // 🛡️ TRIPLE-LAYER URL VALIDATION (Safety Net)

                // VALIDATION LAYER 1: Skip LinkedIn profiles
                if (item.link.includes('linkedin.com/in/')) {
                  logger.warn(`   ⚠️  Skipping LinkedIn profile: ${item.title}`);
                  continue;
                }

                // VALIDATION LAYER 2: Skip company/school/showcase pages
                const nonJobPatterns = ['/company/', '/school/', '/showcase/', '/about', '/people', '/cmp/', '/Overview/'];
                if (nonJobPatterns.some(pattern => item.link.includes(pattern))) {
                  logger.warn(`   ⚠️  Skipping non-job page: ${item.title}`);
                  continue;
                }

                // VALIDATION LAYER 3: Ensure job-related URL patterns (positive filter)
                // ✅ FIX #2: Relaxed patterns (removed trailing slashes, added more variations)
                const jobUrlPatterns = [
                  '/jobs', '/job', '/careers', '/career', '/vacancy', '/vacancies',
                  '/viewjob', '/job-listing', '/jobdetails', '/opportunities',
                  '/job-openings', '/current-opportunities', '/all-jobs', '/positions',
                  '/employment', '/hiring', '/work-with-us', '/join-', '/openings'
                ];
                const hasJobPattern = jobUrlPatterns.some(pattern => item.link.toLowerCase().includes(pattern));

                if (!hasJobPattern) {
                  logger.warn(`   ⚠️  URL doesn't match job patterns: ${item.link}`);
                  continue;
                }

                // ✅ PASSED ALL VALIDATIONS - Extract company and title
                // Format: "Job Title - Company Name"
                const titleParts = item.title.split(' - ');
                const jobTitle = titleParts[0] || item.title;
                const company = titleParts.slice(1).join(' - ') || 'Unknown';

                // VALIDATION LAYER 4: ✅ FIX #4 - Skip generic career pages by title
                const genericTitles = [
                  'careers', 'job search', 'search opportunities', 'current opportunities',
                  'job openings', 'work with us', 'join our team', 'employment opportunities',
                  'view all jobs', 'all jobs', 'open positions', 'career opportunities'
                ];
                const titleLower = jobTitle.toLowerCase();
                const isGenericPage = genericTitles.some(generic =>
                  titleLower === generic ||
                  titleLower.includes(`${generic} |`) ||
                  titleLower.startsWith(generic)
                );

                if (isGenericPage) {
                  logger.warn(`   ⚠️  Skipping generic career page: ${item.title}`);
                  continue;
                }

                allJobs.push({
                  id: generateJobId(),
                  title: jobTitle.trim(),
                  company: company.trim(),
                  location: 'Riyadh, Saudi Arabia',
                  url: item.link,
                  description: (item.snippet || '').trim(),
                  platform: 'Google',
                  source: `Google Custom Search API (${domainQuery.name})`
                });
              }

              logger.info(`   ✅ Parsed ${data.items.length} ${domainQuery.name} jobs (total: ${allJobs.length})`);

              // Rate limit: 1 request per second
              await new Promise(r => setTimeout(r, 1000));

            } catch (pageError: any) {
              logger.error(`   ❌ Page ${page + 1} failed:`, pageError.message || pageError);
              if (pageError.response) {
                logger.error(`   ❌ API Response: ${JSON.stringify(pageError.response.body).substring(0, 200)}`);
              }
              break; // Stop pagination on error
            }
          }

          logger.info(`   ✅ ${domainQuery.name} query complete: ${allJobs.filter(j => j.source?.includes(domainQuery.name)).length} jobs\n`);
        }

        logger.info(`✅ [Google] TOTAL JOBS SCRAPED: ${allJobs.length} jobs`);
        if (allJobs.length > 0) {
          logger.info(`📋 [Google] Sample jobs:`);
          allJobs.slice(0, 3).forEach((job, i) => {
            logger.info(`   ${i + 1}. "${job.title}" at ${job.company}`);
          });
        }
        return allJobs;

      } catch (error: any) {
        logger.error('❌ [Google] Failed:', error.message || error);
        return [];
      }
    }

    async function scrapeJooble(keywords: string[]): Promise<Job[]> {
      try {
        logger.info('📡 [Jooble] Starting...');
        const jooble = new JoobleJobScraper();
        const jobs = await jooble.searchMultipleKeywords(keywords.slice(0, 12), 'Riyadh');
        logger.info(`✅ [Jooble] ${jobs.length} jobs found`);
        return jobs;
      } catch (error) {
        logger.error('❌ [Jooble] Failed:', error);
        return [];
      }
    }

    async function scrapeJSearch(keywords: string[]): Promise<Job[]> {
      try {
        logger.info('🔍 [JSearch] Starting...');
        const jsearch = new JSearchJobScraper();
        const query = keywords.slice(0, 10).join(' OR ');
        const jobs = await jsearch.searchJobs(query, 'Riyadh, Saudi Arabia');
        logger.info(`✅ [JSearch] ${jobs.length} jobs found`);
        return jobs;
      } catch (error) {
        logger.error('❌ [JSearch] Failed:', error);
        return [];
      }
    }

    async function scrapeBayt(keywords: string[]): Promise<Job[]> {
      try {
        logger.info('🌍 [Bayt] Starting...');
        const config = {
          platform: 'bayt' as const,
          search_params: { location: 'Riyadh', country: 'Saudi Arabia' },
          scrape_mode: 'quick' as const
        };
        const bayt = new BaytScraper(config);

        const allJobs: Job[] = [];
        for (const keyword of keywords.slice(0, 5)) {
          const jobs = await bayt.scrape(keyword);
          allJobs.push(...jobs);
          await new Promise(r => setTimeout(r, 2000)); // Rate limit
        }

        logger.info(`✅ [Bayt] ${allJobs.length} jobs found`);
        return allJobs;
      } catch (error) {
        logger.error('❌ [Bayt] Failed:', error);
        return [];
      }
    }

    async function scrapeIndeed(keywords: string[]): Promise<Job[]> {
      try {
        logger.info('🌍 [Indeed] Starting...');
        const config = {
          platform: 'indeed' as const,
          search_params: { location: 'Riyadh', country: 'Saudi Arabia' },
          scrape_mode: 'quick' as const
        };
        const indeed = new IndeedScraper(config);

        const allJobs: Job[] = [];
        for (const keyword of keywords.slice(0, 5)) {
          const jobs = await indeed.scrape(keyword);
          allJobs.push(...jobs);
          await new Promise(r => setTimeout(r, 2000)); // Rate limit
        }

        logger.info(`✅ [Indeed] ${allJobs.length} jobs found`);
        return allJobs;
      } catch (error) {
        logger.error('❌ [Indeed] Failed:', error);
        return [];
      }
    }

    async function scrapeRSS(keywords: string[]): Promise<Job[]> {
      try {
        logger.info('📡 [RSS] Starting...');
        const rss = new RSSJobScraper();

        const allJobs: Job[] = [];
        for (const keyword of keywords.slice(0, 3)) {
          const jobs = await rss.scrapeRSS(keyword, 'Riyadh', 'indeed');
          allJobs.push(...jobs);
          await new Promise(r => setTimeout(r, 1000)); // Faster for RSS
        }

        logger.info(`✅ [RSS] ${allJobs.length} jobs found`);
        return allJobs;
      } catch (error) {
        logger.error('❌ [RSS] Failed:', error);
        return [];
      }
    }

    async function scrapeSearchAPI(keywords: string[]): Promise<Job[]> {
      try {
        logger.info('🚨 [SearchAPI] Starting...');
        const searchapi = new SearchAPIJobScraper();
        const query = keywords.slice(0, 10).join(' OR '); // Use user keywords!
        const jobs = await searchapi.searchJobs(query, 'Riyadh Saudi Arabia');
        logger.info(`✅ [SearchAPI] ${jobs.length} jobs found`);
        return jobs;
      } catch (error) {
        logger.error('❌ [SearchAPI] Failed:', error);
        return [];
      }
    }

    async function scrapeLinkedIn(keywords: string[]): Promise<Job[]> {
      try {
        logger.info('💼 [LinkedIn] Starting (stealth mode)...');
        const config = {
          platform: 'linkedin' as const,
          search_params: { location: 'Riyadh, Saudi Arabia', country: 'Saudi Arabia' },
          scrape_mode: 'quick' as const
        };
        const linkedin = new LinkedInScraper(config);

        const allJobs: Job[] = [];
        for (const keyword of keywords.slice(0, 3)) { // Limit to 3 for bot detection
          const jobs = await linkedin.scrape(keyword);
          allJobs.push(...jobs);
          await new Promise(r => setTimeout(r, 5000)); // Slower for stealth
        }

        logger.info(`✅ [LinkedIn] ${allJobs.length} jobs found`);
        return allJobs;
      } catch (error) {
        logger.warn('⚠️  [LinkedIn] Bot detection or error:', error);
        return [];
      }
    }

    async function loadWebSearchData(): Promise<Job[]> {
      try {
        logger.info('📂 [WebSearch] Loading pregenerated data...');
        const dataDir = resolve(process.cwd(), 'data');

        if (!existsSync(dataDir)) return [];

        const files = await readdir(dataDir);
        const webSearchFiles = files
          .filter(f => f.startsWith('websearch-jobs-') && f.endsWith('.json'))
          .sort()
          .reverse();

        if (webSearchFiles.length === 0) return [];

        const latestFile = webSearchFiles[0];
        const filePath = resolve(dataDir, latestFile);
        const fileContent = await readFile(filePath, 'utf-8');
        const webSearchData = JSON.parse(fileContent);

        const jobs = (webSearchData.jobs || []).map((wsJob: any) => ({
          id: wsJob.id || generateJobId(),
          title: wsJob.title,
          company: wsJob.company || 'Unknown',
          location: wsJob.location || 'Riyadh, Saudi Arabia',
          url: wsJob.url,
          description: wsJob.description || '',
          platform: wsJob.platform || 'WebSearch',
          postedDate: wsJob.postedDate ? new Date(wsJob.postedDate) : undefined,
          source: 'WebSearch'
        }));

        logger.info(`✅ [WebSearch] ${jobs.length} jobs loaded`);
        return jobs;
      } catch (error) {
        logger.error('❌ [WebSearch] Failed:', error);
        return [];
      }
    }

    // Step 1: Hybrid 11-Source Parallel Job Scraping
    logger.info('📡 Step 1: Parallel job scraping (11 sources)...');

    let jobs: Job[] = [];

    logger.info('\n🚀 Launching Google Custom Search (other scrapers temporarily disabled)...\n');

    // 🎯 FOCUS: Google Custom Search ONLY (user request: "disable the other api scrapper")
    // Strategy: Perfect Google search first, then re-enable other scrapers later
    // Google API usage: 5 requests/day (5% of 100 free quota)
    const scraperResults = await Promise.allSettled([
      scrapeGoogle(searchKeywords),      // Tier 1 - PRIMARY (Google Custom Search) ✅ ACTIVE
      // scrapeJooble(searchKeywords),       // Tier 2 - FREE API ❌ Disabled (user wants Google focus)
      // scrapeJSearch(searchKeywords),      // Tier 3 - FREE API ❌ Disabled
      // scrapeBayt(searchKeywords),         // Tier 4 - Web Scraping ❌ Disabled
      // scrapeIndeed(searchKeywords),       // Tier 5 - Web Scraping ❌ Disabled
      // scrapeRSS(searchKeywords),          // Tier 6 - RSS Feeds ❌ Disabled
      // loadWebSearchData(),                // Tier 7 - Pregenerated Data ❌ Disabled
      // scrapeSearchAPI(searchKeywords),    // Tier 8 - FREE API ❌ Disabled
      // scrapeLinkedIn(searchKeywords)      // Tier 9 - Stealth Scraping ❌ Disabled
    ]);

    // Collect jobs from all successful scrapers
    scraperResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        jobs.push(...result.value);
      } else {
        const scraperNames = ['Google', 'Jooble', 'JSearch', 'Bayt', 'Indeed', 'RSS', 'WebSearch', 'SearchAPI', 'LinkedIn'];
        logger.warn(`⚠️  ${scraperNames[index]} scraper failed but continuing with others`);
      }
    });

    // Deduplicate across all sources
    const uniqueJobs = deduplicateJobs(jobs);

    logger.info(`\n═══════════════════════════════════════════════════════════`);
    logger.info(`✅ 11-Source Parallel Scraping Complete:`);
    logger.info(`   Total scraped: ${jobs.length} jobs`);
    logger.info(`   After deduplication: ${uniqueJobs.length} unique jobs`);
    logger.info(`   Sources: ${[...new Set(uniqueJobs.map(j => j.platform))].join(', ')}`);
    logger.info(`   Tier 1: Google Custom Search (PRIMARY)`);
    logger.info(`   Execution time: ~30-60s (parallel) vs ~120-180s (sequential)`);
    logger.info(`   Cost: $0 (100% FREE sources)`);
    logger.info(`═══════════════════════════════════════════════════════════\n`);

    jobs = uniqueJobs;

    // Record scraping metrics
    const jobsBySource: Record<string, number> = {};
    for (const job of jobs) {
      jobsBySource[job.platform] = (jobsBySource[job.platform] || 0) + 1;
    }
    monitor.recordMetrics({
      totalJobs: jobs.length,
      jobsBySource
    });

    if (jobs.length === 0) {
      logger.warn('⚠️ No jobs found from any source');
      logger.info('💡 All users will be notified that no jobs were found today');

      // Even with 0 jobs, send notification to all users
      await sendToAllUsers([]);

      logger.info('✅ Job hunt complete (no results) - All users notified');
      return;
    }

    // Step 2: Multi-user matching
    logger.info('🔍 Step 2: Multi-user matching...');

    const userResults = await matchJobsForAllUsers(jobs);

    if (userResults.length === 0) {
      logger.error('❌ No enabled users found with valid Telegram chat IDs');
      logger.info('💡 Make sure users have:');
      logger.info('   1. profile.json in users/[username]/ directory');
      logger.info('   2. config.json with enabled: true');
      logger.info('   3. telegram_chat_id configured in config.json');
      return;
    }

    logger.info(`\n═══════════════════════════════════════════════════════════`);
    logger.info(`✅ Multi-User Matching Complete:`);
    userResults.forEach(result => {
      logger.info(`   - ${result.username} (${result.profile.name}): ${result.matched_jobs.length} jobs (avg ${result.stats.avg_score}%)`);
    });
    logger.info(`═══════════════════════════════════════════════════════════\n`);

    // Record matching metrics
    const totalDelivered = userResults.reduce((sum, r) => sum + r.matched_jobs.length, 0);
    monitor.recordMetrics({
      usersProcessed: userResults.length,
      jobsDelivered: totalDelivered
    });

    // Step 3: Save results for all users
    logger.info('💾 Step 3: Saving results...');

    // Save combined results (for backward compatibility)
    const allMatchedJobs = userResults.flatMap(r => r.matched_jobs);
    await saveResults(allMatchedJobs);

    // Step 4: Send personalized jobs to each user
    logger.info('📱 Step 4: Sending personalized results to each user...');

    await sendToAllUsers(userResults);

    // Done!
    const duration = Math.round((Date.now() - startTime) / 1000);

    logger.info(`✅ Job hunt complete for all users!`);
    logger.info(`⏱️ Total time: ${duration}s`);

    // Record runtime
    monitor.recordMetrics({ runtime: Date.now() - startTime });

    // Summary stats
    logger.info('\n📊 Summary:');
    logger.info(`   Users processed: ${userResults.length}`);
    logger.info(`   Jobs scraped: ${jobs.length}`);
    logger.info(`   Total jobs sent: ${allMatchedJobs.length}`);
    userResults.forEach(result => {
      logger.info(`   - ${result.username}: ${result.matched_jobs.length} jobs (${result.stats.avg_score}% avg)`);
    });
    logger.info(`   Platforms: ${[...new Set(jobs.map(j => j.platform))].join(', ')}`);
    logger.info(`   Duration: ${duration}s`);

    // Perform health checks
    await monitor.performHealthCheck();

    // Send summary to admin
    await monitor.sendSummary();

    // Exit gracefully (prevents Telegram bot from hanging)
    logger.info('👋 Exiting gracefully...');
    process.exit(0);

  } catch (error) {
    logger.error('❌ Job hunt failed:', error);

    // Record error
    const errorMessage = error instanceof Error ? error.message : String(error);
    monitor.recordMetrics({
      errors: [errorMessage],
      runtime: Date.now() - startTime
    });

    // Send critical alert to admin
    await monitor.sendAlert(
      `System failure: ${errorMessage}`,
      'critical'
    );

    // Send error notification to all users
    if (error instanceof Error) {
      await sendErrorNotificationToAllUsers(error);
    }

    // Exit with error code
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
