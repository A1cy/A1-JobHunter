#!/usr/bin/env tsx
/**
 * WebSearch Job Finder - Manual Job Discovery Script
 *
 * This script uses Google search to find job listings and saves them to JSON.
 * Run this manually in Claude Code when you want fresh job data.
 *
 * Usage:
 *   npm run websearch-jobs
 *   tsx scripts/websearch-job-finder.ts
 *
 * This script is designed to be run in Claude Code where WebSearch tool is available.
 * It cannot run in GitHub Actions because WebSearch is a Claude Code-only tool.
 */

import { writeFile, mkdir } from 'fs/promises';
import { resolve } from 'path';

interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  platform: string;
  postedDate?: Date;
  source: string;
}

const KEYWORDS = [
  'AI Engineer',
  'Machine Learning Engineer',
  'GenAI Developer',
  'Digital Transformation',
  'Full Stack Developer'
];

const LOCATION = 'Riyadh, Saudi Arabia';

/**
 * Generate unique ID for job
 */
function generateJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Parse WebSearch results to extract job URLs
 */
function extractJobUrls(searchResults: any): string[] {
  const urls: string[] = [];

  if (searchResults.links && Array.isArray(searchResults.links)) {
    for (const link of searchResults.links) {
      if (link.url && isJobUrl(link.url)) {
        urls.push(link.url);
      }
    }
  }

  return urls;
}

/**
 * Check if URL is from a job site
 */
function isJobUrl(url: string): boolean {
  const jobSites = [
    'indeed.com',
    'bayt.com',
    'tanqeeb.com',
    'linkedin.com/jobs',
    'glassdoor.com',
    'naukrigulf.com',
    'aurawoo.com',
    'startup.jobs'
  ];

  return jobSites.some(site => url.includes(site));
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 WebSearch Job Finder');
  console.log('========================\n');
  console.log(`Location: ${LOCATION}`);
  console.log(`Keywords: ${KEYWORDS.join(', ')}\n`);

  const allJobs: JobListing[] = [];

  console.log('⚠️  MANUAL STEP REQUIRED:');
  console.log('This script needs to be run interactively in Claude Code.');
  console.log('Claude Code agent will use WebSearch tool to find jobs.\n');

  console.log('📋 Search queries to execute:');
  for (const keyword of KEYWORDS) {
    const query = `"${keyword}" jobs ${LOCATION} 2025`;
    console.log(`  - ${query}`);
  }

  console.log('\n💡 INSTRUCTIONS FOR CLAUDE CODE AGENT:');
  console.log('1. For each query above, use WebSearch tool');
  console.log('2. Extract job URLs from search results');
  console.log('3. Parse job details (title, company, URL)');
  console.log('4. Save results to data/websearch-jobs.json');
  console.log('5. This JSON file will be used by job_hunter.ts\n');

  // Create data directory
  const dataDir = resolve(process.cwd(), 'data');
  await mkdir(dataDir, { recursive: true });

  // Save empty template for now
  const outputPath = resolve(dataDir, 'websearch-jobs.json');
  await writeFile(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    location: LOCATION,
    keywords: KEYWORDS,
    jobs: allJobs,
    instructions: 'Run this script in Claude Code for WebSearch integration'
  }, null, 2));

  console.log(`✅ Template saved to ${outputPath}`);
  console.log('\n🤖 Next: Ask Claude Code agent to run WebSearch and populate this file');
}

main().catch(console.error);
