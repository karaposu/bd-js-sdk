// Run: npx tsx probe_tests/for_datasets/crunchbase_companies.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "operating_status", operator: "=", value: "active" };

probeDataset(
    'Crunchbase Companies',
    (c) => c.datasets.crunchbaseCompanies,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
