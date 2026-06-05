// Run: npx tsx probe_tests/for_datasets/indeed_jobs.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "job_title", operator: "includes", value: "Engineer" };

probeDataset(
    'Indeed Jobs',
    (c) => c.datasets.indeedJobs,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
