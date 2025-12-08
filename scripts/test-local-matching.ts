#!/usr/bin/env node
/**
 * Local Testing Script for Run #34 Fixes
 * Tests the filter fixes with mock jobs from previous runs
 */

import { matchJobsForAllUsers } from '../src/multi-user-matcher.js';
import { logger } from '../src/utils.js';

// ✅ RUN #35: Mock jobs including HR and Product roles (previously blocked)
const testJobs = [
  // Hamad (HR) test jobs - Previously blocked by cross-domain filter
  {
    id: 'hr-test-1',
    title: 'HR Specialist - HRIS Systems',
    company: 'Almarai',
    location: 'Riyadh',
    url: 'https://careers.almarai.com/hr-1',
    description: 'Manage Workday HRIS platform, employee data management, digital HR processes, HR systems implementation, and talent analytics...',
    platform: 'Google',
    timestamp: new Date().toISOString(),
    score: 0
  },
  {
    id: 'hr-test-2',
    title: 'HR Business Partner - Digital Transformation',
    company: 'STC',
    location: 'Riyadh',
    url: 'https://careers.stc.com.sa/hr-2',
    description: 'Partner with business leaders on digital transformation initiatives, tech recruitment, HRIS optimization, and people analytics...',
    platform: 'Google',
    timestamp: new Date().toISOString(),
    score: 0
  },
  {
    id: 'hr-test-3',
    title: 'Talent Acquisition Specialist - Tech Recruitment',
    company: 'Aramco Digital',
    location: 'Riyadh',
    url: 'https://careers.aramco.com/hr-3',
    description: 'Recruit software engineers, data scientists, and technology professionals. Manage applicant tracking systems and recruitment technology...',
    platform: 'Google',
    timestamp: new Date().toISOString(),
    score: 0
  },

  // Saud (Product/Marketing) test jobs - Previously blocked by cross-domain filter
  {
    id: 'product-test-1',
    title: 'Product Manager - Software Products',
    company: 'Aramco Digital',
    location: 'Riyadh',
    url: 'https://careers.aramco.com/pm-1',
    description: 'Lead product strategy for software solutions, work with engineering teams, define product roadmap, and manage technology products...',
    platform: 'Google',
    timestamp: new Date().toISOString(),
    score: 0
  },
  {
    id: 'product-test-2',
    title: 'Brand Manager - Digital Marketing',
    company: 'SABIC',
    location: 'Riyadh',
    url: 'https://careers.sabic.com/brand-1',
    description: 'Develop digital brand strategy, manage marketing campaigns, analytics, SEO optimization, and brand positioning in digital channels...',
    platform: 'Google',
    timestamp: new Date().toISOString(),
    score: 0
  },
  {
    id: 'product-test-3',
    title: 'Product Specialist - Technology Solutions',
    company: 'Mobily',
    location: 'Riyadh',
    url: 'https://careers.mobily.com/ps-1',
    description: 'Manage technology product portfolio, work with software development teams, product analytics, and technology solutions...',
    platform: 'Google',
    timestamp: new Date().toISOString(),
    score: 0
  },

  // Hadi (AI/ML) test jobs - Should still pass
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
  logger.info('🧪 RUN #35 LOCAL TESTING: Emergency Fix + Innovation Validation');
  logger.info('='.repeat(80));
  logger.info('');
  logger.info('📋 TEST SUMMARY:');
  logger.info('   - Cross-domain filter: ✅ DISABLED (trust Google CSE + scoring)');
  logger.info('   - Threshold: ✅ 40% (down from 50%, with dynamic adjustment)');
  logger.info('   - Fuzzy matching: ✅ ENABLED (Levenshtein distance 70%+)');
  logger.info('   - Skill synonyms: ✅ ENABLED (50+ skill variations)');
  logger.info('   - Dynamic threshold: ✅ ENABLED (prevents zero jobs)');
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
        const passed = (job.score || 0) >= 40;
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
          logger.info(`      ⚠️  BLOCKED: Score ${job.score}% < 40% threshold`);
        } else {
          logger.info(`      ✅ PASSED: Score ${job.score}% ≥ 40% threshold`);
        }
        logger.info('');
      });
    });

    logger.info('━'.repeat(80));
    logger.info('📊 FINAL SUMMARY:');
    logger.info('━'.repeat(80));
    logger.info(`📈 Total jobs processed: ${testJobs.length}`);
    logger.info(`🎯 Total matched to users: ${totalMatched} jobs`);
    logger.info(`✅ Passed threshold (≥40%): ${totalPassed} jobs`);
    logger.info(`❌ Blocked (<40%): ${totalBlocked} jobs`);
    logger.info(`📊 Pass rate: ${totalMatched > 0 ? ((totalPassed / totalMatched) * 100).toFixed(1) : 0}%`);
    logger.info('');

    // Expected behavior validation
    logger.info('🔍 EXPECTED BEHAVIOR VALIDATION (RUN #35):');
    logger.info('');
    logger.info('✅ SHOULD PASS FOR HAMAD (HR):');
    logger.info('   - "HR Specialist - HRIS Systems" (50-60%+) - Modern HR with HRIS, systems keywords');
    logger.info('   - "HR Business Partner - Digital Transformation" (50-60%+) - HR + digital transformation');
    logger.info('   - "Talent Acquisition Specialist - Tech Recruitment" (50-60%+) - HR recruitment role');
    logger.info('');
    logger.info('✅ SHOULD PASS FOR SAUD (Product/Marketing):');
    logger.info('   - "Product Manager - Software Products" (50-65%+) - Product management + technology');
    logger.info('   - "Brand Manager - Digital Marketing" (50-60%+) - Brand + digital marketing');
    logger.info('   - "Product Specialist - Technology Solutions" (50-60%+) - Product + technology');
    logger.info('');
    logger.info('✅ SHOULD PASS FOR HADI (AI/ML):');
    logger.info('   - "Technology & Engineering Jobs" (60-70%+) - Good AI/ML match');
    logger.info('   - "Digital Transformation Consultant" (60-70%+) - AI solutions, digital strategies');
    logger.info('   - "AI Engineer - Saudi Aramco" (70-80%+) - Perfect AI/ML match');
    logger.info('   - "Software Engineer - Machine Learning" (65-75%+) - Good ML match');
    logger.info('');
    logger.info('⚠️  BORDERLINE (may pass or fail):');
    logger.info('   - "MoneyGram Engineering" (40-55%) - Generic but engineering-related');
    logger.info('   - "Assistant Manager Marketing Operations" (40-50%) - Marketing operations (may match Saud)');
    logger.info('   - "Product Manager - Tech Innovation" (50-60%) - Generic product role');
    logger.info('');
    logger.info('🎯 KEY SUCCESS CRITERIA:');
    logger.info('   ✅ Hamad should get 3+ jobs (was 0 in Run #34)');
    logger.info('   ✅ Saud should get 3+ jobs (was 1 in Run #34)');
    logger.info('   ✅ Hadi should get 5+ jobs (was 5 in Run #34)');
    logger.info('   ✅ No user should get zero jobs (dynamic threshold prevents this)');
    logger.info('');
    logger.info('='.repeat(80));
    logger.info('✅ Test completed successfully!');
    logger.info('');
    logger.info('Next steps:');
    logger.info('1. Review the results above - verify all users get jobs');
    logger.info('2. Check that HR/Product jobs are no longer blocked');
    logger.info('3. If results look good, commit and push RUN #35 changes');
    logger.info('4. Monitor Run #35 in production');
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
