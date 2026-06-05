// Run: npx tsx probe_tests/for_datasets/tiktok_profiles.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "followers", operator: ">=", value: 10000 };

probeDataset(
    'TikTok Profiles',
    (c) => c.datasets.tiktokProfiles,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
