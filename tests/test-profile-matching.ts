/**
 * Test Profile-Specific Matching
 *
 * This test demonstrates that each user receives ONLY jobs matching
 * their specific domain (HR, IT, Product) without cross-contamination.
 */

import { KeywordJobMatcher } from '../src/keyword-matcher.js';
import { Job } from '../src/utils.js';

// Mock profiles
const hadiProfile = {
  name: 'Abdulhadi Alturafi',
  location: 'Riyadh, Saudi Arabia',
  target_roles: ['AI Engineer', 'Full Stack Developer', 'Digital Transformation Specialist'],
  skills: {
    primary: ['Artificial Intelligence', 'Machine Learning', 'Full Stack Development'],
    technologies: ['Python', 'JavaScript', 'React', 'TensorFlow']
  },
  min_experience_match: 0.6,
  languages: ['English', 'Arabic']
};

const hamadProfile = {
  name: 'Hamad AlTuwaijri',
  location: 'Riyadh, Saudi Arabia',
  target_roles: ['HR Specialist', 'HR Generalist', 'Organization Development Specialist'],
  skills: {
    primary: ['Human Resources Management', 'Organization Development', 'Employee Relations'],
    technologies: ['HRIS Systems', 'Workday', 'SAP SuccessFactors']
  },
  min_experience_match: 0.5,
  languages: ['Arabic', 'English']
};

// Mock jobs from different domains
const testJobs: Job[] = [
  {
    id: '1',
    title: 'AI Engineer',
    company: 'Tech Company',
    location: 'Riyadh',
    url: 'https://example.com/1',
    description: 'Looking for AI Engineer with Python and TensorFlow experience',
    platform: 'Test',
    score: 0
  },
  {
    id: '2',
    title: 'HR Specialist',
    company: 'HR Firm',
    location: 'Riyadh',
    url: 'https://example.com/2',
    description: 'HR Specialist needed with HRIS Systems and employee relations experience',
    platform: 'Test',
    score: 0
  },
  {
    id: '3',
    title: 'Software Developer',
    company: 'IT Company',
    location: 'Riyadh',
    url: 'https://example.com/3',
    description: 'Software Developer with JavaScript and React',
    platform: 'Test',
    score: 0
  },
  {
    id: '4',
    title: 'HR Business Partner',
    company: 'Corporate HR',
    location: 'Riyadh',
    url: 'https://example.com/4',
    description: 'HR Business Partner with organization development and Workday experience',
    platform: 'Test',
    score: 0
  }
];

// Test Hadi's matching (should get IT jobs only)
console.log('=== Testing Hadi (IT Profile) ===');
const hadiMatcher = new KeywordJobMatcher(hadiProfile);
const hadiResults = hadiMatcher.scoreJobs(testJobs);
const hadiMatches = hadiResults.filter(j => j.score && j.score > 0);

console.log(`Hadi matched ${hadiMatches.length} jobs:`);
hadiMatches.forEach(job => {
  console.log(`  - ${job.title} (${job.score}%): ${job.matchReasons?.join(', ')}`);
});

// Test Hamad's matching (should get HR jobs only)
console.log('\n=== Testing Hamad (HR Profile) ===');
const hamadMatcher = new KeywordJobMatcher(hamadProfile);
const hamadResults = hamadMatcher.scoreJobs(testJobs);
const hamadMatches = hamadResults.filter(j => j.score && j.score > 0);

console.log(`Hamad matched ${hamadMatches.length} jobs:`);
hamadMatches.forEach(job => {
  console.log(`  - ${job.title} (${job.score}%): ${job.matchReasons?.join(', ')}`);
});

// Verify no cross-contamination
console.log('\n=== Verification ===');
const hadiGotHR = hadiMatches.some(j => j.title.toLowerCase().includes('hr'));
const hamadGotIT = hamadMatches.some(j =>
  j.title.toLowerCase().includes('software') ||
  j.title.toLowerCase().includes('developer') ||
  j.title.toLowerCase().includes('ai')
);

if (hadiGotHR) {
  console.log('❌ FAILED: Hadi (IT profile) received HR jobs!');
} else {
  console.log('✅ PASSED: Hadi only received IT jobs');
}

if (hamadGotIT) {
  console.log('❌ FAILED: Hamad (HR profile) received IT jobs!');
} else {
  console.log('✅ PASSED: Hamad only received HR jobs');
}

console.log('\n=== Minimum Title Match Filter ===');
console.log('Jobs with score=0 were rejected due to poor title match:');
const rejected = hamadResults.filter(j => j.score === 0);
rejected.forEach(job => {
  console.log(`  - ${job.title}: ${job.matchReasons?.[0]}`);
});
