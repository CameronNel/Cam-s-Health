# Historical food lookup reference

This documents an earlier implementation. The current app uses manual food forms, saved repeats and recipes; it has no Ask tab, AI estimate or nutrition lookup button. The reference modules remain for historical context and regression checks and are excluded from the offline app cache.

Ask accepts a food name or a report such as `I ate 200 g cooked chicken breast and 150 g cooked rice`. It prepares separate meal cards with matched food, editable portion, unit, calories and protein/carbs/fat. A bare food name shows per-100 g nutrition and asks for a portion; it does not invent an eaten amount. Standard count/cup/spoon measures show their edible gram equivalent. Raw and cooked matches remain distinct. Descriptions such as extended oven cooking retain the user's words and disclose moisture uncertainty.

Saved recipes and explicitly weighed previous foods are offered alongside generic matches. Unknown foods require a chosen match, a manually entered label, or an explicit choice to keep nutrition unknown. Label values supplied in the check-in stay authoritative. Questions, examples, negated reports and plans do not become food entries. Meal drafts live in memory and are cleared only when saved, discarded, or replaced by a disclosed new review. No OpenAI calls or paid services are used; this is sourced lookup, not an embedded ChatGPT model.

**Save to diary** writes the reviewed actions through the existing GitHubStore, preserving SHA conflict checks, stable entry IDs and immutable read-back verification. Browser editing authorization is still required; connected users save with one click. Failed or offline saves retain the draft. Food and body values can be reviewed and saved together. The ordinary food form's **Find nutrition** fills its existing fields from the same lookup.

## Reference data

- USDA National Nutrient Database for Standard Reference, Legacy Release, final April 2018 release; [dataset and CC0 license](https://agdatacommons.nal.usda.gov/articles/dataset/USDA_National_Nutrient_Database_for_Standard_Reference_Legacy_Release/24661818), [USDA documentation](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR-Legacy/SR-Legacy_Doc.pdf), [FoodData Central downloads](https://fdc.nal.usda.gov/download-datasets/).
- Extracted from the USDA `SR-Leg_ASC.zip` archive, obtained from this [public archive mirror](https://github.com/oletiramesh/snowflakewebuiEssentials/blob/master/SR-Leg_ASC.zip). SHA-256: `79705f75a7306d0910ad16dd4d66a5caf602dad528b99b77c7a510bfaf3d6e14`.
- Source counts: 7,793 FOOD_DES records, 644,125 NUT_DATA records and 14,449 WEIGHT records, matching the USDA documentation.
- Nutrition comes directly from nutrient IDs 208 (kcal), 203 (protein), 205 (carbohydrate) and 204 (fat), all per 100 g edible food. Missing values remain null. Household measures use WEIGHT's gram weight divided by its stated measure amount.
- Rebuild with `python3 scripts/build-food-catalog.py /path/to/SR-Leg_ASC.zip`. The script checks the archive fingerprint. The output is a public reference module (~1.07 MB raw, ~213 KB gzip), without user data or an API key. The existing PWA allowlist caches it by digest.

Generic values are estimates for a matched reference food, not exact measurements of the user's meal. Added oils, sauces and ingredients are separate entries. A 2018 reference or saved estimate cannot establish the current formulation of a particular brand; the current product label takes precedence. No photo analysis is claimed.
