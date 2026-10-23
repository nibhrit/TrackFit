# Food data: sources and method

TrackFit ships with a built-in list of about 320 foods, so you can log meals by name and portion. You don't have to type grams of protein. This page covers where the numbers come from, how dish values were worked out, and how much to trust each one.

- Data file: `app/src/data/foods/foods.json`, which follows the contract in `app/src/data/foods/schema.ts`
- Generator: `app/src/data/foods/build-foods.mjs`, which holds every ingredient value and recipe and writes `foods.json`
- Checks: `app/src/data/foods/validate.mjs`

## 1. Sources and licences

| Source | Used for | Licence | Status |
|---|---|---|---|
| **USDA FoodData Central, SR Legacy (April 2018)**, U.S. Department of Agriculture, Agricultural Research Service | All single ingredients (eggs, meat, fish, dairy, grains, pulses, nuts, fruit, vegetables, oils), plus the ingredient values behind every recipe | Public domain, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). USDA asks for credit to FoodData Central | **Used** |
| **Indian Nutrient Databank (INDB)**, Jaacks et al., 2024, [GitHub](https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-), paper in *Current Developments in Nutrition* | Cross-check only | The paper is CC BY 4.0. The data repository has **no licence file**, and its ingredient data comes from IFCT, which needs ICMR-NIN permission | Not copied |
| **Indian Food Composition Tables 2017 (IFCT)**, ICMR-National Institute of Nutrition | Cross-check only | Copyright ICMR-NIN. No open reuse licence | Not copied |
| **USDA FNDDS (Survey foods, 2024)** | Cross-check of dish values (dal, roti, idli, dosa, samosa, biryani, naan) | Public domain (CC0) | Not copied |
| **Open Food Facts** | Phase 2 (packaged foods), see section 8 | Database [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), contents DbCL, images CC BY-SA | Not used yet |

### Why INDB is a cross-check rather than a source

INDB is the best open collection of Indian recipes, but it has three problems for this app:

1. There is no licence on the data itself.
2. Its recipe values are per 100 g of *raw* ingredients plus added water. It applies no cooking yield, so the figures are not per 100 g as eaten. For example, its cooked dals come out at 50–60 kcal per 100 g.
3. Many deep-fried recipes count all the frying oil as eaten. Poori comes out at 738 kcal per 100 g and samosa at 577.

TrackFit therefore recomputes Indian dishes from USDA ingredients, using cooked weights (section 3).

### Attribution (must appear in the app's About/Settings screen and the README)

> Nutrition data: USDA FoodData Central (U.S. Department of Agriculture, Agricultural Research Service; public domain, CC0 1.0), https://fdc.nal.usda.gov. Dish values are TrackFit standard recipes calculated from these ingredients; some foods are TrackFit estimates. Values are approximate and are not medical advice.

## 2. What the numbers mean

- **Per 100 g as eaten.** For cooked dishes, this is 100 g of the finished dish, not of the raw ingredients.
- **`carbs_g` is total carbohydrate, including fibre** (the USDA "by difference" convention). `fiber_g` is part of `carbs_g`, not added to it. Indian tables (IFCT/INDB) usually report *available* carbohydrate, which excludes fibre, so their carb figures are lower for the same food.
- **Energy** is USDA's kcal for single foods. For recipes it is the sum of the ingredients' kcal divided by the cooked weight.

## 3. How dish values were derived

Each recipe in `build-foods.mjs` lists **raw ingredient grams** and the **cooked weight of the finished dish**:

```
per 100 g = (sum of ingredient nutrients) × 100 / cooked weight
```

The cooked weight already accounts for water absorbed (rice, dal, poha) or lost (sabzi, roti, tandoori meat).

Rules followed:

- **Yields.** 100 g raw rice gives about 290 g cooked. 100 g dry dal gives 450–520 g of medium-consistency dal. 100 g atta gives about 133 g of roti. Meat loses 20–35% of its weight in a dry dish.
- **Oil (home cooking).** A moderate home amount, about **1 tsp (5 g) oil or ghee per katori** of dal, curry or sabzi, and about 1.5–2 tsp per paratha. Each food's `notes` gives its assumption. Cooking at home with more oil raises calories and leaves protein unchanged.
- **Oil (restaurant).** Roughly 2–3 times the home amount, plus butter and cream where the dish uses them (makhani, korma, butter naan).
- **Deep-fried foods.** Oil absorbed is estimated at 15–20% of cooked weight, not the whole frying pot. Fried items are marked `estimate`.
- **Ignored ingredients.** Salt, dry spices, chillies and herbs are left out (less than 1% of energy).
- **Meat.** Weights are boneless (edible part). Portion grams exclude bone.
- **Proxies.** Rohu and katla use USDA carp. Chana dal and desi chana use USDA chickpeas, which have slightly more fat. Methi leaves use spinach. Poha uses raw white rice. Soya chunks use defatted soy flour. Khoa uses whole-milk powder adjusted to about 15% moisture.
- **Indian milks** are blends of USDA whole milk, skim milk and cream, mixed to FSSAI fat levels: full cream 6%, toned 3%, double toned 1.5%.

Cross-check against other tables (kcal per 100 g, TrackFit / other):

