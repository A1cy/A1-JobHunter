/**
 * Comprehensive Test: All Users Receive ONLY Their Correct Jobs
 *
 * This test confirms 100% domain isolation:
 * - Hadi (Abdulhadi Alturafi): IT/AI/Digital Transformation jobs ONLY
 * - Hamad (Hamad Altuwayjiri): HR jobs ONLY
 * - Saud (Saud Alrasheed): Product/Marketing jobs ONLY
 */

import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { KeywordJobMatcher } from '../src/keyword-matcher.js';
import { Job } from '../src/utils.js';

// Load actual user profiles
async function loadProfile(username: string) {
  const profilePath = resolve(process.cwd(), `users/${username}/profile.json`);
  const profileData = await readFile(profilePath, 'utf-8');
  return JSON.parse(profileData);
}

// Diverse test jobs from all domains
const testJobs: Job[] = [
  // IT/AI Jobs (for Hadi)
  {
    id: '1',
    title: 'AI Engineer',
    company: 'Tech Innovations',
    location: 'Riyadh',
    url: 'https://example.com/1',
    description: 'Looking for AI Engineer with Python, TensorFlow, and Machine Learning experience. Work on GenAI projects.',
    platform: 'Test',
    score: 0
  },
  {
    id: '2',
    title: 'Full Stack Developer',
    company: 'Software Solutions',
    location: 'Riyadh',
    url: 'https://example.com/2',
    description: 'Full Stack Developer needed with React, Node.js, JavaScript, and TypeScript experience.',
    platform: 'Test',
    score: 0
  },
  {
    id: '3',
    title: 'Digital Transformation Specialist',
    company: 'Digital Corp',
    location: 'Riyadh',
    url: 'https://example.com/3',
    description: 'Digital Transformation Specialist to lead digital transformation initiatives with AWS and Docker.',
    platform: 'Test',
    score: 0
  },

  // HR Jobs (for Hamad)
  {
    id: '4',
    title: 'HR Specialist',
    company: 'HR Firm',
    location: 'Riyadh',
    url: 'https://example.com/4',
    description: 'HR Specialist needed with HRIS Systems, Qiwa, GOSI compliance, and recruitment experience.',
    platform: 'Test',
    score: 0
  },
  {
    id: '5',
    title: 'Recruitment Coordinator',
    company: 'Talent Solutions',
    location: 'Riyadh',
    url: 'https://example.com/5',
    description: 'Recruitment Coordinator for full recruitment cycle, onboarding, and ATS systems.',
    platform: 'Test',
    score: 0
  },
  {
    id: '6',
    title: 'HRIS Analyst',
    company: 'HR Tech Company',
    location: 'Riyadh',
    url: 'https://example.com/6',
    description: 'HRIS Analyst with Workday, SAP SuccessFactors, and HR Analytics experience.',
    platform: 'Test',
    score: 0
  },

  // Product/Marketing Jobs (for Saud)
  {
    id: '7',
    title: 'Product Manager',
    company: 'E-commerce Company',
    location: 'Riyadh',
    url: 'https://example.com/7',
    description: 'Product Manager with product management, brand strategy, and market research skills.',
    platform: 'Test',
    score: 0
  },
  {
    id: '8',
    title: 'Brand Manager',
    company: 'Marketing Agency',
    location: 'Riyadh',
    url: 'https://example.com/8',
    description: 'Brand Manager for digital marketing, SEO/PPC, Google Ads, and social media marketing.',
    platform: 'Test',
    score: 0
  },
  {
    id: '9',
    title: 'Business Development Consultant',
    company: 'Consulting Firm',
    location: 'Riyadh',
    url: 'https://example.com/9',
    description: 'Business Development Consultant with e-commerce and HubSpot experience.',
    platform: 'Test',
    score: 0
  },

  // Mixed/Ambiguous Jobs (should be filtered by title match)
  {
    id: '10',
    title: 'Software Developer',
    company: 'Tech Startup',
    location: 'Riyadh',
    url: 'https://example.com/10',
    description: 'Software Developer with JavaScript, React, and Microsoft Excel skills.',
    platform: 'Test',
    score: 0
  }
];

