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
import { adaptiveScan, scanAllPlatforms } from './scrapers/index.js';
import { RSSJobScraper } from './scrapers/rss-scraper.js';
import { WebSearchJobScraper } from './scrapers/websearch-scraper.js';
import { matchJobs } from './keyword-matcher.js';
import { sendToTelegram, sendErrorNotification } from './telegram.js';
import { logger, deduplicateJobs, Job } from './utils.js';

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

  logger.info('🚀 A1 Job Hunter starting...');
  logger.info(`Mode: ${process.env.MODE || 'adaptive'}`);
  logger.info(`Date: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })}`);

  try {
    // Step 1: Hybrid 3-Tier Job Scraping
    logger.info('📡 Step 1: Hybrid job scraping (3-tier approach)...');

    let jobs: Job[] = [];
    const mode = process.env.MODE || 'adaptive';

    // ═══════════════════════════════════════════════════════════
    // TIER 1: RSS FEEDS (Fastest, most reliable, bot-friendly)
    // ═══════════════════════════════════════════════════════════
    logger.info('📡 Tier 1: RSS Feed Scraping...');

    const rssScraper = new RSSJobScraper();
    const rssKeywords = ['AI Engineer', 'ML Engineer', 'Machine Learning', 'Digital Transformation', 'Full Stack Developer'];

    for (const keyword of rssKeywords) {
      try {
        const rssJobs = await rssScraper.scrapeRSS(keyword, 'Riyadh', 'indeed');
        jobs.push(...rssJobs);
        logger.info(`  ✓ RSS: "${keyword}" found ${rssJobs.length} jobs`);
      } catch (error) {
        logger.warn(`  ✗ RSS: "${keyword}" failed:`, error);
      }
    }

    logger.info(`📊 Tier 1 Complete: ${jobs.length} jobs from RSS feeds`);

    // ═══════════════════════════════════════════════════════════
    // TIER 2: WEBSEARCH + AI (Unlimited, no rate limits)
    // ═══════════════════════════════════════════════════════════
    if (jobs.length < 5) {
      logger.info('🔍 Tier 2: WebSearch Results (from pre-generated data)...');
      logger.warn(`Only ${jobs.length} jobs from RSS, loading WebSearch results...`);

      try {
        // Check for WebSearch JSON files in data/ directory
        const dataDir = resolve(process.cwd(), 'data');

        if (existsSync(dataDir)) {
          const files = await readdir(dataDir);
          const webSearchFiles = files
            .filter(f => f.startsWith('websearch-jobs-') && f.endsWith('.json'))
            .sort()
            .reverse(); // Get most recent first

          if (webSearchFiles.length > 0) {
            const latestFile = webSearchFiles[0];
            const filePath = resolve(dataDir, latestFile);

            logger.info(`📂 Loading WebSearch data from: ${latestFile}`);

            const fileContent = await readFile(filePath, 'utf-8');
            const webSearchData = JSON.parse(fileContent);

            if (webSearchData.jobs && Array.isArray(webSearchData.jobs)) {
              // Convert WebSearch format to Job format
              const webSearchJobs: Job[] = webSearchData.jobs.map((wsJob: any) => ({
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

              jobs.push(...webSearchJobs);

              logger.info(`✅ Loaded ${webSearchJobs.length} jobs from WebSearch data`);
              logger.info(`📊 File timestamp: ${webSearchData.timestamp}`);
              logger.info(`📈 Total opportunities in file: ${webSearchData.total_jobs_found || 'N/A'}`);
            } else {
              logger.warn('⚠️  WebSearch file has no jobs array');
            }
          } else {
            logger.warn('⚠️  No WebSearch JSON files found in data/');
            logger.info('💡 Run WebSearch manually via Claude Code to generate job data');
          }
        } else {
          logger.warn('⚠️  data/ directory not found');
          logger.info('💡 Create data/ directory and run WebSearch via Claude Code');
        }
      } catch (error) {
        logger.error('❌ Error loading WebSearch data:', error);
        logger.info('💡 Continuing with Tier 3 scraping...');
      }
    } else {
      logger.info('✅ Tier 1 sufficient, skipping WebSearch');
    }

    // ═══════════════════════════════════════════════════════════
    // TIER 3: DIRECT/PROXY SCRAPING (Existing infrastructure)
    // ═══════════════════════════════════════════════════════════
    if (jobs.length < 10) {
      logger.info('🌐 Tier 3: Direct Scraping with Proxy Fallback...');
      logger.warn(`Only ${jobs.length} jobs so far, triggering direct/proxy scraping...`);

      let tier3Jobs: Job[];

      switch (mode) {
        case 'quick':
          tier3Jobs = await scanAllPlatforms('quick');
          break;
        case 'deep':
          tier3Jobs = await scanAllPlatforms('deep');
          break;
        case 'adaptive':
        default:
          const targetRemaining = Math.max(10 - jobs.length, 5); // At least 5 more jobs
          tier3Jobs = await adaptiveScan(targetRemaining);
          break;
      }

      logger.info(`📊 Tier 3 found ${tier3Jobs.length} additional jobs`);
      jobs.push(...tier3Jobs);
    } else {
      logger.info('✅ Tiers 1+2 sufficient, skipping direct scraping');
    }

    // Deduplicate across all tiers
    const uniqueJobs = deduplicateJobs(jobs);

    logger.info(`\n═══════════════════════════════════════════════════════════`);
    logger.info(`✅ Hybrid Scraping Complete:`);
    logger.info(`   Total scraped: ${jobs.length} jobs`);
    logger.info(`   After deduplication: ${uniqueJobs.length} unique jobs`);
    logger.info(`   Platforms: ${[...new Set(uniqueJobs.map(j => j.platform))].join(', ')}`);
    logger.info(`═══════════════════════════════════════════════════════════\n`);

    jobs = uniqueJobs;

    if (jobs.length === 0) {
      logger.warn('⚠️ No jobs found. Notifying user with error details...');

      // sendToTelegram now handles 0 jobs case internally
      await sendToTelegram([]);

      logger.info('✅ Job hunt complete (no results) - User notified');
      return;
    }

    // Step 2: FREE keyword matching
    logger.info('🔍 Step 2: FREE keyword-based matching...');

    const matchedJobs = await matchJobs(jobs);

    logger.info(`✅ ${matchedJobs.length} jobs matched criteria (${Math.round((matchedJobs.length / jobs.length) * 100)}% pass rate)`);

    if (matchedJobs.length === 0) {
      logger.warn('⚠️ No jobs passed matching threshold');

      // sendToTelegram now handles 0 jobs case internally
      await sendToTelegram([]);

      logger.info('✅ Job hunt complete (no matches) - User notified');
      return;
    }

    // Step 3: Sort by relevance (score)
    const sortedJobs = matchedJobs.sort((a, b) => (b.score || 0) - (a.score || 0));

    const avgScore = Math.round(
      sortedJobs.reduce((sum, job) => sum + (job.score || 0), 0) / sortedJobs.length
    );
    const highMatchCount = sortedJobs.filter(job => (job.score || 0) >= 85).length;

    logger.info(`📊 Average match score: ${avgScore}%`);
    logger.info(`🌟 High match (≥85%): ${highMatchCount} jobs`);

    // Step 4: Save results locally
    logger.info('💾 Step 3: Saving results...');

    await saveResults(sortedJobs);

    // Step 5: Send to Telegram
    logger.info('📱 Step 4: Sending to Telegram...');

    await sendToTelegram(sortedJobs);

    // Done!
    const duration = Math.round((Date.now() - startTime) / 1000);

    logger.info(`✅ Job hunt complete! Found ${sortedJobs.length} relevant jobs`);
    logger.info(`⏱️ Total time: ${duration}s`);

    // Summary stats
    logger.info('\n📊 Summary:');
    logger.info(`   Jobs scraped: ${jobs.length}`);
    logger.info(`   Jobs matched: ${matchedJobs.length}`);
    logger.info(`   Avg score: ${avgScore}%`);
    logger.info(`   High matches: ${highMatchCount}`);
    logger.info(`   Platforms: ${[...new Set(jobs.map(j => j.platform))].join(', ')}`);
    logger.info(`   Duration: ${duration}s`);

  } catch (error) {
    logger.error('❌ Job hunt failed:', error);

    // Send error notification to Telegram
    if (error instanceof Error) {
      await sendErrorNotification(error);
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
