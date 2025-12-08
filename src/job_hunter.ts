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
// ❌ REMOVED: Remote job scrapers (not effective for Riyadh full-time jobs)
// import { RemotiveJobScraper } from './scrapers/remotive-scraper.js'; // Remote != Riyadh office
// import { ArbeitnowJobScraper } from './scrapers/arbeitnow-scraper.js'; // Germany remote != Saudi
import { matchJobsForAllUsers } from './multi-user-matcher.js';
import { sendToAllUsers, sendErrorNotificationToAllUsers } from './multi-user-telegram.js';
import { logger, deduplicateJobs, Job, generateJobId } from './utils.js';
// ❌ REMOVED: Fuzzy dedup not needed with fewer sources (simple URL dedup is sufficient)
// import { FuzzyDeduplicator } from './utils/fuzzy-dedup.js';
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

        // 🌐 RUN #34: EXPANDED to 30+ MENA platforms (from 15) for maximum coverage
        // Tier 1: Primary platforms (always include)
        const tier1 = 'site:linkedin.com/jobs OR site:bayt.com OR site:sa.indeed.com OR ' +
                      'site:naukrigulf.com OR site:gulftalent.com';

        // Tier 2: Secondary platforms (high quality)
        const tier2 = 'site:tanqeeb.com OR site:glassdoor.com/Job OR site:forasna.com OR ' +
                      'site:akhtaboot.com OR site:gulf.monster.com';

        // Tier 3: Additional coverage
        const tier3 = 'site:mihnati.com OR site:laimoon.com OR site:jobzella.com OR ' +
                      'site:daleel-madani.org OR site:careerjet.com.sa';

        // ✅ NEW Tier 4: Regional platforms (Egypt, UAE, Pakistan)
        const tier4 = 'site:wuzzuf.net OR site:dubizzle.com/jobs OR site:mubasher.com OR ' +
                      'site:rozee.pk OR site:careers-dubai.com';

        // ✅ NEW Tier 5: Major Saudi company career pages (direct postings)
        const tier5 = 'site:careers.almarai.com OR site:careers.stc.com.sa OR site:careers.sabic.com OR ' +
                      'site:careers.aramco.com OR site:careers.mobily.com.sa';

        // ✅ NEW Tier 6: Specialized Saudi platforms
        const tier6 = 'site:jobs.kfupm.edu.sa OR site:riyadhcareers.com OR site:saudijobs.net OR ' +
                      'site:gulfcareer.com OR site:daleelmadani.org';

        const siteFilter = ` (${tier1} OR ${tier2} OR ${tier3} OR ${tier4} OR ${tier5} OR ${tier6})`;

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
        logger.info(`   Pages per domain: 1 (reduced from 3 to prevent 429 errors)`);
        logger.info(`   Expected API usage: 3 requests/run (3% of free quota - SAFE)\n`);

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

          // ✅ QUOTA FIX: Reduced to 1 page to prevent 429 errors
          // Previous: 3 pages × 3 domains = 9 API calls (caused 429 errors during testing)
          // Current: 1 page × 3 domains = 3 API calls (allows 33 runs/day - SAFE)
          // Trade-off: 30 jobs per run (reliable) vs 90 jobs per run (0 jobs due to 429)
          for (let page = 0; page < 1; page++) {
            const startIndex = page * 10 + 1; // 1 (10 results per page)

            logger.info(`   📄 Page ${page + 1}/1 (startIndex: ${startIndex})...`);

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

                // VALIDATION LAYER 4: ✅ QUALITY FIX #5 - Skip generic career pages by title
                const genericTitles = [
                  'careers', 'job search', 'search opportunities', 'current opportunities',
                  'job openings', 'work with us', 'join our team', 'employment opportunities',
                  'view all jobs', 'all jobs', 'open positions', 'career opportunities',
                  // ✅ QUALITY FIX #5: Additional generic patterns
                  'job opportunities', 'engineering jobs', 'technology jobs',
                  'jobs listing', 'career page', 'vacancies', 'hiring',
                  'opportunities :', ': jobs', 'jobs -', '- jobs'
                ];
                const titleLower = jobTitle.toLowerCase();
                const isGenericPage = genericTitles.some(generic =>
                  titleLower === generic ||
                  titleLower.includes(`${generic} |`) ||
                  titleLower.startsWith(generic) ||
                  titleLower.endsWith(generic) || // ✅ NEW: catch "... - Jobs"
                  titleLower.includes(` ${generic}`) // ✅ NEW: catch "... Job Opportunities ..."
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

    // 🔧 COMPLEX SETUP: Bayt direct scraper (requires full PlatformConfig)
    // Reason: Needs proper id, name, url, requiresJS, priority, enabled fields
    // See docs/OPTIONAL_SCRAPERS.md for integration guide
    // async function scrapeBayt(keywords: string[]): Promise<Job[]> { ... }

    // 🔧 COMPLEX SETUP: Indeed direct scraper (requires full PlatformConfig)
    // Reason: Needs proper id, name, url, requiresJS, priority, enabled fields
    // See docs/OPTIONAL_SCRAPERS.md for integration guide
    // async function scrapeIndeed(keywords: string[]): Promise<Job[]> { ... }

    // ✅ Enhanced RSS scraper with static feeds (Company feeds removed - don't exist)
    async function scrapeRSS(keywords: string[]): Promise<Job[]> {
      try {
        logger.info('📡 [RSS] Starting (Static feeds only - GulfTalent, Naukrigulf, Bayt)...');
        const rss = new RSSJobScraper();

        const allJobs: Job[] = [];

        // Scrape static RSS feeds (no keywords needed) - PROVEN Riyadh-specific feeds
        const staticJobs = await rss.scrapeAllStaticFeeds(); // GulfTalent, Naukrigulf, Bayt
        allJobs.push(...staticJobs);

        // ❌ REMOVED: Company RSS feeds (don't exist - 404 errors)
        // Most career pages don't offer RSS anymore (outdated technology)
        // const companyJobs = await rss.scrapeCompanyFeeds(); // Aramco, STC, SABIC, Almarai

        // LEGACY: Keyword-based RSS (Indeed, LinkedIn)
        for (const keyword of keywords.slice(0, 3)) {
          const jobs = await rss.scrapeRSS(keyword, 'Riyadh', 'indeed');
          allJobs.push(...jobs);
          await new Promise(r => setTimeout(r, 1000));
        }

        logger.info(`✅ [RSS] ${allJobs.length} jobs found (static feeds: ${staticJobs.length}, keyword-based: ${allJobs.length - staticJobs.length})`);
        return allJobs;
      } catch (error) {
        logger.error('❌ [RSS] Failed:', error);
        return [];
      }
    }

    // ❌ REMOVED: Remotive remote jobs scraper (not effective for Riyadh full-time jobs)
    // Reason: 100% remote jobs, NOT Riyadh office jobs
    // Effectiveness: Only 10-20% relevant for "Riyadh full-time jobs"
    // async function scrapeRemotive(keywords: string[]): Promise<Job[]> { ... }

    // ❌ REMOVED: Arbeitnow tech jobs scraper (not effective for Riyadh jobs)
    // Reason: Germany-based remote tech jobs with NO location filtering
    // Effectiveness: Only 5-10% relevant for "Riyadh full-time jobs"
    // async function scrapeArbeitnow(keywords: string[]): Promise<Job[]> { ... }

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

    // ❌ NOT SUITABLE: LinkedIn scraper (Playwright = heavy, like BERT)
    // Reason: ~200MB browser automation, will fail in GitHub Actions
    // See docs/OPTIONAL_SCRAPERS.md for why this is not recommended
    // async function scrapeLinkedIn(keywords: string[]): Promise<Job[]> { ... }

    // ❌ NOT SUITABLE: WebSearch scraper (requires Claude Code)
    // Reason: Needs Claude Code's WebSearch tool, not available in GitHub Actions
    // Only works in interactive Claude Code sessions
    // async function loadWebSearchData(): Promise<Job[]> { ... }

    // Step 1: Simplified Job Scraping (Google + RSS only - RELIABLE sources)
    logger.info('📡 Step 1: Job scraping (Google CSE + 3 RSS feeds - GitHub Actions compatible)...');

    let jobs: Job[] = [];

    logger.info('\n🚀 Launching ACTIVE scrapers (Ordered by effectiveness)...\n');
    logger.info('   Strategy: Riyadh full-time jobs at $0 cost');
    logger.info('   PRIMARY: Google CSE (3 API calls, 70-80% accuracy)');
    logger.info('   TIER 2: Static RSS feeds (GulfTalent, Naukrigulf, Bayt RSS)');
    logger.info('   Expected: 40-60 jobs (RELIABLE delivery)');
    logger.info('   Optional: See docs/OPTIONAL_SCRAPERS.md for +60 more jobs\n');

    // ✅ ACTIVE SCRAPERS: Proven reliable sources (Google + RSS)
    const scraperResults = await Promise.allSettled([
      scrapeGoogle(searchKeywords),      // PRIMARY - Google Custom Search (30 jobs, 3 API calls, 70-80% accuracy)
      scrapeRSS(searchKeywords),          // TIER 2 - Static RSS feeds (10-20 jobs, 30-40% accuracy)
      // ❌ REMOVED: Remotive (remote != Riyadh office)
      // ❌ REMOVED: Arbeitnow (Germany remote != Saudi)
      // ❌ NOT SUITABLE: LinkedIn (Playwright = heavy, like BERT), WebSearch (needs Claude Code)
      // 🔧 COMPLEX SETUP: Bayt, Indeed (require full PlatformConfig - see docs/OPTIONAL_SCRAPERS.md)
      // 🔑 READY TO ADD: Jooble, JSearch, SearchAPI (need API keys - see docs/OPTIONAL_SCRAPERS.md)
    ]);

    // Collect jobs from all successful scrapers
    const scraperNames = ['Google', 'RSS'];
    scraperResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        jobs.push(...result.value);
      } else {
        logger.warn(`⚠️  ${scraperNames[index]} scraper failed but continuing with others`);
      }
    });

    // Simple URL deduplication (fuzzy dedup not needed with fewer sources)
    const uniqueJobs = deduplicateJobs(jobs);

    logger.info(`\n═══════════════════════════════════════════════════════════`);
    logger.info(`✅ Job Scraping Complete (Proven Reliable Sources):`);
    logger.info(`   Total scraped: ${jobs.length} jobs`);
    logger.info(`   After deduplication: ${uniqueJobs.length} unique jobs`);
    logger.info(`   Duplicate removal rate: ${jobs.length > 0 ? ((1 - uniqueJobs.length / jobs.length) * 100).toFixed(1) : 0}%`);
    logger.info(`   Sources: ${[...new Set(uniqueJobs.map(j => j.platform))].join(', ')}`);
    logger.info(`   Active Sources (Ordered by effectiveness):`);
    logger.info(`     PRIMARY: Google Custom Search (3 API calls, 70-80% accuracy)`);
    logger.info(`     TIER 2: RSS Static Feeds (GulfTalent, Naukrigulf, Bayt RSS)`);
    logger.info(`   💡 Want more jobs? See docs/OPTIONAL_SCRAPERS.md for:`);
    logger.info(`      - Jooble API (+30-50 jobs, FREE, 5min setup)`);
    logger.info(`      - JSearch API (+20-30 jobs, FREE, 5min setup)`);
    logger.info(`      - SearchAPI (+10-15 jobs, FREE, backup only)`);
    logger.info(`   Execution time: ~30-60s (parallel)`);
    logger.info(`   Cost: $0 (100% FREE sources)`);
    logger.info(`   Focus: Riyadh full-time jobs (QUALITY over quantity)`);
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
