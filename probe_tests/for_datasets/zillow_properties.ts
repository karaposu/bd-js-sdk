// Run: npx tsx probe_tests/for_datasets/zillow_properties.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "zip_code", operator: "=", value: "90210" };

probeDataset(
    'Zillow Properties',
    (c) => c.datasets.zillowProperties,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
