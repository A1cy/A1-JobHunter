#!/usr/bin/env tsx
/**
 * ✅ RUN #36: Test Script for New Scrapers
 *
 * Tests the 3 new scrapers (RSS enhanced, Remotive, Arbeitnow) and fuzzy dedup
 * before deploying to production
 */

import { logger } from '../src/utils.js';
import { RSSJobScraper } from '../src/scrapers/rss-scraper.js';
import { RemotiveJobScraper } from '../src/scrapers/remotive-scraper.js';
import { ArbeitnowJobScraper } from '../src/scrapers/arbeitnow-scraper.js';
import { FuzzyDeduplicator } from '../src/utils/fuzzy-dedup.js';
import { QueryExpander } from '../src/utils/query-expander.js';

async function testEnhancedRSS() {
  logger.info('═'.repeat(80));
  logger.info('🧪 TEST 1: Enhanced RSS Scraper (8+ feeds)');
  logger.info('═'.repeat(80));

  const rss = new RSSJobScraper();

  try {
    // Test static feeds (GulfTalent, Naukrigulf, Bayt)
    logger.info('\n📡 Testing static RSS feeds...');
    const staticJobs = await rss.scrapeAllStaticFeeds();
    logger.info(`✅ Static feeds: ${staticJobs.length} jobs`);
    if (staticJobs.length > 0) {
      logger.info(`📋 Sample job: "${staticJobs[0].title}" at ${staticJobs[0].company}`);
    }

    // Test company feeds (Aramco, STC, SABIC, Almarai)
    logger.info('\n📡 Testing company RSS feeds...');
    const companyJobs = await rss.scrapeCompanyFeeds();
    logger.info(`✅ Company feeds: ${companyJobs.length} jobs`);
    if (companyJobs.length > 0) {
      logger.info(`📋 Sample job: "${companyJobs[0].title}" at ${companyJobs[0].company}`);
    }

    // Test legacy keyword-based (Indeed)
    logger.info('\n📡 Testing keyword-based RSS (Indeed)...');
    const keywordJobs = await rss.scrapeRSS('software engineer', 'Riyadh', 'indeed');
    logger.info(`✅ Keyword RSS: ${keywordJobs.length} jobs`);

    const totalRSS = staticJobs.length + companyJobs.length + keywordJobs.length;
    logger.info(`\n✅ TEST 1 RESULT: ${totalRSS} total RSS jobs (expected: 20-60)`);

    return totalRSS > 0 ? '✅ PASS' : '❌ FAIL';
  } catch (error) {
    logger.error('❌ TEST 1 FAILED:', error);
    return '❌ FAIL';
  }
}

async function testRemotive() {
  logger.info('\n' + '═'.repeat(80));
  logger.info('🧪 TEST 2: Remotive API Scraper (Remote Jobs)');
  logger.info('═'.repeat(80));

  const remotive = new RemotiveJobScraper();

  try {
    // Test latest jobs
    logger.info('\n🌐 Testing latest remote jobs...');
    const latestJobs = await remotive.getLatestJobs();
    logger.info(`✅ Latest: ${latestJobs.length} remote jobs`);
    if (latestJobs.length > 0) {
      logger.info(`📋 Sample job: "${latestJobs[0].title}" at ${latestJobs[0].company} (${latestJobs[0].location})`);
    }

    // Test keyword search
    logger.info('\n🔍 Testing keyword search...');
    const searchJobs = await remotive.searchJobs('software engineer');
    logger.info(`✅ Search: ${searchJobs.length} matching jobs`);

    logger.info(`\n✅ TEST 2 RESULT: ${latestJobs.length + searchJobs.length} total Remotive jobs (expected: 20-50)`);

    return latestJobs.length > 0 ? '✅ PASS' : '❌ FAIL';
  } catch (error) {
    logger.error('❌ TEST 2 FAILED:', error);
    return '❌ FAIL';
  }
}

async function testArbeitnow() {
  logger.info('\n' + '═'.repeat(80));
  logger.info('🧪 TEST 3: Arbeitnow API Scraper (Tech Jobs)');
  logger.info('═'.repeat(80));

  const arbeitnow = new ArbeitnowJobScraper();

  try {
    // Test latest jobs
    logger.info('\n💼 Testing latest tech jobs...');
    const latestJobs = await arbeitnow.getLatestJobs();
    logger.info(`✅ Latest: ${latestJobs.length} tech jobs`);
    if (latestJobs.length > 0) {
      logger.info(`📋 Sample job: "${latestJobs[0].title}" at ${latestJobs[0].company}`);
    }

    // Test keyword search
    logger.info('\n🔍 Testing keyword search...');
    const searchJobs = await arbeitnow.searchJobs('python');
    logger.info(`✅ Search: ${searchJobs.length} matching jobs`);

    logger.info(`\n✅ TEST 3 RESULT: ${latestJobs.length + searchJobs.length} total Arbeitnow jobs (expected: 10-50)`);

    return latestJobs.length > 0 ? '✅ PASS' : '❌ FAIL';
  } catch (error) {
    logger.error('❌ TEST 3 FAILED:', error);
    return '❌ FAIL';
  }
}

