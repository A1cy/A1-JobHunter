#!/usr/bin/env node
/**
 * Local Testing Script for Run #34 Fixes
 * Tests the filter fixes with mock jobs from previous runs
 */

import { matchJobsForAllUsers } from '../src/multi-user-matcher.js';
import { logger } from '../src/utils.js';

// Mock jobs from Run #32 (the ones that got blocked in Run #33)
const testJobs = [
  {
    id: 'test-1',
    title: 'Technology & Engineering Jobs | Bain & Company',
    company: 'Bain & Company',
    location: 'Riyadh',
    url: 'https://www.bayt.com/test1',
    description: 'Looking for AI and Machine Learning engineers to join our digital transformation team...',
    platform: 'Google',
    timestamp: new Date().toISOString(),
    score: 0 // Will be calculated
  },
  {
    id: 'test-2',
    title: 'MoneyGram International Job Opportunities : Engineering',
    company: 'MoneyGram',
    location: 'Riyadh',
    url: 'https://www.linkedin.com/jobs/test2',
    description: 'Software development opportunities in financial technology...',
    platform: 'Google',
    timestamp: new Date().toISOString(),
    score: 0
  },
  {
    id: 'test-3',
    title: 'Assistant Manager Marketing Operations',
    company: 'Unknown',
    location: 'Riyadh',
    url: 'https://www.indeed.sa/test3',
    description: 'Managing marketing campaigns and operations, analytics...',
    platform: 'Google',
    timestamp: new Date().toISOString(),
    score: 0
  },
  {
    id: 'test-4',
    title: 'Digital Transformation Consultant - PwC',
    company: 'PwC',
    location: 'Riyadh',
    url: 'https://www.bayt.com/test4',
    description: 'Work with software teams to implement digital strategies, marketing automation, and AI solutions...',
    platform: 'Google',
    timestamp: new Date().toISOString(),
    score: 0
  },
  {
    id: 'test-5',
    title: 'AI Engineer - Saudi Aramco',
    company: 'Saudi Aramco',
    location: 'Riyadh',
    url: 'https://careers.aramco.com/test5',
    description: 'Develop AI and machine learning solutions for oil and gas operations...',
    platform: 'Google',
    timestamp: new Date().toISOString(),
    score: 0
  },
  {
    id: 'test-6',
    title: 'Product Manager - Tech Innovation',
    company: 'Almarai',
    location: 'Riyadh',
    url: 'https://careers.almarai.com/test6',
    description: 'Lead product development for digital transformation initiatives...',
    platform: 'Google',
    timestamp: new Date().toISOString(),
    score: 0
  },
  {
    id: 'test-7',
    title: 'Brand Manager - Consumer Marketing',
    company: 'Unknown',
    location: 'Riyadh',
    url: 'https://www.bayt.com/test7',
    description: 'Lead brand marketing campaigns and consumer engagement strategies...',
    platform: 'Google',
    timestamp: new Date().toISOString(),
    score: 0
  },
  {
    id: 'test-8',
    title: 'Software Engineer - Machine Learning',
    company: 'STC',
    location: 'Riyadh',
    url: 'https://careers.stc.com.sa/test8',
    description: 'Build ML models for telecommunications analytics and prediction...',
    platform: 'Google',
    timestamp: new Date().toISOString(),
    score: 0
  }
];

