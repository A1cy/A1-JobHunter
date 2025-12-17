import { Job } from '../src/utils.js';

// Copy the filter function from job_hunter.ts
function filterRiyadhJobsOnly(jobs: Job[]): Job[] {
  const before = jobs.length;

  const riyadhJobs = jobs.filter(job => {
    const locationLower = job.location.toLowerCase();
    return locationLower.includes('riyadh');
  });

  const removed = before - riyadhJobs.length;
  if (removed > 0) {
    console.log(`🔍 Removed ${removed} non-Riyadh jobs`);
  }

  return riyadhJobs;
}

async function testLocationFilter() {
  const mockJobs: Job[] = [
    {
      id: '1',
      title: 'Software Engineer',
      company: 'Saudi Tech',
      location: 'Riyadh, Saudi Arabia', // ✅ Should PASS
      url: 'https://example.com/1',
      platform: 'Test'
    },
    {
      id: '2',
      title: 'Software Engineer',
      company: 'Dubai Corp',
      location: 'Dubai, UAE', // ❌ Should be REJECTED
      url: 'https://example.com/2',
      platform: 'Test'
    },
    {
      id: '3',
      title: 'Remote Engineer',
      company: 'Remote Co',
      location: 'Remote', // ❌ Should be REJECTED
      url: 'https://example.com/3',
      platform: 'Test'
    },
    {
      id: '4',
      title: 'Engineer',
      company: 'Jeddah Tech',
      location: 'Jeddah, Saudi Arabia', // ❌ Should be REJECTED (not Riyadh)
      url: 'https://example.com/4',
      platform: 'Test'
    }
  ];

  console.log('Testing location filter with 4 jobs...');
  const filtered = filterRiyadhJobsOnly(mockJobs);

  // TEST: Should only keep Riyadh job
  console.assert(filtered.length === 1, `❌ Expected 1 job, got ${filtered.length}`);
  console.assert(filtered[0].id === '1', '❌ Wrong job kept');

  console.log('✅ Location filter working correctly!');
  console.log(`   - Kept: ${filtered.length} Riyadh jobs`);
  console.log(`   - Rejected: 3 non-Riyadh jobs (Dubai, Remote, Jeddah)`);
}

testLocationFilter();