async function testFuzzyDedup() {
  logger.info('\n' + '═'.repeat(80));
  logger.info('🧪 TEST 4: Fuzzy Deduplication (Levenshtein)');
  logger.info('═'.repeat(80));

  const dedup = new FuzzyDeduplicator();

  // Create test jobs with variations
  const testJobs = [
    {
      id: '1',
      title: 'Senior Software Engineer',
      company: 'Saudi Aramco',
      location: 'Riyadh',
      url: 'https://careers.aramco.com/job1',
      platform: 'Test'
    },
    {
      id: '2',
      title: 'Sr Software Engineer', // Similar to #1 (85%+)
      company: 'Aramco',
      location: 'Riyadh',
      url: 'https://careers.aramco.com/job2',
      platform: 'Test'
    },
    {
      id: '3',
      title: 'Machine Learning Engineer',
      company: 'STC',
      location: 'Riyadh',
      url: 'https://careers.stc.com.sa/job3',
      platform: 'Test'
    },
    {
      id: '4',
      title: 'ML Engineer', // Similar to #3 (may match)
      company: 'STC',
      location: 'Riyadh',
      url: 'https://careers.stc.com.sa/job4',
      platform: 'Test'
    },
    {
      id: '5',
      title: 'Product Manager',
      company: 'Almarai',
      location: 'Riyadh',
      url: 'https://careers.almarai.com/job5',
      platform: 'Test'
    }
  ];

  try {
    logger.info(`\n🔍 Testing fuzzy deduplication on ${testJobs.length} jobs...`);
    const unique = dedup.deduplicate(testJobs as any);
    const removed = testJobs.length - unique.length;

    logger.info(`📊 Results:`);
    logger.info(`   Input: ${testJobs.length} jobs`);
    logger.info(`   Output: ${unique.length} unique jobs`);
    logger.info(`   Removed: ${removed} duplicates`);

    logger.info(`\n✅ TEST 4 RESULT: Fuzzy dedup working (expected: 3-4 unique jobs from 5 input)`);

    return removed > 0 ? '✅ PASS' : '⚠️  WARNING (no duplicates found, check threshold)';
  } catch (error) {
    logger.error('❌ TEST 4 FAILED:', error);
    return '❌ FAIL';
  }
}

async function testQueryExpander() {
  logger.info('\n' + '═'.repeat(80));
  logger.info('🧪 TEST 5: Query Expansion (Synonyms)');
  logger.info('═'.repeat(80));

  const expander = new QueryExpander();

  try {
    // Test skill expansion
    const reactVariations = expander.expandQuery('react developer');
    logger.info(`\n📊 "react developer" expanded to ${reactVariations.length} variations:`);
    reactVariations.forEach((v, i) => logger.info(`   ${i + 1}. "${v}"`));

    // Test role expansion
    const pmVariations = expander.expandQuery('product manager');
    logger.info(`\n📊 "product manager" expanded to ${pmVariations.length} variations:`);
    pmVariations.forEach((v, i) => logger.info(`   ${i + 1}. "${v}"`));

    // Test synonym lookup
    const mlSynonyms = expander.getSkillSynonyms('ml');
    logger.info(`\n📊 "ml" skill synonyms (${mlSynonyms.length}):`);
    logger.info(`   ${mlSynonyms.join(', ')}`);

    logger.info(`\n✅ TEST 5 RESULT: Query expansion working (expected: 2-3 variations per query)`);

    return reactVariations.length >= 2 ? '✅ PASS' : '❌ FAIL';
  } catch (error) {
    logger.error('❌ TEST 5 FAILED:', error);
    return '❌ FAIL';
  }
}

// Main test runner
async function runAllTests() {
  logger.info('🚀 RUN #36: Starting scraper tests...\n');

  const results = {
    'Enhanced RSS': await testEnhancedRSS(),
    'Remotive API': await testRemotive(),
    'Arbeitnow API': await testArbeitnow(),
    'Fuzzy Dedup': await testFuzzyDedup(),
    'Query Expansion': await testQueryExpander()
  };

  // Summary
  logger.info('\n' + '═'.repeat(80));
  logger.info('📊 RUN #36 TEST SUMMARY');
  logger.info('═'.repeat(80));

  let passed = 0;
  let failed = 0;

  for (const [name, result] of Object.entries(results)) {
    logger.info(`${result} ${name}`);
    if (result.includes('PASS')) passed++;
    else failed++;
  }

  logger.info(`\n📈 Results: ${passed}/${Object.keys(results).length} tests passed`);

  if (failed === 0) {
    logger.info('\n✅ ALL TESTS PASSED - Ready for production!');
    logger.info('Next steps:');
    logger.info('1. Commit changes: git add . && git commit -m "feat: RUN #36 - Add 3 free scrapers + fuzzy dedup"');
    logger.info('2. Push to GitHub: git push');
    logger.info('3. Monitor GitHub Actions run');
    logger.info('4. Check Telegram for job notifications');
  } else {
    logger.info(`\n⚠️  ${failed} TEST(S) FAILED - Fix issues before deploying`);
  }

  logger.info('═'.repeat(80));
}

// Run tests
runAllTests().catch(err => {
  logger.error('Fatal error:', err);
  process.exit(1);
});
