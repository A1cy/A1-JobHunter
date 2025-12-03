#!/usr/bin/env tsx
/**
 * A1 Job Hunter - Automated Daily Job Search
 *
 * Runs daily at 9:00 AM Saudi time to find matching tech jobs in Riyadh
 * Uses AI-powered matching with Claude and delivers results via Telegram
 */

import { config } from 'dotenv';
import { writeFile, mkdir } from 'fs/promises';
import { resolve } from 'path';
import { adaptiveScan, scanAllPlatforms } from './scrapers/index.js';
import { matchJobs } from './ai-matcher.js';
import { sendToTelegram, sendErrorNotification } from './telegram.js';
import { logger } from './utils.js';

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
    // Step 1: Scrape job platforms
    logger.info('📡 Step 1: Scraping job platforms...');

    let jobs;
    const mode = process.env.MODE || 'adaptive';

    switch (mode) {
      case 'quick':
        jobs = await scanAllPlatforms('quick');
        break;
      case 'deep':
        jobs = await scanAllPlatforms('deep');
        break;
      case 'adaptive':
      default:
        jobs = await adaptiveScan(10); // Target minimum 10 jobs
        break;
    }

    logger.info(`✅ Found ${jobs.length} jobs from ${new Set(jobs.map(j => j.platform)).size} platforms`);

    if (jobs.length === 0) {
      logger.warn('⚠️ No jobs found. Notifying user...');

      await sendToTelegram([]);

      logger.info('✅ Job hunt complete (no results)');
      return;
    }

    // Step 2: AI matching and scoring
    logger.info('🧠 Step 2: AI matching with Claude...');

    const matchedJobs = await matchJobs(jobs);

    logger.info(`✅ ${matchedJobs.length} jobs matched criteria (${Math.round((matchedJobs.length / jobs.length) * 100)}% pass rate)`);

    if (matchedJobs.length === 0) {
      logger.warn('⚠️ No jobs passed matching threshold');

      await sendToTelegram([]);

      logger.info('✅ Job hunt complete (no matches)');
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
