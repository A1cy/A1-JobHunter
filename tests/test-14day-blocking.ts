import { JobCache } from '../src/job-cache.js';
import { Job } from '../src/utils.js';

async function test14DayBlocking() {
  const cache = new JobCache();
  await cache.load();

  // Mock job
  const testJob: Job = {
    id: '1',
    url: 'https://example.com/test-job',
    title: 'AI Engineer',
    company: 'TechCorp',
    location: 'Riyadh',
    platform: 'Test'
  };

  // Mark job as shown to user 'hadi'
  cache.markAsShown(testJob, 'hadi');

  // TEST 1: Job should be blocked (same day)
  const isBlocked = cache.wasShownRecently(testJob, 'hadi', 14);
  console.assert(isBlocked === true, '❌ Job should be blocked within 14 days');
  console.log('✅ Job correctly blocked within 14 days');

  // TEST 2: Filter should remove it
  const jobs = [testJob];
  const filtered = cache.filterRecentlyShown(jobs, 'hadi', 14);
  console.assert(filtered.length === 0, '❌ Filter should remove shown jobs');
  console.log('✅ Filter correctly removes recently shown jobs');

  // TEST 3: Different user should still see it
  const filteredForSaud = cache.filterRecentlyShown(jobs, 'saud', 14);
  console.assert(filteredForSaud.length === 1, '❌ Other users should still see job');
  console.log('✅ Other users can still see the job');

  await cache.save();
  console.log('\n✅ All 14-day blocking tests passed!');
}

test14DayBlocking();
