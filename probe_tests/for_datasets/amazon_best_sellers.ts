// Run: npx tsx probe_tests/for_datasets/amazon_best_sellers.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "title", operator: "includes", value: "Samsung" };

probeDataset(
    'Amazon Best Sellers',
    (c) => c.datasets.amazonBestSellers,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);






/*
title
seller_name
brand
description
initial_price
final_price
final_price_high
currency
availability
reviews_count
categories
asin
buybox_seller
number_of_sellers
root_bs_rank
ISBN10
answered_questions
domain
images_count
url
video_count
image_url
item_weight
rating
product_dimensions
seller_id
image
date_first_available
discount
model_number
manufacturer
department
plus_content
upc
video
top_review
variations
delivery
features
buybox_prices
origin_url
bs_rank
bs_rank_category
sponsered
Cottonelle Ultra Clean Toilet Paper with Active CleaningRipples Texture, 1-Ply Strong Bath Tissue, 24 Family Mega Rolls = 132 Regular (4 Packs of 6), White
Ama***.co***
Kimberly-Clark Corp.
Wit***ott***lle*********ean*********************ine************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************
27.59
27.59
null
USD
In Stock
27533
null
B0CM4NXMV2
Amazon.com
1
1513207751023
null
0
https://www.amazon.com/
6
https://www.amazon.com/Cottonelle-CleaningRipples-Texture-Regular-Packaging/dp/B0CM4NXMV2?th=1&psc=1&currency=USD&language=en_GB
1
https://m.media-amazon.com/images/I/81t2BIpJ32L._AC_SY300_SX300_QL70_FMwebp_.jpg
null
4.8
15.13 x 20 x 7.75 inches; 10.23 Pounds
ATVPDKIKX0DER
https://m.media-amazon.com/images/I/81t2BIpJ32L._AC_SY300_SX300_QL70_FMwebp_.jpg
January 22, 2024
-5%
10036000554653
Kimberly-Clark Corp.
null
true
null
false
Excellent bulk toilet paper—great value and quality for the whole family!This bulk pack (got the mega rolls equivalent to way more regular ones) is a lifesaver for a household of 4+. Super soft and thick 2-ply that actually feels premium, strong enough without tearing easily, and super absorbent so you use less per trip.No lint, no dust, septic-safe, and holds up great—no dissolving issues. The rolls last forever, cutting down on those annoying mid-week store runs. Packaging is sturdy, easy to store under the sink or in the closet.Way better than single packs at the grocery store—saves money and hassle. We’ve stocked up multiple times and keep coming back. Highly recommend for anyone tired of running out!
[{"asin":"B0CKLYPM79","name":"Mega 284 sheet (Pack of 18)"},{"asin":"B0CM4NXMV2","name":"Family M...
["FREE delivery Friday, April 10 on orders shipped by Amazon over $35","Or Prime members get FREE...
["WHAT'S INCLUDED — This toilet paper pack includes 24 Family Mega Rolls of Cottonelle Ultra Clea...
{"discount":"-5%","final_price":27.59,"initial_price":27.59}
null
10036000554653
Item model number ‏ : ‎
false


*/