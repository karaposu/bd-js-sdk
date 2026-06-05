// Run: npx tsx probe_tests/for_datasets/instagram_profiles.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "followers", operator: ">=", value: 10000 };

probeDataset(
    'Instagram Profiles',
    (c) => c.datasets.instagramProfiles,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
