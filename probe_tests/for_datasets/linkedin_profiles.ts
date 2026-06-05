// Run: npx tsx probe_tests/for_datasets/linkedin_profiles.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "followers", operator: ">", value: 10000 };

probeDataset(
    'LinkedIn Profiles',
    (c) => c.datasets.linkedinProfiles,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
