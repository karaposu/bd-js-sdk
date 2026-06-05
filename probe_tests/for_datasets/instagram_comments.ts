// Run: npx tsx probe_tests/for_datasets/instagram_comments.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "likes", operator: ">=", value: 100 };

probeDataset(
    'Instagram Comments',
    (c) => c.datasets.instagramComments,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
