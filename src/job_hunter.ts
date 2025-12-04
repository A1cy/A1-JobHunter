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
import { JoobleJobScraper } from './scrapers/jooble-scraper.js';
import { JSearchJobScraper } from './scrapers/jsearch-scraper.js';
import { SearchAPIJobScraper } from './scrapers/searchapi-scraper.js';
import { matchJobsForAllUsers } from './multi-user-matcher.js';
import { sendToAllUsers, sendErrorNotificationToAllUsers, setupCallbackHandlers } from './multi-user-telegram.js';
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

  // Initialize Telegram bot with callback handlers
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken) {
    const bot = new Telegraf(botToken);
    setupCallbackHandlers(bot);
    bot.launch().then(() => {
      logger.info('✅ Telegram bot initialized with callback handlers');
    }).catch((error) => {
      logger.warn('⚠️  Failed to launch Telegram bot:', error);
    });

    // Graceful shutdown
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  }

  logger.info('🚀 A1 Job Hunter starting...');
  logger.info(`Mode: ${process.env.MODE || 'adaptive'}`);
  logger.info(`Date: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })}`);

  try {
    // Step 1: Hybrid 4-Tier Job Scraping with FREE APIs
    logger.info('📡 Step 1: Hybrid job scraping (4-tier API approach)...');

    let jobs: Job[] = [];

    // ═══════════════════════════════════════════════════════════
    // TIER 1: JOOBLE API (Primary - Best Quality)
    // ═══════════════════════════════════════════════════════════
    logger.info('📡 Tier 1: Jooble API (Primary Source)...');

    const joobleKeywords = [
      'Digital Transformation Specialist',
      'AI Engineer',
      'ML Engineer',
      'GenAI Developer',
      'Full Stack Developer',
      'Software Engineer'
    ];

    const jooble = new JoobleJobScraper();
    const joobleJobs = await jooble.searchMultipleKeywords(joobleKeywords, 'Riyadh');
    jobs.push(...joobleJobs);

    logger.info(`📊 Tier 1 Complete: ${jobs.length} jobs from Jooble API`);

    // ═══════════════════════════════════════════════════════════
    // TIER 2: JSEARCH API (Secondary - Google Jobs)
    // ═══════════════════════════════════════════════════════════
    if (jobs.length < 10) {
      logger.info('🔍 Tier 2: JSearch API (Google Jobs)...');
      logger.warn(`Only ${jobs.length} jobs from Jooble, trying JSearch...`);

      try {
        const jsearch = new JSearchJobScraper();
        const jsearchJobs = await jsearch.searchJobs(
          'Software Engineer OR Full Stack OR AI Engineer OR Digital Transformation',
          'Riyadh, Saudi Arabia'
        );
        jobs.push(...jsearchJobs);

        logger.info(`📊 Tier 2 Complete: ${jobs.length} total jobs`);
      } catch (error) {
        logger.error('❌ JSearch failed:', error);
        logger.info('💡 Continuing to Tier 3...');
      }
    } else {
      logger.info('✅ Tier 1 sufficient, skipping JSearch');
    }

    // ═══════════════════════════════════════════════════════════
    // TIER 3: WEBSEARCH (Existing Pregenerated Data)
    // ═══════════════════════════════════════════════════════════
    if (jobs.length < 15) {
      logger.info('📂 Tier 3: WebSearch Pregenerated Data...');
      logger.warn(`Only ${jobs.length} jobs so far, loading WebSearch results...`);

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
      logger.info('✅ Tiers 1+2 sufficient, skipping WebSearch');
    }

    // ═══════════════════════════════════════════════════════════
    // TIER 4: SEARCHAPI (Emergency Backup - Rare Use)
    // ═══════════════════════════════════════════════════════════
    if (jobs.length < 20) {
      logger.info('🚨 Tier 4: SearchAPI Emergency Backup...');
      logger.warn(`Only ${jobs.length} jobs, triggering emergency backup...`);

      try {
        const searchapi = new SearchAPIJobScraper();
        const searchapiJobs = await searchapi.searchJobs(
          'software developer OR engineer',
          'Riyadh Saudi Arabia'
        );
        jobs.push(...searchapiJobs);

        logger.info(`📊 Tier 4 Complete: ${jobs.length} total jobs`);
      } catch (error) {
        logger.error('❌ SearchAPI failed:', error);
        logger.info('💡 Continuing with existing jobs...');
      }
    } else {
      logger.info('✅ Tiers 1-3 sufficient, skipping emergency backup');
    }

    // Deduplicate across all tiers
    const uniqueJobs = deduplicateJobs(jobs);

    logger.info(`\n═══════════════════════════════════════════════════════════`);
    logger.info(`✅ 4-Tier API Scraping Complete:`);
    logger.info(`   Total scraped: ${jobs.length} jobs`);
    logger.info(`   After deduplication: ${uniqueJobs.length} unique jobs`);
    logger.info(`   Sources: ${[...new Set(uniqueJobs.map(j => j.platform))].join(', ')}`);
    logger.info(`   Cost: $0 (100% FREE APIs)`);
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
