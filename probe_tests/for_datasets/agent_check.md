# How to verify dataset filters before running probe tests

The Bright Data API has no endpoint that tells you which fields are filterable. The metadata endpoint (`/datasets/{id}/metadata`) shows all output fields but doesn't indicate filter support. You have to probe the API directly.

## Setup

```bash
# Load API token from the Python SDK .env (or wherever yours is)
export $(grep BRIGHTDATA_API_TOKEN /Users/ns/Desktop/projects/sdk-python/.env)
```

## 1. Find the dataset ID

```bash
# From the SDK
npx tsx -e "
import { bdclient } from './src/index';
const c = new bdclient({ autoCreateZones: false });
console.log(c.datasets.amazonBestSellers.datasetId);
c.close();
"
# → gd_l1vijixj9g2vp7563
```

## 2. Get metadata fields

```bash
curl -s -H "Authorization: Bearer $BRIGHTDATA_API_TOKEN" \
  "https://api.brightdata.com/datasets/gd_l1vijixj9g2vp7563/metadata" \
  | python3 -c "
import json,sys
d=json.load(sys.stdin)
for name, info in d.get('fields', {}).items():
    req = ' [REQUIRED]' if info.get('required') else ''
    print(f'  {name} ({info.get(\"type\")}){req}')
"
```

This gives you field names and types. Required fields must be present in scraper input but that's separate from filter support.

## 3. Test a single filter

```bash
curl -s -H "Authorization: Bearer $BRIGHTDATA_API_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "https://api.brightdata.com/datasets/filter" \
  -d '{
    "dataset_id": "gd_l1vijixj9g2vp7563",
    "filter": { "name": "brand", "operator": "=", "value": "Samsung" },
    "records_limit": 1
  }'
```

- Success: `{"snapshot_id":"snap_..."}`
- Bad field: `{"validation_errors":["unsupported filters: fieldname"]}`
- Bad value type: `{"validation_errors":["\"fieldname\": bad value \"test\". Expected type: number"]}`

## 4. Probe all fields at once

Loop through metadata field names and test each one. Use `"test"` as value for text fields — numeric fields will fail with a type error, which still confirms they're filterable.

```bash
DATASET_ID="gd_l1vijixj9g2vp7563"

fields=("title" "brand" "seller_name" "final_price" "rating" "asin" "url" "domain" "categories" "availability" "reviews_count" "currency" "root_bs_rank" "department" "manufacturer")

for field in "${fields[@]}"; do
  result=$(curl -s -H "Authorization: Bearer $BRIGHTDATA_API_TOKEN" \
    -H "Content-Type: application/json" \
    -X POST "https://api.brightdata.com/datasets/filter" \
    -d "{
      \"dataset_id\": \"$DATASET_ID\",
      \"filter\": { \"name\": \"$field\", \"operator\": \"=\", \"value\": \"test\" },
      \"records_limit\": 1
    }")
  if echo "$result" | grep -q "snapshot_id"; then
    echo "OK  $field"
  elif echo "$result" | grep -q "Expected type"; then
    echo "OK  $field (numeric — needs a number value)"
  else
    echo "ERR $field"
  fi
done
```

## Filter format

The `/datasets/filter` endpoint expects structured filters, not key-value pairs:

```json
{
  "dataset_id": "gd_...",
  "filter": {
    "name": "field_name",
    "operator": "=",
    "value": "some_value"
  },
  "records_limit": 1
}
```

| Key | Description |
|-----|-------------|
| `name` | The field to filter on (from metadata) |
| `operator` | One of: `=`, `>`, `>=`, `<`, `<=`, `includes` |
| `value` | The value to match (must match the field's type) |

## Common mistakes

- **Wrong field name:** The product title field is often `title`, not `name`. Check metadata.
- **Sending key-value pairs:** `{ "url": "https://..." }` is wrong. Use `{ "name": "url", "operator": "=", "value": "https://..." }`.
- **Type mismatch:** Numeric fields (`rating`, `final_price`, `reviews_count`) need number values, not strings.