async function runTest() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  COMPREHENSIVE USER MATCHING TEST');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Test Hadi (IT/AI Profile)
  console.log('👤 USER 1: Abdulhadi Alturafi (IT/AI/Digital Transformation)');
  console.log('───────────────────────────────────────────────────────────');
  const hadiProfile = await loadProfile('hadi');
  const hadiMatcher = new KeywordJobMatcher(hadiProfile);
  const hadiResults = hadiMatcher.scoreJobs(testJobs);
  const hadiMatches = hadiResults.filter(j => j.score && j.score > 0);

  console.log(`Target Roles: ${hadiProfile.target_roles.slice(0, 3).join(', ')}...`);
  console.log(`Matched Jobs: ${hadiMatches.length}\n`);

  hadiMatches.forEach(job => {
    console.log(`  ✅ ${job.title} (${job.score}%)`);
    console.log(`     Company: ${job.company}`);
    console.log(`     Reason: ${job.matchReasons?.[0]}\n`);
  });

  // Test Hamad (HR Profile)
  console.log('👤 USER 2: Hamad Altuwayjiri (Human Resources)');
  console.log('───────────────────────────────────────────────────────────');
  const hamadProfile = await loadProfile('hamad');
  const hamadMatcher = new KeywordJobMatcher(hamadProfile);
  const hamadResults = hamadMatcher.scoreJobs(testJobs);
  const hamadMatches = hamadResults.filter(j => j.score && j.score > 0);

  console.log(`Target Roles: ${hamadProfile.target_roles.slice(0, 3).join(', ')}...`);
  console.log(`Matched Jobs: ${hamadMatches.length}\n`);

  hamadMatches.forEach(job => {
    console.log(`  ✅ ${job.title} (${job.score}%)`);
    console.log(`     Company: ${job.company}`);
    console.log(`     Reason: ${job.matchReasons?.[0]}\n`);
  });

  // Test Saud (Product/Marketing Profile)
  console.log('👤 USER 3: Saud Alrasheed (Product Management/Marketing)');
  console.log('───────────────────────────────────────────────────────────');
  const saudProfile = await loadProfile('saud');
  const saudMatcher = new KeywordJobMatcher(saudProfile);
  const saudResults = saudMatcher.scoreJobs(testJobs);
  const saudMatches = saudResults.filter(j => j.score && j.score > 0);

  console.log(`Target Roles: ${saudProfile.target_roles.slice(0, 3).join(', ')}...`);
  console.log(`Matched Jobs: ${saudMatches.length}\n`);

  saudMatches.forEach(job => {
    console.log(`  ✅ ${job.title} (${job.score}%)`);
    console.log(`     Company: ${job.company}`);
    console.log(`     Reason: ${job.matchReasons?.[0]}\n`);
  });

  // Verification: Check for cross-contamination
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  CROSS-CONTAMINATION CHECK');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Hadi should NOT get HR or Marketing jobs
  const hadiGotHR = hadiMatches.some(j =>
    j.title.toLowerCase().includes('hr') ||
    j.title.toLowerCase().includes('recruitment') ||
    j.title.toLowerCase().includes('payroll')
  );
  const hadiGotMarketing = hadiMatches.some(j =>
    j.title.toLowerCase().includes('product') ||
    j.title.toLowerCase().includes('brand') ||
    j.title.toLowerCase().includes('marketing')
  );

  // Hamad should NOT get IT or Marketing jobs
  const hamadGotIT = hamadMatches.some(j =>
    j.title.toLowerCase().includes('software') ||
    j.title.toLowerCase().includes('developer') ||
    j.title.toLowerCase().includes('ai') ||
    j.title.toLowerCase().includes('engineer') && !j.title.toLowerCase().includes('hr')
  );
  const hamadGotMarketing = hamadMatches.some(j =>
    j.title.toLowerCase().includes('product') ||
    j.title.toLowerCase().includes('brand') ||
    j.title.toLowerCase().includes('marketing')
  );

  // Saud should NOT get IT or HR jobs
  const saudGotIT = saudMatches.some(j =>
    j.title.toLowerCase().includes('software') ||
    j.title.toLowerCase().includes('developer') ||
    j.title.toLowerCase().includes('ai')
  );
  const saudGotHR = saudMatches.some(j =>
    j.title.toLowerCase().includes('hr') ||
    j.title.toLowerCase().includes('recruitment') ||
    j.title.toLowerCase().includes('payroll')
  );

  // Results
  let allPassed = true;

  console.log('Hadi (IT/AI Profile):');
  if (hadiGotHR || hadiGotMarketing) {
    console.log('  ❌ FAILED: Received HR or Marketing jobs!');
    allPassed = false;
  } else {
    console.log('  ✅ PASSED: Only received IT/AI jobs');
  }

  console.log('\nHamad (HR Profile):');
  if (hamadGotIT || hamadGotMarketing) {
    console.log('  ❌ FAILED: Received IT or Marketing jobs!');
    allPassed = false;
  } else {
    console.log('  ✅ PASSED: Only received HR jobs');
  }

  console.log('\nSaud (Product/Marketing Profile):');
  if (saudGotIT || saudGotHR) {
    console.log('  ❌ FAILED: Received IT or HR jobs!');
    allPassed = false;
  } else {
    console.log('  ✅ PASSED: Only received Product/Marketing jobs');
  }

  // Show rejected jobs
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  REJECTED JOBS (Title Filter)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const allRejected = [
    ...hadiResults.filter(j => j.score === 0),
    ...hamadResults.filter(j => j.score === 0),
    ...saudResults.filter(j => j.score === 0)
  ];

  // Get unique rejected jobs
  const uniqueRejected = Array.from(new Set(allRejected.map(j => j.id)))
    .map(id => allRejected.find(j => j.id === id))
    .filter(Boolean);

  uniqueRejected.forEach(job => {
    console.log(`  🚫 ${job!.title} - "${job!.matchReasons?.[0]}"`);
  });

  // Final result
  console.log('\n═══════════════════════════════════════════════════════════');
  if (allPassed) {
    console.log('  ✅✅✅ ALL TESTS PASSED! ✅✅✅');
    console.log('  Each user receives ONLY their domain-specific jobs!');
  } else {
    console.log('  ❌ SOME TESTS FAILED - Cross-contamination detected!');
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  return allPassed;
}

runTest().then(passed => {
  process.exit(passed ? 0 : 1);
}).catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});