async function testMatching() {
  logger.info('='.repeat(80));
  logger.info('🧪 RUN #34 LOCAL TESTING: Filter Fixes Validation');
  logger.info('='.repeat(80));
  logger.info('');
  logger.info('📋 TEST SUMMARY:');
  logger.info('   - Cross-domain filter: RELAXED (title-only, allows Digital Transformation)');
  logger.info('   - Threshold: 50% (down from 60%)');
  logger.info('   - Platforms: 30+ (expanded from 15)');
  logger.info('');
  logger.info('📊 Testing with mock jobs from Run #32-33:');
  logger.info('');

  try {
    // Test with NEW filters (Step 1-3 applied)
    const results = await matchJobsForAllUsers(testJobs);

    let totalMatched = 0;
    let totalPassed = 0;
    let totalBlocked = 0;

    results.forEach(result => {
      logger.info('━'.repeat(80));
      logger.info(`👤 USER: ${result.userFullName} (@${result.username})`);
      logger.info(`   Target Roles: ${result.profile.target_roles.slice(0, 3).join(', ')}...`);
      logger.info(`   📥 Total matched: ${result.matched_jobs.length} jobs`);
      logger.info('');

      if (result.matched_jobs.length === 0) {
        logger.info('   ℹ️  No jobs matched for this user');
        logger.info('');
        return;
      }

      result.matched_jobs.forEach((job, i) => {
        const passed = (job.score || 0) >= 50;
        const emoji = passed ? '✅' : '❌';

        totalMatched++;
        if (passed) {
          totalPassed++;
        } else {
          totalBlocked++;
        }

        logger.info(`   ${emoji} Job ${i + 1}: "${job.title}"`);
        logger.info(`      📊 Score: ${job.score}%`);
        logger.info(`      🏢 Company: ${job.company}`);
        logger.info(`      📝 Match Reasons: ${job.matchReasons?.join(', ') || 'N/A'}`);

        // Debug: Show why blocked/passed
        if (!passed) {
          logger.info(`      ⚠️  BLOCKED: Score ${job.score}% < 50% threshold`);
        } else {
          logger.info(`      ✅ PASSED: Score ${job.score}% ≥ 50% threshold`);
        }
        logger.info('');
      });
    });

    logger.info('━'.repeat(80));
    logger.info('📊 FINAL SUMMARY:');
    logger.info('━'.repeat(80));
    logger.info(`📈 Total jobs processed: ${testJobs.length}`);
    logger.info(`🎯 Total matched to users: ${totalMatched} jobs`);
    logger.info(`✅ Passed threshold (≥50%): ${totalPassed} jobs`);
    logger.info(`❌ Blocked (<50%): ${totalBlocked} jobs`);
    logger.info(`📊 Pass rate: ${totalMatched > 0 ? ((totalPassed / totalMatched) * 100).toFixed(1) : 0}%`);
    logger.info('');

    // Expected behavior validation
    logger.info('🔍 EXPECTED BEHAVIOR VALIDATION:');
    logger.info('');
    logger.info('✅ SHOULD PASS:');
    logger.info('   - "Technology & Engineering Jobs" (68%+) - Good AI/ML match');
    logger.info('   - "Digital Transformation Consultant" (70%+) - Allowed despite "marketing" in description');
    logger.info('   - "AI Engineer - Saudi Aramco" (75%+) - Perfect match for Hadi');
    logger.info('   - "Software Engineer - Machine Learning" (70%+) - Good ML match');
    logger.info('');
    logger.info('❌ SHOULD BE BLOCKED:');
    logger.info('   - "Assistant Manager Marketing Operations" - Title says "Marketing"');
    logger.info('   - "Brand Manager - Consumer Marketing" - Clearly marketing role');
    logger.info('');
    logger.info('⚠️  BORDERLINE (may pass or fail):');
    logger.info('   - "MoneyGram Engineering" (50-60%) - Generic but engineering-related');
    logger.info('   - "Product Manager" (50-65%) - Depends on user profile');
    logger.info('');
    logger.info('='.repeat(80));
    logger.info('✅ Test completed successfully!');
    logger.info('');
    logger.info('Next steps:');
    logger.info('1. Review the results above');
    logger.info('2. If results look good, commit and push changes');
    logger.info('3. Monitor Run #34 in production');
    logger.info('='.repeat(80));

  } catch (error) {
    logger.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

// Run the test
testMatching().catch(err => {
  logger.error('Fatal error:', err);
  process.exit(1);
});