| Dish | TrackFit | Other table |
|---|---|---|
| Idli | 138 | INDB 137, FNDDS 128 |
| Plain dosa | 215 | FNDDS 210 |
| Chicken curry (home) | 116 | INDB 129, FNDDS 107 |
| Poha | 183 | INDB 180 |
| Upma | 133 | INDB 148 |
| Naan (restaurant) | 305 | USDA naan 291, FNDDS 311 |
| Samosa | 327 | FNDDS 310 |

## 4. Confidence levels (shown to the user)

| Level | Meaning | Count |
|---|---|---|
| `measured` | Taken directly from a lab-analysed USDA table entry, or a documented equivalent food (e.g. soya chunks = defatted soy flour) | 112 |
| `calculated` | A standard recipe computed from measured ingredients, or a documented blend (Indian milks) | 110 |
| `estimate` | A typical value with no direct lab source. This covers all restaurant dishes; deep-fried and syrup-soaked foods; paneer, makhana, jaggery and whey powder; and any recipe where estimated ingredients supply more than 20% of the energy (so all paneer dishes). The app shows these as "about" | 97 |

## 5. Household measures

| Measure | Grams | Used for |
|---|---|---|
| 1 katori (wet) | 150 g | dal, curry, kadhi, raita, rice, khichdi |
| 1 katori (dry sabzi) | 100 g | aloo, bhindi, gobi, bhurji |
| 1 small katori | 100 g | sweets, kheer, halwa |
| 1 bowl | 200–250 g | soups, porridge, restaurant curries (200 g) |
| 1 plate | 200 g (poha, upma), 250 g (rice), 300–350 g (biryani, noodles) | |
| 1 roti / phulka | 40 g (about 30 g atta) | |
| 1 paratha | 75 g plain, 110–120 g stuffed | |
| 1 puri | 25 g | |
| 1 naan | 90 g (home), 100–110 g (restaurant) | |
| 1 idli / 1 dosa | 40 g / 90 g | |
| 1 egg | 50 g edible | Indian eggs are often about 45 g |
| 1 glass | 250 g | milk, lassi, chaas |
| 1 cup tea/coffee | 130–140 g | |
| 1 tsp oil/ghee/sugar | 5 g | |
| 1 tbsp oil / ghee / peanut butter | 14 / 14 / 16 g | |
| 1 scoop whey | 30 g | |
| 1 slice bread | 25 g (white), 28 g (brown) | |
| 1 handful nuts / chana | 25–30 g | |

## 6. Known limitations

- **Restaurant food is uncertain.** Oil, cream, butter and portion size vary 2–3 times between restaurants. A plate of biryani can be anywhere from 450 to 900 kcal.
- **Paneer** has no open lab value. TrackFit uses 18.5 g protein and 22 g fat per 100 g, typical of full-fat paneer labels. Other tables give 15.9 g protein (USDA FNDDS) to 26 g (the Norwegian food table, which describes a drier pressed paneer). If you buy one brand, use its label.
- **Home oil use** is the biggest variable for calories in home dishes. Protein is much less affected.
- **USDA ingredients are US samples.** Indian varieties (desi chana, local rice, buffalo-milk curd) differ by a few per cent.
- **Not covered**: packaged and branded foods (phase 2), regional specialities outside the common North and South Indian set, alcohol, and micronutrients.

## 7. Adding or correcting a food

1. Edit `app/src/data/foods/build-foods.mjs`. Don't hand-edit `foods.json`, because the next build overwrites it.
   - For a single USDA food, find the FDC id at https://fdc.nal.usda.gov, add the ingredient to `ING` with its values, then add a `usda(...)` line.
   - For a dish, add a `recipe({...})` with raw grams, the cooked weight and an oil note. Use `cat: 'restaurant'` for restaurant food.
2. Run `node app/src/data/foods/build-foods.mjs`, then `node app/src/data/foods/validate.mjs`. The validator must PASS. It checks the schema, unique kebab-case ids and names, exactly one default portion, macro sanity, and kcal within ±15% of 4·protein + 4·carbs + 9·fat − 2·fibre.
3. Rules:
   - **Never change or reuse an `id`.** Logged meals point at it. To retire a food, rename it, but keep the id.
   - Never set `measured` unless the value comes straight from a lab table entry with a `ref`.
   - Give the source and `ref` (FDC id), and don't invent ids or URLs.
   - Keep `notes` under 240 characters.
4. Bump `VERSION` in the generator.

## 8. Phase 2: Open Food Facts (packaged foods)

- **Licence.** The database is under ODbL 1.0 (attribution plus share-alike *for the database*), individual product data under DbCL, and images under CC BY-SA. Showing looked-up values in the app is a "produced work" and needs attribution ("Data from Open Food Facts, ODbL"). Storing a copied *subset* as our own database would put that subset under ODbL, so keep OFF data separate from `foods.json`.
- **Data quality.** OFF is crowd-sourced. Expect missing nutrients, per-serving values entered as per-100 g, kJ/kcal mix-ups, and stale recipes. Validate on import: the energy check above, macros of 100 g or less, and a sanity check on the serving size. Show those foods as `estimate` unless the values are confirmed against the label.
- **Indian coverage** is patchy. Search by barcode and fall back to name. Let users correct a product from its label.
