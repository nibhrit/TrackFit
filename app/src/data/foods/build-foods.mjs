// Builds foods.json from (a) USDA FoodData Central ingredient values and (b) standard recipes.
// Run:  node app/src/data/foods/build-foods.mjs   then   node app/src/data/foods/validate.mjs
// Methodology: product/FOOD_DATA.md. No dependencies.
//
// Every recipe lists RAW ingredient grams and the COOKED weight of the finished dish, so values are
// per 100 g as eaten. Water is implicit in the cooked weight. Salt and dry spices are ignored (<1% of energy).

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const VERSION = '2026.10.1'
const GENERATED = '2026-10-23'

// ---------------------------------------------------------------------------
// 1. Ingredients — USDA FoodData Central, SR Legacy (April 2018 release), public domain (CC0 1.0).
//    Values per 100 g: kcal, protein (p), total carbohydrate incl. fibre (c), fat (f), fibre (fib).
// ---------------------------------------------------------------------------
const ING = {
  atta: { fdc: 168893, kcal: 340, p: 13.21, c: 71.97, f: 2.5, fib: 10.7, desc: "Wheat flour, whole-grain (Includes foods for USDA's Food Distribution Program)" },
  maida: { fdc: 168894, kcal: 364, p: 10.33, c: 76.31, f: 0.98, fib: 2.7, desc: "Wheat flour, white, all-purpose, enriched, bleached" },
  besan: { fdc: 174288, kcal: 387, p: 22.39, c: 57.82, f: 6.69, fib: 10.8, desc: "Chickpea flour (besan)" },
  rice: { fdc: 168877, kcal: 365, p: 7.13, c: 79.95, f: 0.66, fib: 1.3, desc: "Rice, white, long-grain, regular, raw, enriched" },
  rice_cooked: { fdc: 169757, kcal: 130, p: 2.69, c: 28.17, f: 0.28, fib: 0.4, desc: "Rice, white, long-grain, regular, unenriched, cooked without salt" },
  suji: { fdc: 168933, kcal: 360, p: 12.68, c: 72.83, f: 1.05, fib: 3.9, desc: "Semolina, unenriched" },
  rice_flour: { fdc: 169714, kcal: 366, p: 5.95, c: 80.13, f: 1.42, fib: 2.4, desc: "Rice flour, white, unenriched" },
  oats: { fdc: 169705, kcal: 389, p: 16.89, c: 66.27, f: 6.9, fib: 10.6, desc: "Oats (Includes foods for USDA's Food Distribution Program)" },
  toor: { fdc: 172436, kcal: 343, p: 21.7, c: 62.78, f: 1.49, fib: 15.0, desc: "Pigeon peas (red gram), mature seeds, raw" },
  moong: { fdc: 174256, kcal: 347, p: 23.86, c: 62.62, f: 1.15, fib: 16.3, desc: "Mung beans, mature seeds, raw" },
  masoor: { fdc: 174284, kcal: 358, p: 23.91, c: 63.1, f: 2.17, fib: 10.8, desc: "Lentils, pink or red, raw" },
  chana: { fdc: 173756, kcal: 378, p: 20.47, c: 62.95, f: 6.04, fib: 12.2, desc: "Chickpeas (garbanzo beans, bengal gram), mature seeds, raw" },
  urad: { fdc: 174259, kcal: 341, p: 25.21, c: 58.99, f: 1.64, fib: 18.3, desc: "Mungo beans, mature seeds, raw" },
  rajma: { fdc: 173744, kcal: 337, p: 22.53, c: 61.29, f: 1.06, fib: 15.2, desc: "Beans, kidney, red, mature seeds, raw" },
  moong_sprouts: { fdc: 169957, kcal: 30, p: 3.04, c: 5.94, f: 0.18, fib: 1.8, desc: "Mung beans, mature seeds, sprouted, raw" },
  peas_dry: { fdc: 172429, kcal: 118, p: 8.34, c: 21.1, f: 0.39, fib: 8.3, desc: "Peas, split, mature seeds, cooked, boiled, without salt" },
  oil: { fdc: 171411, kcal: 884, p: 0, c: 0, f: 100, fib: 0.0, desc: "Oil, soybean, salad or cooking" },
  mustard_oil: { fdc: 172337, kcal: 884, p: 0, c: 0, f: 100, fib: 0.0, desc: "Oil, mustard" },
  ghee: { fdc: 171314, kcal: 900, p: 0, c: 0, f: 100, fib: 0.0, desc: "Butter, Clarified butter (ghee)" },
  butter: { fdc: 173430, kcal: 717, p: 0.85, c: 0.06, f: 81.11, fib: 0.0, desc: "Butter, without salt" },
  coconut_oil: { fdc: 171412, kcal: 892, p: 0, c: 0, f: 99.06, fib: 0.0, desc: "Oil, coconut" },
  milk: { fdc: 171265, kcal: 61, p: 3.15, c: 4.8, f: 3.25, fib: 0.0, desc: "Milk, whole, 3.25% milkfat, with added vitamin D" },
  milk_skim: { fdc: 171269, kcal: 34, p: 3.37, c: 4.96, f: 0.08, fib: 0.0, desc: "Milk, nonfat, fluid, with added vitamin A and vitamin D (fat free or skim)" },
  milk_2: { fdc: 171267, kcal: 50, p: 3.3, c: 4.8, f: 1.98, fib: 0.0, desc: "Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D" },
  milk_1: { fdc: 170872, kcal: 42, p: 3.37, c: 4.99, f: 0.97, fib: 0.0, desc: "Milk, lowfat, fluid, 1% milkfat, with added vitamin A and vitamin D" },
  curd: { fdc: 171284, kcal: 61, p: 3.47, c: 4.66, f: 3.25, fib: 0.0, desc: "Yogurt, plain, whole milk" },
  curd_low: { fdc: 170886, kcal: 63, p: 5.25, c: 7.04, f: 1.55, fib: 0.0, desc: "Yogurt, plain, low fat" },
  greek_nf: { fdc: 170894, kcal: 59, p: 10.19, c: 3.6, f: 0.39, fib: 0.0, desc: "Yogurt, Greek, plain, nonfat (Includes foods for USDA's Food Distribution Program)" },
  greek_whole: { fdc: 171304, kcal: 97, p: 9, c: 3.98, f: 5, fib: 0.0, desc: "Yogurt, Greek, plain, whole milk" },
  cream: { fdc: 170859, kcal: 340, p: 2.84, c: 2.84, f: 36.08, fib: 0.0, desc: "Cream, fluid, heavy whipping" },
  cream_light: { fdc: 170857, kcal: 195, p: 2.96, c: 3.66, f: 19.1, fib: 0.0, desc: "Cream, fluid, light (coffee cream or table cream)" },
  condensed: { fdc: 171275, kcal: 321, p: 7.91, c: 54.4, f: 8.7, fib: 0.0, desc: "Milk, canned, condensed, sweetened" },
  milk_powder: { fdc: 170876, kcal: 496, p: 26.32, c: 38.42, f: 26.71, fib: 0.0, desc: "Milk, dry, whole, with added vitamin D" },
  buttermilk_us: { fdc: 170874, kcal: 40, p: 3.31, c: 4.79, f: 1.07, fib: 0.0, desc: "Milk, buttermilk, fluid, cultured, lowfat" },
  egg: { fdc: 171287, kcal: 143, p: 12.56, c: 0.72, f: 9.51, fib: 0.0, desc: "Egg, whole, raw, fresh" },
  egg_white: { fdc: 172183, kcal: 52, p: 10.9, c: 0.73, f: 0.17, fib: 0.0, desc: "Egg, white, raw, fresh" },
  egg_boiled: { fdc: 173424, kcal: 155, p: 12.58, c: 1.12, f: 10.61, fib: 0.0, desc: "Egg, whole, cooked, hard-boiled" },
  chicken_breast: { fdc: 171077, kcal: 120, p: 22.5, c: 0, f: 2.62, fib: 0.0, desc: "Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw" },
  chicken_breast_cooked: { fdc: 171534, kcal: 151, p: 30.54, c: 0, f: 3.17, fib: 0.0, desc: "Chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, grilled" },
  chicken_thigh: { fdc: 173627, kcal: 121, p: 19.66, c: 0, f: 4.12, fib: 0.0, desc: "Chicken, broilers or fryers, dark meat, thigh, meat only, raw" },
  chicken_thigh_cooked: { fdc: 172388, kcal: 179, p: 24.76, c: 0, f: 8.15, fib: 0.0, desc: "Chicken, broilers or fryers, thigh, meat only, cooked, roasted" },
  goat: { fdc: 175303, kcal: 109, p: 20.6, c: 0, f: 2.31, fib: 0.0, desc: "Game meat, goat, raw" },
  goat_cooked: { fdc: 175304, kcal: 143, p: 27.1, c: 0, f: 3.03, fib: 0.0, desc: "Game meat, goat, cooked, roasted" },
  lamb_mince: { fdc: 174370, kcal: 282, p: 16.56, c: 0, f: 23.41, fib: 0.0, desc: "Lamb, ground, raw" },
  carp: { fdc: 171952, kcal: 127, p: 17.83, c: 0, f: 5.6, fib: 0.0, desc: "Fish, carp, raw" },
  carp_cooked: { fdc: 174185, kcal: 162, p: 22.86, c: 0, f: 7.17, fib: 0.0, desc: "Fish, carp, cooked, dry heat" },
  prawn: { fdc: 175179, kcal: 85, p: 20.1, c: 0, f: 0.51, desc: "Crustaceans, shrimp, raw" },
  prawn_cooked: { fdc: 175180, kcal: 99, p: 23.98, c: 0.2, f: 0.28, desc: "Crustaceans, shrimp, cooked" },
  tuna_canned: { fdc: 171986, kcal: 116, p: 25.51, c: 0, f: 0.82, fib: 0.0, desc: "Fish, tuna, light, canned in water, without salt, drained solids" },
  salmon_cooked: { fdc: 171998, kcal: 182, p: 25.44, c: 0, f: 8.13, fib: 0.0, desc: "Fish, salmon, Atlantic, wild, cooked, dry heat" },
  tofu: { fdc: 172475, kcal: 144, p: 17.27, c: 2.78, f: 8.72, fib: 2.3, desc: "Tofu, raw, firm, prepared with calcium sulfate" },
  soy_flour: { fdc: 174275, kcal: 327, p: 51.46, c: 33.92, f: 1.22, fib: 17.5, desc: "Soy flour, defatted" },
  peanut_butter: { fdc: 172470, kcal: 598, p: 22.21, c: 22.31, f: 51.36, fib: 5.0, desc: "Peanut butter, smooth style, without salt" },
  almond: { fdc: 170567, kcal: 579, p: 21.15, c: 21.55, f: 49.93, fib: 12.5, desc: "Nuts, almonds" },
  cashew: { fdc: 170162, kcal: 553, p: 18.22, c: 30.19, f: 43.85, fib: 3.3, desc: "Nuts, cashew nuts, raw" },
  walnut: { fdc: 170187, kcal: 654, p: 15.23, c: 13.71, f: 65.21, fib: 6.7, desc: "Nuts, walnuts, english" },
  pistachio: { fdc: 170184, kcal: 560, p: 20.16, c: 27.17, f: 45.32, fib: 10.6, desc: "Nuts, pistachio nuts, raw" },
  peanut: { fdc: 172430, kcal: 567, p: 25.8, c: 16.13, f: 49.24, fib: 8.5, desc: "Peanuts, all types, raw" },
  peanut_roasted: { fdc: 173806, kcal: 587, p: 24.35, c: 21.26, f: 49.66, fib: 8.4, desc: "Peanuts, all types, dry-roasted, without salt" },
  coconut: { fdc: 170169, kcal: 354, p: 3.33, c: 15.23, f: 33.49, fib: 9.0, desc: "Nuts, coconut meat, raw" },
  coconut_dry: { fdc: 170170, kcal: 660, p: 6.88, c: 23.65, f: 64.53, fib: 16.3, desc: "Nuts, coconut meat, dried (desiccated), not sweetened" },
  flax: { fdc: 169414, kcal: 534, p: 18.29, c: 28.88, f: 42.16, fib: 27.3, desc: "Seeds, flaxseed" },
  chia: { fdc: 170554, kcal: 486, p: 16.54, c: 42.12, f: 30.74, fib: 34.4, desc: "Seeds, chia seeds, dried" },
  pumpkin_seed: { fdc: 170556, kcal: 559, p: 30.23, c: 10.71, f: 49.05, fib: 6.0, desc: "Seeds, pumpkin and squash seed kernels, dried" },
  sunflower_seed: { fdc: 170562, kcal: 584, p: 20.78, c: 20, f: 51.46, fib: 8.6, desc: "Seeds, sunflower seed kernels, dried" },
  sesame: { fdc: 170150, kcal: 573, p: 17.73, c: 23.45, f: 49.67, fib: 11.8, desc: "Seeds, sesame seeds, whole, dried" },
  banana: { fdc: 173944, kcal: 89, p: 1.09, c: 22.84, f: 0.33, fib: 2.6, desc: "Bananas, raw" },
  apple: { fdc: 171688, kcal: 52, p: 0.26, c: 13.81, f: 0.17, fib: 2.4, desc: "Apples, raw, with skin (Includes foods for USDA's Food Distribution Program)" },
  mango: { fdc: 169910, kcal: 60, p: 0.82, c: 14.98, f: 0.38, fib: 1.6, desc: "Mangos, raw" },
  papaya: { fdc: 169926, kcal: 43, p: 0.47, c: 10.82, f: 0.26, fib: 1.7, desc: "Papayas, raw" },
  orange: { fdc: 169097, kcal: 47, p: 0.94, c: 11.75, f: 0.12, fib: 2.4, desc: "Oranges, raw, all commercial varieties" },
  guava: { fdc: 173044, kcal: 68, p: 2.55, c: 14.32, f: 0.95, fib: 5.4, desc: "Guavas, common, raw" },
  grapes: { fdc: 174683, kcal: 69, p: 0.72, c: 18.1, f: 0.16, fib: 0.9, desc: "Grapes, red or green (European type, such as Thompson seedless), raw" },
  pomegranate: { fdc: 169134, kcal: 83, p: 1.67, c: 18.7, f: 1.17, fib: 4.0, desc: "Pomegranates, raw" },
  watermelon: { fdc: 167765, kcal: 30, p: 0.61, c: 7.55, f: 0.15, fib: 0.4, desc: "Watermelon, raw" },
  pineapple: { fdc: 169124, kcal: 50, p: 0.54, c: 13.12, f: 0.12, fib: 1.4, desc: "Pineapple, raw, all varieties" },
  dates: { fdc: 171726, kcal: 282, p: 2.45, c: 75.03, f: 0.39, fib: 8.0, desc: "Dates, deglet noor" },
  muskmelon: { fdc: 169092, kcal: 34, p: 0.84, c: 8.16, f: 0.19, fib: 0.9, desc: "Melons, cantaloupe, raw" },
  kiwi: { fdc: 168153, kcal: 61, p: 1.14, c: 14.66, f: 0.52, fib: 3.0, desc: "Kiwifruit, green, raw" },
  potato: { fdc: 170026, kcal: 77, p: 2.05, c: 17.49, f: 0.09, fib: 2.1, desc: "Potatoes, flesh and skin, raw" },
  potato_boiled: { fdc: 170440, kcal: 86, p: 1.71, c: 20.01, f: 0.1, fib: 1.8, desc: "Potatoes, boiled, cooked without skin, flesh, without salt" },
  onion: { fdc: 170000, kcal: 40, p: 1.1, c: 9.34, f: 0.1, fib: 1.7, desc: "Onions, raw" },
  tomato: { fdc: 170457, kcal: 18, p: 0.88, c: 3.89, f: 0.2, fib: 1.2, desc: "Tomatoes, red, ripe, raw, year round average" },
  okra: { fdc: 169260, kcal: 33, p: 1.93, c: 7.45, f: 0.19, fib: 3.2, desc: "Okra, raw" },
  cauliflower: { fdc: 169986, kcal: 25, p: 1.92, c: 4.97, f: 0.28, fib: 2.0, desc: "Cauliflower, raw" },
  spinach: { fdc: 168462, kcal: 23, p: 2.86, c: 3.63, f: 0.39, fib: 2.2, desc: "Spinach, raw" },
  brinjal: { fdc: 169228, kcal: 25, p: 0.98, c: 5.88, f: 0.18, fib: 3.0, desc: "Eggplant, raw" },
  lauki: { fdc: 169232, kcal: 14, p: 0.62, c: 3.39, f: 0.02, fib: 0.5, desc: "Gourd, white-flowered (calabash), raw" },
  peas: { fdc: 170419, kcal: 81, p: 5.42, c: 14.45, f: 0.4, fib: 5.7, desc: "Peas, green, raw" },
  carrot: { fdc: 170393, kcal: 41, p: 0.93, c: 9.58, f: 0.24, fib: 2.8, desc: "Carrots, raw" },
  cabbage: { fdc: 169975, kcal: 25, p: 1.28, c: 5.8, f: 0.1, fib: 2.5, desc: "Cabbage, raw" },
  capsicum: { fdc: 170427, kcal: 20, p: 0.86, c: 4.64, f: 0.17, fib: 1.7, desc: "Peppers, sweet, green, raw" },
  cucumber: { fdc: 168409, kcal: 15, p: 0.65, c: 3.63, f: 0.11, fib: 0.5, desc: "Cucumber, with peel, raw" },
  beans: { fdc: 169961, kcal: 31, p: 1.83, c: 6.97, f: 0.22, fib: 2.7, desc: "Beans, snap, green, raw" },
  sweet_potato: { fdc: 168482, kcal: 86, p: 1.57, c: 20.12, f: 0.05, fib: 3.0, desc: "Sweet potato, raw, unprepared (Includes foods for USDA's Food Distribution Program)" },
  mushroom: { fdc: 169251, kcal: 22, p: 3.09, c: 3.26, f: 0.34, fib: 1.0, desc: "Mushrooms, white, raw" },
  corn: { fdc: 169998, kcal: 86, p: 3.27, c: 18.7, f: 1.35, fib: 2.0, desc: "Corn, sweet, yellow, raw" },
  broccoli: { fdc: 170379, kcal: 34, p: 2.82, c: 6.64, f: 0.37, fib: 2.6, desc: "Broccoli, raw" },
  beetroot: { fdc: 169145, kcal: 43, p: 1.61, c: 9.56, f: 0.17, fib: 2.8, desc: "Beets, raw" },
  pumpkin: { fdc: 168448, kcal: 26, p: 1, c: 6.5, f: 0.1, fib: 0.5, desc: "Pumpkin, raw" },
  ginger: { fdc: 169231, kcal: 80, p: 1.82, c: 17.77, f: 0.75, fib: 2.0, desc: "Ginger root, raw" },
  garlic: { fdc: 169230, kcal: 149, p: 6.36, c: 33.06, f: 0.5, fib: 2.1, desc: "Garlic, raw" },
  coriander: { fdc: 169997, kcal: 23, p: 2.13, c: 3.67, f: 0.52, fib: 2.8, desc: "Coriander (cilantro) leaves, raw" },
  lemon: { fdc: 167747, kcal: 22, p: 0.35, c: 6.9, f: 0.24, fib: 0.3, desc: "Lemon juice, raw" },
  tamarind: { fdc: 167763, kcal: 239, p: 2.8, c: 62.5, f: 0.6, fib: 5.1, desc: "Tamarinds, raw" },
  coconut_milk: { fdc: 170172, kcal: 230, p: 2.29, c: 5.54, f: 23.84, fib: 2.2, desc: "Nuts, coconut milk, raw (liquid expressed from grated meat and water)" },
  sugar: { fdc: 169655, kcal: 387, p: 0, c: 99.98, f: 0, fib: 0.0, desc: "Sugars, granulated" },
  honey: { fdc: 169640, kcal: 304, p: 0.3, c: 82.4, f: 0, fib: 0.2, desc: "Honey" },
  jaggery: { fdc: 168833, kcal: 380, p: 0.12, c: 98.09, f: 0, fib: 0.0, desc: "Sugars, brown" },
  bread_white: { fdc: 174924, kcal: 266, p: 8.85, c: 49.42, f: 3.33, fib: 2.7, desc: "Bread, white, commercially prepared (includes soft bread crumbs)" },
  bread_brown: { fdc: 172688, kcal: 252, p: 12.45, c: 42.71, f: 3.5, fib: 6.0, desc: "Bread, whole-wheat, commercially prepared" },
  pasta: { fdc: 169736, kcal: 371, p: 13.04, c: 74.67, f: 1.51, fib: 3.2, desc: "Pasta, dry, enriched" },
  egg_noodles: { fdc: 169731, kcal: 384, p: 14.16, c: 71.27, f: 4.44, fib: 3.3, desc: "Noodles, egg, dry, enriched" },
  ketchup: { fdc: 168556, kcal: 101, p: 1.04, c: 27.4, f: 0.1, fib: 0.3, desc: "Catsup" },
  mayo: { fdc: 171009, kcal: 680, p: 0.96, c: 0.57, f: 74.85, fib: 0.0, desc: "Salad dressing, mayonnaise, regular" },
  cheese: { fdc: 171290, kcal: 371, p: 18.13, c: 3.7, f: 31.79, fib: 0.0, desc: "Cheese, pasteurized process, American, without added vitamin D" },
  mozzarella: { fdc: 170845, kcal: 299, p: 22.17, c: 2.4, f: 22.14, fib: 0.0, desc: "Cheese, mozzarella, whole milk" },
  cheddar: { fdc: 173414, kcal: 403, p: 22.87, c: 3.37, f: 33.31, fib: 0.0, desc: "Cheese, cheddar (Includes foods for USDA's Food Distribution Program)" },
  soy_sauce: { fdc: 172473, kcal: 57, p: 9.05, c: 5.59, f: 0.3, fib: 0.7, desc: "Soy sauce made from soy and wheat (shoyu), low sodium" },
  bun: { fdc: 172796, kcal: 279, p: 9.77, c: 50.12, f: 3.91, fib: 1.8, desc: "Rolls, hamburger or hotdog, plain" },
  pita: { fdc: 172816, kcal: 275, p: 9.1, c: 55.7, f: 1.2, fib: 2.2, desc: "Bread, pita, white, unenriched" },
  tea: { fdc: 173227, kcal: 1, p: 0, c: 0.3, f: 0, fib: 0.0, desc: "Beverages, tea, black, brewed, prepared with tap water" },
  cornstarch: { fdc: 169698, kcal: 381, p: 0.26, c: 91.27, f: 0.05, fib: 0.9, desc: "Cornstarch" },
  ff_fries: { fdc: 170698, kcal: 312, p: 3.43, c: 41.44, f: 14.73, fib: 3.8, desc: "Fast foods, potato, french fried in vegetable oil" },
  ff_burger: { fdc: 170694, kcal: 263, p: 13.3, c: 29.57, f: 10.18, fib: 1.8, desc: "Fast foods, hamburger; single, regular patty; with condiments" },
  ff_cheeseburger: { fdc: 170691, kcal: 270, p: 13.49, c: 25.46, f: 12.9, fib: 1.9, desc: "Fast foods, cheeseburger; single, regular patty, with condiments" },
  pizza_frozen: { fdc: 170317, kcal: 268, p: 10.36, c: 29.02, f: 12.28, fib: 2.2, desc: "Pizza, cheese topping, regular crust, frozen, cooked" },
  buffalo_milk: { fdc: 171280, kcal: 97, p: 3.75, c: 5.18, f: 6.89, fib: 0.0, desc: "Milk, indian buffalo, fluid" },
  pasta_cooked: { fdc: 169737, kcal: 158, p: 5.8, c: 30.86, f: 0.93, fib: 1.8, desc: "Pasta, cooked, enriched, without added salt" },
  olive_oil: { fdc: 171413, kcal: 884, p: 0, c: 0, f: 100, fib: 0.0, desc: "Oil, olive, salad or cooking" },
  brown_rice_cooked: { fdc: 169704, kcal: 123, p: 2.74, c: 25.58, f: 0.97, fib: 1.6, desc: "Rice, brown, long-grain, cooked (Includes foods for USDA's Food Distribution Program)" },
  oats_cooked: { fdc: 171675, kcal: 71, p: 2.54, c: 12, f: 1.52, fib: 1.7, desc: "Cereals, oats, regular and quick and instant, unenriched, cooked with water (includes boiling and microwaving), with salt" },
  chickpeas_boiled: { fdc: 173757, kcal: 164, p: 8.86, c: 27.42, f: 2.59, fib: 7.6, desc: "Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt" },
  toor_boiled: { fdc: 172437, kcal: 121, p: 6.76, c: 23.25, f: 0.38, fib: 6.7, desc: "Pigeon peas (red gram), mature seeds, cooked, boiled, without salt" },
  moong_boiled: { fdc: 174257, kcal: 105, p: 7.02, c: 19.15, f: 0.38, fib: 7.6, desc: "Mung beans, mature seeds, cooked, boiled, without salt" },
  lentil_boiled: { fdc: 172421, kcal: 116, p: 9.02, c: 20.13, f: 0.38, fib: 7.9, desc: "Lentils, mature seeds, cooked, boiled, without salt" },
  maida_bread: { fdc: 168896, kcal: 361, p: 11.98, c: 72.53, f: 1.66, fib: 2.4, desc: "Wheat flour, white, bread, enriched" },
  naan_us: { fdc: 171845, kcal: 291, p: 9.62, c: 50.43, f: 5.65, fib: 2.2, desc: "Bread, naan, plain, commercially prepared, refrigerated" },
  rajma_boiled: { fdc: 175194, kcal: 127, p: 8.67, c: 22.8, f: 0.5, fib: 7.4, desc: "Beans, kidney, red, mature seeds, cooked, boiled, without salt" },
  cornmeal: { fdc: 169697, kcal: 362, p: 8.12, c: 76.89, f: 3.59, fib: 7.3, desc: "Cornmeal, whole-grain, yellow" },
  bajra: { fdc: 172023, kcal: 382, p: 10.75, c: 75.12, f: 4.25, fib: 3.5, desc: "Millet flour" },
  jowar: { fdc: 168943, kcal: 359, p: 8.43, c: 76.64, f: 3.34, fib: 6.6, desc: "Sorghum flour, whole-grain" },
  bulgur: { fdc: 170688, kcal: 342, p: 12.29, c: 75.87, f: 1.33, fib: 12.5, desc: "Bulgur, dry" },
  puffed_rice: { fdc: 173912, kcal: 402, p: 6.3, c: 89.8, f: 0.5, fib: 1.7, desc: "Cereals ready-to-eat, rice, puffed, fortified" },
  egg_yolk: { fdc: 172184, kcal: 322, p: 15.86, c: 3.59, f: 26.54, fib: 0.0, desc: "Egg, yolk, raw, fresh" },
  dark_choc: { fdc: 170273, kcal: 598, p: 7.79, c: 45.9, f: 42.63, fib: 10.9, desc: "Chocolate, dark, 70-85% cacao solids" },
}

// ---------------------------------------------------------------------------
// 2. Derived and estimated ingredients (no direct USDA entry).
//    est: true  -> a typical value, not a lab table entry. A recipe whose estimated
//                  ingredients supply > 20% of its energy is downgraded to 'estimate'.
//    proxy      -> a USDA entry for a compositionally equivalent food.
// ---------------------------------------------------------------------------
const blend = (parts) => {
  const out = { kcal: 0, p: 0, c: 0, f: 0, fib: 0 }
  for (const [k, frac] of parts) for (const n of Object.keys(out)) out[n] += (ING[k][n] ?? 0) * frac
  return out
}
// Indian milks by FSSAI fat standard, blended from USDA whole milk (3.25% fat), skim milk and cream.
ING.milk_full_in = { ...blend([['milk', 0.9162], ['cream', 0.0838]]), derived: 'USDA whole milk + cream blended to 6% fat' }
ING.milk_toned = { ...blend([['milk', 0.921], ['milk_skim', 0.079]]), derived: 'USDA whole + skim milk blended to 3% fat' }
ING.milk_dtoned = { ...blend([['milk', 0.448], ['milk_skim', 0.552]]), derived: 'USDA whole + skim milk blended to 1.5% fat' }
ING.curd_toned = { ...ING.milk_toned, derived: 'set from toned milk (fermentation barely changes macros)' }
ING.poha = { ...ING.rice, proxy: 'USDA raw white rice (FDC 168877); flattened rice is parboiled, flattened rice' }
ING.soya_chunks = { ...ING.soy_flour, proxy: 'USDA defatted soy flour (FDC 174275); soya chunks are extruded defatted soy flour' }
ING.khoa = { ...ING.milk_powder, kcal: 421, p: 22.4, c: 32.7, f: 22.7, fib: 0, proxy: 'USDA whole milk powder diluted to ~15% moisture (khoa ~ 20-25% moisture)' }
ING.paneer = { kcal: 280, p: 18.5, c: 2.0, f: 22.0, fib: 0, est: true }
ING.paneer_low = { kcal: 165, p: 18.0, c: 4.0, f: 8.5, fib: 0, est: true }
ING.makhana = { kcal: 347, p: 9.7, c: 76.9, f: 0.1, fib: 0, est: true }
ING.jaggery = { kcal: 383, p: 0.4, c: 95.0, f: 0.1, fib: 0, est: true }
ING.whey = { kcal: 400, p: 78.0, c: 8.0, f: 6.0, fib: 0, est: true }
ING.water = { kcal: 0, p: 0, c: 0, f: 0, fib: 0 }

// ---------------------------------------------------------------------------
// 3. Helpers
// ---------------------------------------------------------------------------
const FDC_URL = (fdc) => `https://fdc.nal.usda.gov/food-details/${fdc}/nutrients`
const USDA = (fdc) => ({ name: 'USDA FoodData Central (SR Legacy)', ref: `FDC ${fdc}`, url: FDC_URL(fdc) })
const RECIPE_SRC = (id) => ({ name: 'TrackFit standard recipe, USDA FoodData Central ingredients', ref: `recipe:${id}` })
const EST_SRC = (what) => ({ name: what })

const r1 = (x) => Math.round(x * 10) / 10
const per100 = (n) => {
  const o = { kcal: Math.round(n.kcal), protein_g: r1(n.p), carbs_g: r1(n.c), fat_g: r1(n.f) }
  if (n.fib !== undefined && n.fib !== null && !Number.isNaN(n.fib)) o.fiber_g = r1(n.fib)
  return o
}
// P('1 katori', 150, true)
const P = (label, grams, def) => (def ? { label, grams, default: true } : { label, grams })

const foods = []
const add = (f) => foods.push(f)

// A USDA table food, as-is.
function usda(id, name, aliases, key, portions, notes, category = 'basic') {
  const i = ING[key]
  if (!i.fdc) throw new Error(`${id}: ${key} has no FDC id`)
  add({ id, name, aliases, category, per100g: per100(i), portions, source: USDA(i.fdc), confidence: 'measured', ...(notes ? { notes } : {}) })
}

// A derived/estimated single food.
function single(id, name, aliases, key, portions, confidence, source, notes, category = 'basic') {
  add({ id, name, aliases, category, per100g: per100(ING[key]), portions, source, confidence, notes })
}

// A recipe: raw ingredient grams + cooked weight.
function recipe({ id, name, aliases, cat = 'indian_home', ing, cooked, portions, notes, conf, source }) {
  const sum = { kcal: 0, p: 0, c: 0, f: 0, fib: 0 }
  let rawWeight = 0, estKcal = 0
  for (const [k, g] of ing) {
    const i = ING[k]
    if (!i) throw new Error(`${id}: unknown ingredient ${k}`)
    rawWeight += g
    for (const n of Object.keys(sum)) sum[n] += ((i[n] ?? 0) * g) / 100
    if (i.est) estKcal += (i.kcal * g) / 100
  }
  if (!(cooked > 0)) throw new Error(`${id}: cooked weight missing`)
  const n = {}
  for (const k of Object.keys(sum)) n[k] = (sum[k] * 100) / cooked
  let confidence = conf ?? (cat === 'restaurant' ? 'estimate' : 'calculated')
  if (confidence === 'calculated' && estKcal > 0.2 * sum.kcal) confidence = 'estimate'
  add({
    id, name, aliases, category: cat, per100g: per100(n), portions,
    source: source ?? (cat === 'restaurant'
      ? { name: 'TrackFit restaurant-style recipe estimate, USDA FoodData Central ingredients', ref: `recipe:${id}` }
      : RECIPE_SRC(id)),
    confidence,
    notes,
  })
  RECIPES[id] = { ing, cooked, rawWeight }
}
const RECIPES = {}

// Common portions
const KATORI = (def = true) => P('1 katori', 150, def)
const KATORI_DRY = (def = true) => P('1 katori', 100, def)
const BOWL = P('1 bowl', 250)
const PLATE = (g = 250, def = false) => P('1 plate', g, def)

// ===========================================================================
// 4. BASIC — single ingredients (USDA measured unless marked)
// ===========================================================================
// Eggs
usda('egg-whole-raw', 'Egg, whole, raw', ['anda', 'egg', 'kachcha anda'], 'egg', [P('1 egg', 50, true), P('2 eggs', 100)], 'Portion = edible part of one large egg (~50 g). Indian eggs are often 45 g edible.')
usda('egg-boiled', 'Egg, boiled', ['ubla anda', 'boiled egg', 'hard boiled egg', 'anda'], 'egg_boiled', [P('1 egg', 50, true), P('2 eggs', 100)])
usda('egg-white-raw', 'Egg white, raw', ['egg white', 'anda safedi', 'safed anda'], 'egg_white', [P('1 egg white', 33, true), P('4 egg whites', 132)])
usda('egg-yolk-raw', 'Egg yolk, raw', ['egg yolk', 'anda zardi', 'peela'], 'egg_yolk', [P('1 yolk', 17, true)])

// Chicken, meat, fish
usda('chicken-breast-raw', 'Chicken breast, raw, skinless', ['chicken breast', 'murgh', 'boneless chicken'], 'chicken_breast', [P('100 g raw', 100, true), P('1 breast', 170)], 'Raw weight. Cooking loses ~25-30% water.')
usda('chicken-breast-cooked', 'Chicken breast, cooked (grilled)', ['grilled chicken', 'chicken breast cooked', 'murgh'], 'chicken_breast_cooked', [P('1 palm-size piece', 100, true), P('1 breast', 120)], 'Grilled without added oil.')
usda('chicken-thigh-raw', 'Chicken thigh, raw, skinless', ['chicken leg', 'thigh', 'murgh'], 'chicken_thigh', [P('100 g raw', 100, true), P('1 thigh', 90)])
usda('chicken-thigh-cooked', 'Chicken thigh, cooked (roasted)', ['roasted chicken thigh', 'chicken leg'], 'chicken_thigh_cooked', [P('1 thigh', 70, true)])
usda('mutton-raw', 'Mutton (goat meat), raw', ['mutton', 'goat', 'bakra', 'gosht'], 'goat', [P('100 g raw', 100, true)], 'Lean goat meat. Indian "mutton" is usually goat.')
usda('mutton-cooked', 'Mutton (goat meat), cooked', ['mutton', 'goat cooked', 'gosht'], 'goat_cooked', [P('4-5 pieces', 100, true)], 'Roasted lean meat, no added fat, no bone.')
usda('keema-raw', 'Minced meat (lamb keema), raw', ['keema', 'qeema', 'mince'], 'lamb_mince', [P('100 g raw', 100, true)], 'Lamb mince with fat. Goat keema from a butcher is usually leaner.')
usda('fish-rohu-raw', 'Fish, rohu / carp, raw', ['rohu', 'machli', 'fish', 'carp', 'katla'], 'carp', [P('1 piece', 80, true)], 'USDA carp; rohu and katla are carps.')
usda('fish-rohu-cooked', 'Fish, rohu / carp, cooked (no oil)', ['rohu', 'machli', 'fish cooked'], 'carp_cooked', [P('1 piece', 70, true)])
usda('salmon-cooked', 'Salmon, cooked', ['salmon', 'rawas'], 'salmon_cooked', [P('1 fillet', 120, true)])
usda('tuna-canned-water', 'Tuna, canned in water, drained', ['tuna', 'canned tuna'], 'tuna_canned', [P('1 small can (drained)', 100, true)])
usda('prawns-raw', 'Prawns / shrimp, raw', ['prawns', 'jhinga', 'shrimp', 'chingri'], 'prawn', [P('100 g raw', 100, true)])
usda('prawns-cooked', 'Prawns / shrimp, cooked', ['prawns', 'jhinga', 'shrimp'], 'prawn_cooked', [P('10 medium prawns', 85, true)])

// Vegetarian protein
single('paneer', 'Paneer, full fat', ['paneer', 'cottage cheese', 'chhena'], 'paneer', [P('100 g', 100, true), P('1 cube (25 g)', 25), P('1 katori cubes', 120)], 'estimate',
  EST_SRC('TrackFit estimate (typical Indian full-fat paneer)'), 'No open lab entry. Typical labels: 18-20 g protein, 20-25 g fat. FSSAI: moisture <=70%, fat >=50% of dry matter.')
single('paneer-low-fat', 'Paneer, low fat', ['low fat paneer', 'skimmed paneer'], 'paneer_low', [P('100 g', 100, true)], 'estimate',
  EST_SRC('TrackFit estimate (typical low-fat paneer label)'), 'Brands vary a lot; check your pack.')
usda('tofu-firm', 'Tofu, firm', ['tofu', 'soya paneer', 'bean curd'], 'tofu', [P('100 g', 100, true)])
single('soya-chunks-dry', 'Soya chunks, dry', ['soya chunks', 'soya badi', 'nutrela', 'meal maker', 'soy chunks'], 'soya_chunks', [P('1 katori dry', 30, true), P('50 g dry', 50)], 'measured',
  USDA(174275), 'Values of USDA defatted soy flour; soya chunks are extruded defatted soy flour. Weigh dry: 30 g dry ~ 90 g soaked.')
single('whey-protein-concentrate', 'Whey protein, concentrate (generic)', ['whey', 'protein powder', 'whey protein', 'protein shake'], 'whey', [P('1 scoop', 30, true), P('half scoop', 15)], 'estimate',
  EST_SRC('TrackFit estimate (typical 80% whey concentrate label)'), 'Mixed with water. Brands range 70-80% protein; use your tub label for exact values.')
add({ id: 'whey-protein-isolate', name: 'Whey protein, isolate (generic)', aliases: ['whey isolate', 'iso whey', 'protein powder'], category: 'basic',
  per100g: { kcal: 370, protein_g: 88, carbs_g: 2, fat_g: 1 }, portions: [P('1 scoop', 30, true)], source: EST_SRC('TrackFit estimate (typical 90% whey isolate label)'), confidence: 'estimate', notes: 'Mixed with water. Use your tub label for exact values.' })
usda('peanut-butter', 'Peanut butter', ['peanut butter', 'pb', 'moongphali butter'], 'peanut_butter', [P('1 tbsp', 16, true), P('2 tbsp', 32)])

// Dairy
single('milk-full-cream', 'Milk, full cream (6% fat)', ['full cream milk', 'doodh', 'gold milk', 'whole milk'], 'milk_full_in', [P('1 glass', 250, true), P('1 cup', 150)], 'calculated',
  { name: 'Calculated from USDA FoodData Central', ref: 'FDC 171265 + FDC 170859' }, 'Indian full cream milk (FSSAI 6% fat): USDA whole milk blended with cream to 6% fat. 1 glass ~ 250 ml.')
single('milk-toned', 'Milk, toned (3% fat)', ['toned milk', 'doodh', 'milk', 'taaza'], 'milk_toned', [P('1 glass', 250, true), P('1 cup', 150)], 'calculated',
  { name: 'Calculated from USDA FoodData Central', ref: 'FDC 171265 + FDC 171269' }, 'FSSAI toned milk, 3% fat: USDA whole and skim milk blended.')
single('milk-double-toned', 'Milk, double toned (1.5% fat)', ['double toned milk', 'low fat milk', 'doodh'], 'milk_dtoned', [P('1 glass', 250, true), P('1 cup', 150)], 'calculated',
  { name: 'Calculated from USDA FoodData Central', ref: 'FDC 171265 + FDC 171269' }, 'FSSAI double toned milk, 1.5% fat: USDA whole and skim milk blended.')
usda('milk-whole-325', 'Milk, whole (3.25% fat)', ['whole milk', 'cow milk', 'doodh'], 'milk', [P('1 glass', 250, true), P('1 cup', 150)])
usda('milk-skimmed', 'Milk, skimmed', ['skim milk', 'skimmed milk', 'fat free milk', 'doodh'], 'milk_skim', [P('1 glass', 250, true), P('1 cup', 150)])
usda('milk-buffalo', 'Milk, buffalo', ['buffalo milk', 'bhains ka doodh', 'doodh'], 'buffalo_milk', [P('1 glass', 250, true), P('1 cup', 150)])
usda('curd-whole-milk', 'Curd (dahi), whole milk', ['dahi', 'curd', 'yogurt', 'thayir', 'mosaru'], 'curd', [P('1 katori', 150, true), P('2 tbsp', 30)])
single('curd-toned-milk', 'Curd (dahi), toned milk', ['dahi', 'curd', 'low fat dahi', 'yogurt'], 'curd_toned', [P('1 katori', 150, true), P('2 tbsp', 30)], 'calculated',
  { name: 'Calculated from USDA FoodData Central', ref: 'FDC 171265 + FDC 171269' }, 'Home curd set from toned (3%) milk.')
usda('greek-yogurt-nonfat', 'Greek yogurt, plain, nonfat', ['greek yogurt', 'hung curd', 'skyr'], 'greek_nf', [P('1 cup', 150, true), P('1 small tub', 100)])
usda('greek-yogurt-whole', 'Greek yogurt, plain, whole milk', ['greek yogurt', 'hung curd'], 'greek_whole', [P('1 cup', 150, true), P('1 small tub', 100)])
usda('cheese-slice', 'Cheese slice (processed)', ['cheese', 'cheese slice', 'amul slice'], 'cheese', [P('1 slice', 20, true)])
usda('mozzarella', 'Mozzarella cheese', ['mozzarella', 'pizza cheese'], 'mozzarella', [P('2 tbsp grated', 28, true)])
usda('cheddar', 'Cheddar cheese', ['cheddar', 'cheese block'], 'cheddar', [P('1 cube', 20, true)])
usda('cream-fresh', 'Cream, heavy', ['malai', 'fresh cream', 'cream'], 'cream', [P('1 tbsp', 15, true)])
single('khoa', 'Khoa (mawa)', ['khoya', 'mawa', 'khoa'], 'khoa', [P('2 tbsp', 30, true)], 'estimate', { name: 'Derived from USDA FoodData Central', ref: 'FDC 170876' }, 'USDA whole milk powder adjusted to khoa moisture.')
usda('milk-powder-whole', 'Milk powder, whole', ['milk powder', 'dairy whitener'], 'milk_powder', [P('1 tbsp', 8, true)])

// Grains and flours (dry)
usda('oats-dry', 'Oats, rolled, dry', ['oats', 'jai', 'oatmeal', 'rolled oats'], 'oats', [P('1/2 cup', 40, true), P('1 cup', 80)])
usda('oats-cooked-water', 'Oats porridge, cooked in water', ['oats porridge', 'oatmeal cooked'], 'oats_cooked', [P('1 bowl', 240, true)])
usda('rice-white-raw', 'Rice, white, raw', ['chawal', 'rice raw', 'basmati raw', 'sona masoori'], 'rice', [P('1/4 cup', 50, true), P('1 cup', 185)], 'Raw weight. 1 part raw ~ 2.8 parts cooked.')
usda('rice-white-cooked', 'Rice, white, cooked (plain)', ['chawal', 'bhaat', 'plain rice', 'steamed rice', 'annam', 'saadam'], 'rice_cooked', [P('1 katori', 150, true), P('1 plate', 250), P('1 cup', 160)], undefined, 'indian_home')
usda('rice-brown-cooked', 'Rice, brown, cooked', ['brown rice', 'brown chawal'], 'brown_rice_cooked', [P('1 katori', 150, true), P('1 plate', 250)])
usda('atta', 'Whole wheat flour (atta)', ['atta', 'gehun ka atta', 'wheat flour'], 'atta', [P('1 roti worth', 30, true), P('1 cup', 120)])
usda('maida', 'Refined flour (maida)', ['maida', 'all purpose flour', 'apf'], 'maida', [P('1 cup', 125, true)])
usda('besan', 'Gram flour (besan)', ['besan', 'chickpea flour', 'gram flour'], 'besan', [P('2 tbsp', 20, true), P('1 cup', 90)])
usda('suji', 'Semolina (suji / rava)', ['suji', 'sooji', 'rava', 'semolina'], 'suji', [P('1/4 cup', 40, true)])
usda('rice-flour', 'Rice flour', ['chawal ka atta', 'rice flour'], 'rice_flour', [P('2 tbsp', 20, true)])
single('poha-dry', 'Poha (flattened rice), dry', ['poha', 'aval', 'chivda', 'avalakki', 'chura'], 'poha', [P('1 cup dry', 60, true)], 'estimate',
  USDA(168877), 'Values of raw white rice; flattened rice has very similar macros.')
single('makhana', 'Makhana (fox nuts), plain', ['makhana', 'fox nuts', 'lotus seeds', 'phool makhana'], 'makhana', [P('1 cup', 15, true), P('1 bowl', 30)], 'estimate',
  EST_SRC('TrackFit estimate (Indian food-table values as commonly cited)'), 'Popped Euryale ferox seeds. Not in USDA; value as widely cited from ICMR-NIN tables, not verified against the printed table.')
usda('bread-white', 'Bread, white', ['bread', 'double roti', 'sandwich bread', 'pav'], 'bread_white', [P('1 slice', 25, true), P('2 slices', 50)], 'Indian sandwich bread slice ~ 25 g.')
usda('bread-brown', 'Bread, brown / whole wheat', ['brown bread', 'atta bread', 'whole wheat bread'], 'bread_brown', [P('1 slice', 28, true), P('2 slices', 56)])
usda('pasta-cooked', 'Pasta, cooked', ['pasta', 'macaroni', 'spaghetti'], 'pasta_cooked', [P('1 cup', 140, true), P('1 plate', 250)])

// Pulses (dry) and boiled
usda('toor-dal-raw', 'Toor dal, raw', ['arhar dal raw', 'tuvar', 'pigeon pea', 'toor dal'], 'toor', [P('1/4 cup', 50, true)], 'Dry weight. USDA pigeon peas.')
usda('moong-dal-raw', 'Moong dal, raw', ['moong dal raw', 'green gram', 'mung'], 'moong', [P('1/4 cup', 50, true)], 'USDA whole mung beans; split yellow moong is very similar.')
usda('masoor-dal-raw', 'Masoor dal, raw', ['masoor dal raw', 'red lentil', 'lal masoor'], 'masoor', [P('1/4 cup', 50, true)])
usda('chana-raw', 'Chana / chickpeas, raw', ['kabuli chana', 'chole raw', 'chickpeas', 'chana dal raw', 'bengal gram'], 'chana', [P('1/4 cup', 50, true)], 'USDA chickpeas (kabuli). Desi chana and chana dal have less fat (~5%).')
usda('urad-dal-raw', 'Urad dal, raw', ['urad', 'black gram', 'udad', 'ulundu'], 'urad', [P('1/4 cup', 50, true)])
usda('rajma-raw', 'Rajma (kidney beans), raw', ['rajma', 'kidney beans', 'red beans'], 'rajma', [P('1/4 cup', 50, true)])
usda('rajma-boiled', 'Rajma (kidney beans), boiled', ['rajma boiled', 'kidney beans cooked'], 'rajma_boiled', [P('1 katori', 150, true)])
usda('chickpeas-boiled', 'Chickpeas, boiled', ['boiled chana', 'chole boiled', 'kabuli chana boiled'], 'chickpeas_boiled', [P('1 katori', 150, true)])
usda('moong-sprouts-raw', 'Moong sprouts, raw', ['sprouts', 'ankurit moong', 'mung sprouts'], 'moong_sprouts', [P('1 katori', 100, true)])
single('soy-flour-defatted', 'Soy flour, defatted', ['soy flour', 'soya atta'], 'soy_flour', [P('2 tbsp', 15, true)], 'measured', USDA(174275))
add({ id: 'roasted-chana', name: 'Roasted chana (bhuna chana)', aliases: ['bhuna chana', 'roasted gram', 'chana', 'phutana', 'pottukadalai'], category: 'indian_home',
  per100g: per100(blend([['chana', 1.03]])), portions: [P('1 handful', 30, true), P('1 katori', 60)], source: { name: 'Derived from USDA FoodData Central', ref: 'FDC 173756' }, confidence: 'estimate',
  notes: 'USDA raw chickpeas adjusted for ~3% roasting moisture loss. Desi roasted chana has less fat.' })

// Nuts and seeds
usda('almonds', 'Almonds', ['badam', 'almond'], 'almond', [P('10 almonds', 12, true), P('1 handful', 25)])
usda('cashews', 'Cashews', ['kaju', 'cashew'], 'cashew', [P('10 cashews', 15, true), P('1 handful', 25)])
usda('walnuts', 'Walnuts', ['akhrot', 'walnut'], 'walnut', [P('4 halves', 8, true), P('1 handful', 25)])
usda('pistachios', 'Pistachios', ['pista'], 'pistachio', [P('15 pistachios', 12, true)])
usda('peanuts-raw', 'Peanuts, raw', ['moongphali', 'groundnut', 'shengdana', 'peanut'], 'peanut', [P('1 handful', 30, true)])
usda('peanuts-roasted', 'Peanuts, roasted', ['roasted peanuts', 'moongphali', 'groundnut'], 'peanut_roasted', [P('1 handful', 30, true)])
usda('coconut-fresh', 'Coconut, fresh', ['nariyal', 'coconut', 'thengai'], 'coconut', [P('2 tbsp grated', 20, true)])
usda('coconut-dry', 'Coconut, dry (desiccated)', ['sukha nariyal', 'copra', 'desiccated coconut'], 'coconut_dry', [P('1 tbsp', 7, true)])
usda('flax-seeds', 'Flax seeds', ['alsi', 'flaxseed', 'linseed'], 'flax', [P('1 tbsp', 10, true)])
usda('chia-seeds', 'Chia seeds', ['chia'], 'chia', [P('1 tbsp', 12, true)])
usda('pumpkin-seeds', 'Pumpkin seeds', ['kaddu ke beej', 'pepitas'], 'pumpkin_seed', [P('1 tbsp', 10, true)])
usda('sunflower-seeds', 'Sunflower seeds', ['surajmukhi beej'], 'sunflower_seed', [P('1 tbsp', 10, true)])
usda('sesame-seeds', 'Sesame seeds', ['til', 'gingelly'], 'sesame', [P('1 tbsp', 9, true)])

// Fruits (edible portion)
usda('banana', 'Banana', ['kela', 'banana', 'pazham'], 'banana', [P('1 medium', 100, true), P('1 large', 130)], 'Edible part, peel removed.')
usda('apple', 'Apple', ['seb', 'saeb', 'apple'], 'apple', [P('1 medium', 150, true)])
usda('mango', 'Mango', ['aam', 'mango', 'alphonso'], 'mango', [P('1 medium (flesh)', 150, true), P('1 cup slices', 165)])
usda('papaya', 'Papaya', ['papita', 'papaya'], 'papaya', [P('1 cup cubes', 145, true)])
usda('orange', 'Orange', ['santra', 'narangi', 'orange', 'mosambi'], 'orange', [P('1 medium', 130, true)], 'Mosambi (sweet lime) is similar.')
usda('guava', 'Guava', ['amrood', 'peru', 'guava'], 'guava', [P('1 medium', 100, true)])
usda('grapes', 'Grapes', ['angoor', 'grapes'], 'grapes', [P('1 cup', 150, true)])
usda('pomegranate', 'Pomegranate', ['anaar', 'pomegranate'], 'pomegranate', [P('1 cup seeds', 175, true)])
usda('watermelon', 'Watermelon', ['tarbooz', 'watermelon'], 'watermelon', [P('1 cup cubes', 150, true)])
usda('pineapple', 'Pineapple', ['ananas', 'pineapple'], 'pineapple', [P('1 cup cubes', 165, true)])
usda('dates', 'Dates', ['khajoor', 'khajur', 'dates'], 'dates', [P('2 dates', 15, true)])
usda('muskmelon', 'Muskmelon', ['kharbooja', 'cantaloupe'], 'muskmelon', [P('1 cup cubes', 160, true)])
usda('kiwi', 'Kiwi', ['kiwi'], 'kiwi', [P('1 kiwi', 70, true)])

// Vegetables (raw)
usda('potato-raw', 'Potato, raw', ['aloo', 'batata', 'potato'], 'potato', [P('1 medium', 150, true)])
usda('potato-boiled', 'Potato, boiled', ['boiled aloo', 'ubla aloo'], 'potato_boiled', [P('1 medium', 130, true)])
usda('sweet-potato-raw', 'Sweet potato, raw', ['shakarkandi', 'sweet potato'], 'sweet_potato', [P('1 medium', 130, true)])
usda('onion-raw', 'Onion, raw', ['pyaaz', 'kanda', 'onion'], 'onion', [P('1 medium', 110, true)])
usda('tomato-raw', 'Tomato, raw', ['tamatar', 'tomato'], 'tomato', [P('1 medium', 100, true)])
usda('cucumber-raw', 'Cucumber, raw', ['kheera', 'kakdi', 'cucumber'], 'cucumber', [P('1 medium', 150, true)])
usda('carrot-raw', 'Carrot, raw', ['gajar', 'carrot'], 'carrot', [P('1 medium', 60, true)])
usda('spinach-raw', 'Spinach, raw', ['palak', 'spinach'], 'spinach', [P('1 bunch (cleaned)', 200, true)])
usda('cauliflower-raw', 'Cauliflower, raw', ['gobi', 'phool gobhi', 'cauliflower'], 'cauliflower', [P('1 cup florets', 100, true)])
usda('cabbage-raw', 'Cabbage, raw', ['patta gobhi', 'bandh gobhi', 'cabbage'], 'cabbage', [P('1 cup shredded', 90, true)])
usda('okra-raw', 'Okra (bhindi), raw', ['bhindi', 'lady finger', 'okra'], 'okra', [P('1 cup', 100, true)])
usda('brinjal-raw', 'Brinjal, raw', ['baingan', 'eggplant', 'vangi', 'brinjal'], 'brinjal', [P('1 medium', 150, true)])
usda('lauki-raw', 'Bottle gourd (lauki), raw', ['lauki', 'ghiya', 'dudhi', 'bottle gourd'], 'lauki', [P('1 cup', 120, true)])
usda('green-peas-raw', 'Green peas, raw', ['matar', 'peas', 'hara matar'], 'peas', [P('1/2 cup', 70, true)])
usda('french-beans-raw', 'French beans, raw', ['beans', 'farsi', 'green beans'], 'beans', [P('1 cup', 100, true)])
usda('capsicum-raw', 'Capsicum, raw', ['shimla mirch', 'bell pepper', 'capsicum'], 'capsicum', [P('1 medium', 120, true)])
usda('mushroom-raw', 'Mushroom, raw', ['khumb', 'mushroom'], 'mushroom', [P('1 cup', 70, true)])
usda('sweet-corn-raw', 'Sweet corn, raw', ['bhutta', 'makka', 'sweet corn', 'corn'], 'corn', [P('1 cob (kernels)', 100, true), P('1/2 cup kernels', 75)])
usda('broccoli-raw', 'Broccoli, raw', ['broccoli'], 'broccoli', [P('1 cup', 90, true)])
usda('beetroot-raw', 'Beetroot, raw', ['chukandar', 'beetroot'], 'beetroot', [P('1 medium', 80, true)])
usda('pumpkin-raw', 'Pumpkin, raw', ['kaddu', 'sitaphal', 'pumpkin'], 'pumpkin', [P('1 cup', 115, true)])

// Fats, sugar, spreads
usda('ghee', 'Ghee', ['ghee', 'desi ghee', 'clarified butter', 'neyyi'], 'ghee', [P('1 tsp', 5, true), P('1 tbsp', 14)])
usda('butter', 'Butter', ['makhan', 'butter', 'amul butter'], 'butter', [P('1 tsp', 5, true), P('1 tbsp', 14)])
usda('oil-vegetable', 'Cooking oil (vegetable)', ['oil', 'tel', 'refined oil', 'sunflower oil', 'soybean oil'], 'oil', [P('1 tsp', 5, true), P('1 tbsp', 14)], 'All plain cooking oils are ~884 kcal / 100 g.')
usda('oil-mustard', 'Mustard oil', ['sarson ka tel', 'mustard oil', 'kachi ghani'], 'mustard_oil', [P('1 tsp', 5, true), P('1 tbsp', 14)])
usda('oil-coconut', 'Coconut oil', ['nariyal tel', 'coconut oil'], 'coconut_oil', [P('1 tsp', 5, true), P('1 tbsp', 14)])
usda('oil-olive', 'Olive oil', ['olive oil'], 'olive_oil', [P('1 tsp', 5, true), P('1 tbsp', 14)])
usda('sugar', 'Sugar', ['cheeni', 'shakkar', 'sugar'], 'sugar', [P('1 tsp', 5, true), P('1 tbsp', 13)])
single('jaggery', 'Jaggery (gur)', ['gur', 'gud', 'jaggery', 'bellam', 'vellam'], 'jaggery', [P('1 small piece', 10, true)], 'estimate',
  EST_SRC('TrackFit estimate (typical cane jaggery)'), 'Not in USDA; nearly all sugar.')
usda('honey', 'Honey', ['shahad', 'madhu', 'honey'], 'honey', [P('1 tsp', 7, true), P('1 tbsp', 21)])
usda('ketchup', 'Tomato ketchup', ['ketchup', 'tomato sauce'], 'ketchup', [P('1 tbsp', 15, true)])
usda('mayonnaise', 'Mayonnaise', ['mayo', 'mayonnaise'], 'mayo', [P('1 tbsp', 14, true)])
usda('dark-chocolate', 'Dark chocolate (70-85%)', ['dark chocolate', 'chocolate'], 'dark_choc', [P('2 squares', 20, true)])

// ===========================================================================
// 5. INDIAN HOME — standard recipes. Oil = moderate home amount, stated in notes.
//    "1 tsp" oil = 5 g. Katori = 150 g for wet dishes, 100 g for dry sabzi.
// ===========================================================================
const DAL_PORTIONS = [KATORI(), P('1 small katori', 100), BOWL]
const TADKA = (oil = 15) => [['onion', 40], ['tomato', 60], ['ghee', oil]]

// --- Dals and curries of pulses (100 g dry pulse -> ~500 g medium-consistency dal)
recipe({ id: 'toor-dal-cooked', name: 'Toor dal, cooked', aliases: ['arhar dal', 'tuvar dal', 'dal', 'daal', 'dal tadka', 'pappu', 'yellow dal'],
  ing: [['toor', 100], ...TADKA()], cooked: 500, portions: DAL_PORTIONS, notes: 'Medium consistency; tadka with 1 tsp ghee per katori. Thicker dal has more per katori.' })
recipe({ id: 'moong-dal-cooked', name: 'Moong dal, cooked', aliases: ['yellow moong dal', 'dhuli moong', 'dal', 'daal', 'pesara pappu'],
  ing: [['moong', 100], ...TADKA()], cooked: 500, portions: DAL_PORTIONS, notes: 'Split yellow moong, medium consistency, 1 tsp ghee per katori.' })
recipe({ id: 'masoor-dal-cooked', name: 'Masoor dal, cooked', aliases: ['lal masoor', 'red lentil dal', 'dal', 'daal', 'mosur dal'],
  ing: [['masoor', 100], ...TADKA()], cooked: 500, portions: DAL_PORTIONS, notes: 'Medium consistency, 1 tsp ghee per katori.' })
recipe({ id: 'chana-dal-cooked', name: 'Chana dal, cooked', aliases: ['chana dal', 'bengal gram dal', 'dal', 'daal', 'cholar dal'],
  ing: [['chana', 100], ...TADKA()], cooked: 450, portions: DAL_PORTIONS, notes: 'Thicker dal; ~1 tsp ghee per katori. USDA kabuli chickpea values used for chana.' })
recipe({ id: 'urad-dal-cooked', name: 'Urad dal, cooked', aliases: ['dhuli urad', 'maa ki dal', 'dal', 'daal', 'urad'],
  ing: [['urad', 100], ...TADKA()], cooked: 450, portions: DAL_PORTIONS, notes: '1 tsp ghee per katori.' })
recipe({ id: 'mixed-dal-cooked', name: 'Mixed dal (panchmel), cooked', aliases: ['panchmel dal', 'mixed dal', 'dal', 'daal'],
  ing: [['toor', 30], ['moong', 25], ['masoor', 20], ['chana', 15], ['urad', 10], ...TADKA()], cooked: 480, portions: DAL_PORTIONS, notes: '1 tsp ghee per katori.' })
recipe({ id: 'dal-fry', name: 'Dal fry (home)', aliases: ['dal fry', 'tadka dal', 'dal', 'daal'],
  ing: [['toor', 70], ['moong', 30], ['onion', 60], ['tomato', 80], ['oil', 15], ['ghee', 5]], cooked: 480, portions: DAL_PORTIONS, notes: 'About 1.5 tsp oil/ghee per katori.' })
recipe({ id: 'whole-moong-dal', name: 'Whole moong dal (sabut moong)', aliases: ['sabut moong', 'green moong dal', 'hare moong', 'dal'],
  ing: [['moong', 100], ...TADKA()], cooked: 520, portions: DAL_PORTIONS, notes: '1 tsp ghee per katori.' })
recipe({ id: 'dal-makhani-home', name: 'Dal makhani (home)', aliases: ['dal makhani', 'kaali dal', 'maa ki dal', 'makhani dal'],
  ing: [['urad', 80], ['rajma', 20], ['onion', 50], ['tomato', 120], ['butter', 15], ['cream', 20]], cooked: 560, portions: DAL_PORTIONS, notes: 'Lighter home version: ~1 tsp butter + 1 tsp cream per katori. Restaurant version is separate.' })
recipe({ id: 'rajma-curry', name: 'Rajma curry', aliases: ['rajma', 'rajmah', 'kidney bean curry', 'rajma masala'],
  ing: [['rajma', 100], ['onion', 60], ['tomato', 120], ['oil', 15]], cooked: 520, portions: DAL_PORTIONS, notes: '1 tsp oil per katori.' })
recipe({ id: 'chole-home', name: 'Chole (chana masala)', aliases: ['chole', 'chhole', 'chana masala', 'kabuli chana', 'chickpea curry'],
  ing: [['chana', 100], ['onion', 70], ['tomato', 120], ['oil', 15]], cooked: 500, portions: DAL_PORTIONS, notes: '1 tsp oil per katori.' })
recipe({ id: 'kala-chana-curry', name: 'Kala chana curry', aliases: ['kala chana', 'black chana', 'desi chana curry'],
  ing: [['chana', 100], ['onion', 60], ['tomato', 100], ['oil', 15]], cooked: 480, portions: DAL_PORTIONS, notes: 'USDA kabuli chickpea values used; desi chana has more fibre, less fat.' })
recipe({ id: 'sambar', name: 'Sambar', aliases: ['sambhar', 'saambar', 'sambar'],
  ing: [['toor', 50], ['pumpkin', 50], ['brinjal', 50], ['onion', 40], ['tomato', 60], ['tamarind', 10], ['oil', 10]], cooked: 650, portions: [KATORI(), BOWL, P('1 small cup (with idli)', 100)], notes: 'With vegetables; ~1 tsp oil per 2 katoris.' })
recipe({ id: 'rasam', name: 'Rasam', aliases: ['rasam', 'saaru', 'charu'],
  ing: [['toor', 15], ['tomato', 150], ['tamarind', 10], ['ghee', 5]], cooked: 600, portions: [KATORI(), P('1 glass', 200)], notes: 'Thin soup; small amount of dal and ghee.' })
recipe({ id: 'kadhi', name: 'Kadhi (without pakoras)', aliases: ['kadhi', 'kadi', 'majjige huli', 'mor kuzhambu'],
  ing: [['curd', 200], ['besan', 30], ['oil', 10]], cooked: 500, portions: [KATORI(), BOWL], notes: '2 tsp oil for the whole pot. Add pakoras separately.' })
recipe({ id: 'kadhi-pakora', name: 'Kadhi pakora', aliases: ['kadhi pakoda', 'punjabi kadhi', 'kadhi'],
  ing: [['curd', 200], ['besan', 60], ['onion', 30], ['oil', 30]], cooked: 560, portions: [KATORI(), BOWL], notes: 'Includes deep-fried besan pakoras (oil absorbed estimated at ~20 g).' })

// --- Breads
recipe({ id: 'roti-phulka', name: 'Roti / phulka (no ghee)', aliases: ['roti', 'chapati', 'chapathi', 'phulka', 'fulka', 'rotli', 'poli'],
  ing: [['atta', 100]], cooked: 133, portions: [P('1 roti', 40, true), P('2 rotis', 80), P('1 small roti', 30)], notes: '1 medium roti = ~30 g atta, ~40 g cooked. No ghee.' })
recipe({ id: 'chapati-with-ghee', name: 'Chapati with ghee', aliases: ['ghee roti', 'chapati', 'chapathi', 'roti with ghee', 'chupri roti'],
  ing: [['atta', 100], ['ghee', 8]], cooked: 141, portions: [P('1 chapati', 42, true), P('2 chapatis', 84)], notes: 'About 1/2 tsp ghee spread per chapati.' })
recipe({ id: 'paratha-plain', name: 'Paratha, plain', aliases: ['paratha', 'parantha', 'parotta', 'lachha paratha home', 'tawa paratha'],
  ing: [['atta', 100], ['ghee', 15]], cooked: 150, portions: [P('1 paratha', 75, true), P('2 parathas', 150)], notes: '~1.5 tsp ghee/oil per paratha (layers + tawa).' })
recipe({ id: 'aloo-paratha', name: 'Aloo paratha', aliases: ['aloo paratha', 'alu parantha', 'potato paratha', 'paratha'],
  ing: [['atta', 100], ['potato_boiled', 120], ['onion', 10], ['ghee', 20]], cooked: 280, portions: [P('1 paratha', 120, true), P('2 parathas', 240)], notes: '~2 tsp ghee/oil per paratha. Butter on top not included.' })
recipe({ id: 'gobi-paratha', name: 'Gobi paratha', aliases: ['gobhi paratha', 'cauliflower paratha', 'paratha'],
  ing: [['atta', 100], ['cauliflower', 120], ['ghee', 20]], cooked: 260, portions: [P('1 paratha', 110, true)], notes: '~2 tsp ghee/oil per paratha.' })
recipe({ id: 'paneer-paratha', name: 'Paneer paratha', aliases: ['paneer parantha', 'paratha'],
  ing: [['atta', 100], ['paneer', 80], ['onion', 15], ['ghee', 20]], cooked: 250, portions: [P('1 paratha', 115, true)], notes: '~2 tsp ghee/oil per paratha.' })
recipe({ id: 'methi-thepla', name: 'Methi thepla', aliases: ['thepla', 'methi thepla', 'methi paratha'],
  ing: [['atta', 80], ['besan', 20], ['spinach', 30], ['curd', 15], ['oil', 15]], cooked: 175, portions: [P('1 thepla', 40, true), P('3 theplas', 120)], notes: 'Spinach used as proxy for methi leaves. ~1/2 tsp oil each.' })
recipe({ id: 'puri', name: 'Puri', aliases: ['poori', 'puri', 'luchi'],
  ing: [['atta', 100], ['oil', 25]], cooked: 140, portions: [P('1 puri', 25, true), P('4 puris', 100)], notes: 'Deep fried; oil absorbed estimated at ~18% of cooked weight.' })
recipe({ id: 'naan-home', name: 'Naan (home, tawa)', aliases: ['naan', 'nan', 'tawa naan'],
  ing: [['maida', 100], ['curd', 15], ['oil', 5]], cooked: 145, portions: [P('1 naan', 90, true)], notes: 'Made at home on tawa; no butter on top.' })
recipe({ id: 'makki-roti', name: 'Makki ki roti', aliases: ['makki roti', 'makki di roti', 'corn roti'],
  ing: [['cornmeal', 100], ['ghee', 10]], cooked: 140, portions: [P('1 roti', 60, true)], notes: 'Maize flour (USDA whole-grain cornmeal); ~1 tsp ghee per roti.' })
recipe({ id: 'bajra-roti', name: 'Bajra roti', aliases: ['bajra rotla', 'bajre ki roti', 'pearl millet roti', 'sajje rotti'],
  ing: [['bajra', 100]], cooked: 140, portions: [P('1 roti', 50, true)], notes: 'No ghee. USDA millet flour.' })
recipe({ id: 'jowar-roti', name: 'Jowar roti / bhakri', aliases: ['jowar roti', 'jolada rotti', 'bhakri', 'sorghum roti'],
  ing: [['jowar', 100]], cooked: 140, portions: [P('1 roti', 50, true)], notes: 'No ghee. USDA sorghum flour.' })

// --- Rice dishes (100 g raw rice -> ~280-300 g cooked)
recipe({ id: 'jeera-rice', name: 'Jeera rice', aliases: ['jeera rice', 'zeera rice', 'cumin rice'],
  ing: [['rice', 100], ['ghee', 10]], cooked: 295, portions: [KATORI(), PLATE(250)], notes: '~1 tsp ghee per katori.' })
recipe({ id: 'khichdi', name: 'Khichdi (moong dal)', aliases: ['khichdi', 'khichri', 'kichdi', 'pongal (salt)'],
  ing: [['rice', 60], ['moong', 40], ['ghee', 10]], cooked: 450, portions: [KATORI(), BOWL], notes: 'Soft khichdi, ~1 tsp ghee per bowl.' })
recipe({ id: 'veg-khichdi', name: 'Vegetable khichdi', aliases: ['masala khichdi', 'veg khichdi', 'khichdi'],
  ing: [['rice', 60], ['moong', 40], ['peas', 30], ['carrot', 30], ['potato', 30], ['onion', 30], ['ghee', 12]], cooked: 560, portions: [KATORI(), BOWL], notes: '~1 tsp ghee per bowl.' })
recipe({ id: 'curd-rice', name: 'Curd rice', aliases: ['dahi chawal', 'thayir sadam', 'mosaranna', 'perugu annam', 'curd rice'],
  ing: [['rice_cooked', 200], ['curd', 150], ['milk', 30], ['oil', 5]], cooked: 385, portions: [KATORI(), BOWL], notes: 'Tempering with 1 tsp oil.' })
recipe({ id: 'veg-pulao', name: 'Vegetable pulao', aliases: ['pulao', 'pulav', 'veg pulao', 'tahiri'],
  ing: [['rice', 100], ['peas', 40], ['carrot', 40], ['beans', 20], ['onion', 30], ['ghee', 12]], cooked: 400, portions: [KATORI(), PLATE(250)], notes: '~1 tsp ghee per katori.' })
recipe({ id: 'matar-pulao', name: 'Matar pulao', aliases: ['peas pulao', 'matar chawal', 'pulao'],
  ing: [['rice', 100], ['peas', 60], ['onion', 20], ['ghee', 10]], cooked: 380, portions: [KATORI(), PLATE(250)], notes: '~1 tsp ghee per katori.' })
recipe({ id: 'lemon-rice', name: 'Lemon rice', aliases: ['chitranna', 'elumichai sadam', 'nimmakaya pulihora', 'lemon rice'],
  ing: [['rice', 100], ['peanut', 15], ['oil', 12], ['lemon', 15]], cooked: 330, portions: [KATORI(), PLATE(250)], notes: 'With peanuts; ~1 tsp oil per katori.' })
recipe({ id: 'tamarind-rice', name: 'Tamarind rice (puliyogare)', aliases: ['puliyogare', 'puliodarai', 'pulihora', 'imli chawal'],
  ing: [['rice', 100], ['tamarind', 15], ['peanut', 10], ['oil', 15]], cooked: 330, portions: [KATORI(), PLATE(250)], notes: '~1.5 tsp oil per katori.' })
recipe({ id: 'egg-fried-rice-home', name: 'Egg fried rice (home)', aliases: ['egg rice', 'anda rice', 'fried rice'],
  ing: [['rice', 100], ['egg', 100], ['onion', 30], ['capsicum', 30], ['oil', 12]], cooked: 430, portions: [KATORI(), PLATE(250)], notes: '2 eggs per 100 g rice; ~1 tsp oil per katori.' })
recipe({ id: 'chicken-pulao-home', name: 'Chicken pulao (home)', aliases: ['chicken pulao', 'yakhni pulao', 'chicken rice'],
  ing: [['rice', 100], ['chicken_thigh', 150], ['onion', 50], ['curd', 30], ['ghee', 15]], cooked: 480, portions: [KATORI(), PLATE(300)], notes: 'Boneless weight. ~1.5 tsp ghee per plate.' })

// --- Dry sabzis (katori = 100 g)
const SABZI_PORTIONS = [KATORI_DRY(), P('1 serving spoon', 50)]
recipe({ id: 'aloo-sabzi', name: 'Aloo sabzi (dry)', aliases: ['aloo ki sabzi', 'sukhi aloo', 'jeera aloo', 'potato sabzi', 'batata bhaji'],
  ing: [['potato', 300], ['onion', 30], ['tomato', 40], ['oil', 15]], cooked: 330, portions: SABZI_PORTIONS, notes: '~1 tsp oil per katori.' })
recipe({ id: 'bhindi-sabzi', name: 'Bhindi sabzi', aliases: ['bhindi', 'bhindi masala', 'okra fry', 'bhendi', 'vendakkai poriyal'],
  ing: [['okra', 300], ['onion', 50], ['oil', 20]], cooked: 250, portions: SABZI_PORTIONS, notes: '~1.5 tsp oil per katori.' })
recipe({ id: 'aloo-gobi', name: 'Aloo gobi', aliases: ['aloo gobhi', 'gobi aloo', 'cauliflower potato'],
  ing: [['cauliflower', 200], ['potato', 150], ['onion', 30], ['tomato', 40], ['oil', 20]], cooked: 380, portions: SABZI_PORTIONS, notes: '~1 tsp oil per katori.' })
recipe({ id: 'gobi-sabzi', name: 'Gobi sabzi', aliases: ['gobhi', 'phool gobhi sabzi', 'cauliflower sabzi'],
  ing: [['cauliflower', 350], ['onion', 30], ['tomato', 40], ['oil', 15]], cooked: 340, portions: SABZI_PORTIONS, notes: '~1 tsp oil per katori.' })
recipe({ id: 'palak-sabzi', name: 'Aloo palak', aliases: ['aloo palak', 'palak aloo', 'palak sabzi', 'spinach potato'],
  ing: [['spinach', 400], ['potato', 100], ['onion', 40], ['oil', 15]], cooked: 360, portions: SABZI_PORTIONS, notes: '~1 tsp oil per katori.' })
recipe({ id: 'mixed-veg', name: 'Mixed vegetable sabzi', aliases: ['mix veg', 'mixed veg', 'subzi', 'sabji', 'sabzi'],
  ing: [['carrot', 80], ['beans', 80], ['peas', 60], ['potato', 80], ['cauliflower', 80], ['onion', 40], ['tomato', 60], ['oil', 20]], cooked: 460, portions: SABZI_PORTIONS, notes: '~1 tsp oil per katori.' })
recipe({ id: 'baingan-bharta', name: 'Baingan bharta', aliases: ['baingan bharta', 'brinjal bharta', 'begun pora', 'vangyache bharit'],
  ing: [['brinjal', 400], ['onion', 60], ['tomato', 80], ['oil', 15]], cooked: 380, portions: SABZI_PORTIONS, notes: 'Roasted brinjal; ~1 tsp oil per katori. Mustard oil version is the same.' })
recipe({ id: 'lauki-sabzi', name: 'Lauki sabzi', aliases: ['lauki', 'ghiya', 'dudhi bhaji', 'bottle gourd curry', 'sorakaya'],
  ing: [['lauki', 400], ['tomato', 40], ['oil', 10]], cooked: 380, portions: [KATORI(), P('1 small katori', 100)], notes: 'Semi-dry; ~1/2 tsp oil per katori.' })
recipe({ id: 'cabbage-sabzi', name: 'Cabbage sabzi', aliases: ['patta gobhi', 'bandh gobhi', 'cabbage poriyal', 'kobi'],
  ing: [['cabbage', 300], ['peas', 50], ['oil', 12]], cooked: 300, portions: SABZI_PORTIONS, notes: '~1 tsp oil per katori.' })
recipe({ id: 'beans-poriyal', name: 'Beans sabzi / poriyal', aliases: ['beans poriyal', 'french beans sabzi', 'beans thoran'],
  ing: [['beans', 300], ['coconut', 20], ['oil', 12]], cooked: 280, portions: SABZI_PORTIONS, notes: 'With grated coconut; ~1 tsp oil per katori.' })
recipe({ id: 'aloo-matar', name: 'Aloo matar (curry)', aliases: ['aloo mutter', 'aloo matar', 'potato peas curry'],
  ing: [['potato', 200], ['peas', 100], ['onion', 50], ['tomato', 100], ['oil', 20]], cooked: 600, portions: [KATORI(), BOWL], notes: 'Gravy; ~1 tsp oil per katori.' })
recipe({ id: 'mushroom-matar', name: 'Mushroom matar', aliases: ['mushroom masala', 'khumb matar', 'mushroom curry'],
  ing: [['mushroom', 250], ['peas', 100], ['onion', 60], ['tomato', 100], ['oil', 20]], cooked: 480, portions: [KATORI(), BOWL], notes: '~1 tsp oil per katori.' })
recipe({ id: 'soya-chunks-curry', name: 'Soya chunks curry', aliases: ['soya chunks', 'soya badi curry', 'nutrela curry', 'meal maker curry'],
  ing: [['soya_chunks', 60], ['onion', 60], ['tomato', 100], ['potato', 60], ['oil', 15]], cooked: 450, portions: [KATORI(), BOWL], notes: '60 g dry chunks; ~1 tsp oil per katori.' })
recipe({ id: 'chana-sprouts-sabzi', name: 'Sprouts sabzi (moong)', aliases: ['sprouts usal', 'moong usal', 'sprouts curry'],
  ing: [['moong_sprouts', 300], ['onion', 40], ['tomato', 40], ['oil', 10]], cooked: 320, portions: SABZI_PORTIONS, notes: '~1/2 tsp oil per katori.' })

// --- Paneer dishes (paneer value is an estimate, so these are estimates)
recipe({ id: 'paneer-bhurji', name: 'Paneer bhurji', aliases: ['paneer bhurji', 'scrambled paneer', 'paneer'],
  ing: [['paneer', 200], ['onion', 60], ['tomato', 60], ['capsicum', 30], ['oil', 15]], cooked: 330, portions: [KATORI_DRY(), P('1 plate', 200)], notes: '~1 tsp oil per katori.' })
recipe({ id: 'palak-paneer', name: 'Palak paneer', aliases: ['palak paneer', 'saag paneer', 'spinach paneer'],
  ing: [['spinach', 300], ['paneer', 150], ['onion', 50], ['tomato', 50], ['cream', 15], ['oil', 15]], cooked: 500, portions: [KATORI(), BOWL], notes: 'Home style: ~1 tsp oil + a little cream per katori.' })
recipe({ id: 'matar-paneer', name: 'Matar paneer', aliases: ['mutter paneer', 'matar paneer', 'peas paneer'],
  ing: [['paneer', 150], ['peas', 100], ['onion', 60], ['tomato', 120], ['oil', 20]], cooked: 560, portions: [KATORI(), BOWL], notes: 'Home gravy; ~1 tsp oil per katori.' })
recipe({ id: 'paneer-tikka-home', name: 'Paneer tikka (home, grilled)', aliases: ['paneer tikka', 'tandoori paneer', 'paneer'],
  ing: [['paneer', 200], ['curd', 50], ['capsicum', 50], ['onion', 50], ['oil', 8]], cooked: 320, portions: [P('6 pieces', 150, true), P('1 plate', 200)], notes: 'Grilled/air-fried, ~1/2 tsp oil per serving.' })
recipe({ id: 'kadai-paneer-home', name: 'Kadai paneer (home)', aliases: ['kadhai paneer', 'karahi paneer', 'paneer masala'],
  ing: [['paneer', 200], ['capsicum', 100], ['onion', 80], ['tomato', 120], ['oil', 20]], cooked: 480, portions: [KATORI(), BOWL], notes: '~1 tsp oil per katori.' })
recipe({ id: 'tofu-bhurji', name: 'Tofu bhurji', aliases: ['tofu scramble', 'tofu bhurji'],
  ing: [['tofu', 200], ['onion', 50], ['tomato', 50], ['oil', 10]], cooked: 290, portions: [KATORI_DRY(), P('1 plate', 200)], notes: '~1/2 tsp oil per katori.' })

// --- Egg dishes
recipe({ id: 'omelette', name: 'Omelette (masala, 2 eggs)', aliases: ['omelette', 'omelet', 'amlet', 'anda omelette', 'masala omelette'],
  ing: [['egg', 100], ['onion', 15], ['tomato', 10], ['oil', 5]], cooked: 120, portions: [P('2-egg omelette', 120, true), P('1-egg omelette', 60)], notes: '1 tsp oil per 2-egg omelette.' })
recipe({ id: 'egg-bhurji', name: 'Egg bhurji', aliases: ['anda bhurji', 'egg bhurji', 'scrambled eggs', 'egg podimas'],
  ing: [['egg', 150], ['onion', 40], ['tomato', 40], ['oil', 10]], cooked: 215, portions: [P('3-egg serving', 215, true), P('1 katori', 100)], notes: '2 tsp oil per 3 eggs.' })
recipe({ id: 'egg-curry', name: 'Egg curry', aliases: ['anda curry', 'egg masala', 'motte curry', 'dimer jhol'],
  ing: [['egg_boiled', 200], ['onion', 80], ['tomato', 120], ['oil', 20]], cooked: 520, portions: [P('1 katori (about 1 egg + gravy)', 150, true), P('2 eggs with gravy', 260)], notes: '4 eggs per pot; ~1 tsp oil per katori.' })
recipe({ id: 'fried-egg', name: 'Fried egg (half fry)', aliases: ['half fry', 'bullseye', 'sunny side up', 'fried egg'],
  ing: [['egg', 50], ['oil', 4]], cooked: 50, portions: [P('1 egg', 50, true)], notes: 'About 3/4 tsp oil per egg (some stays in the pan).' })
recipe({ id: 'egg-sandwich', name: 'Egg sandwich', aliases: ['anda sandwich', 'egg sandwich'],
  ing: [['bread_white', 50], ['egg_boiled', 50], ['butter', 5], ['onion', 10], ['tomato', 15]], cooked: 128, portions: [P('1 sandwich', 128, true)], notes: '2 slices, 1 egg, 1 tsp butter.' })

// --- Chicken, mutton, fish (home)
recipe({ id: 'chicken-curry-home', name: 'Chicken curry (home)', aliases: ['chicken curry', 'murgh curry', 'chicken masala', 'kozhi curry', 'chicken'],
  ing: [['chicken_thigh', 500], ['onion', 150], ['tomato', 150], ['curd', 50], ['oil', 30]], cooked: 850, portions: [P('1 katori (3-4 pieces)', 150, true), BOWL], notes: 'Boneless-equivalent weights; ~1 tsp oil per katori. Bone not counted in grams.' })
recipe({ id: 'chicken-breast-curry', name: 'Chicken breast curry (lean)', aliases: ['chicken breast curry', 'lean chicken curry'],
  ing: [['chicken_breast', 500], ['onion', 120], ['tomato', 150], ['curd', 50], ['oil', 20]], cooked: 800, portions: [KATORI(), BOWL], notes: '~2/3 tsp oil per katori.' })
recipe({ id: 'chicken-dry-home', name: 'Chicken dry / sukka (home)', aliases: ['chicken fry', 'chicken sukka', 'dry chicken', 'chicken roast'],
  ing: [['chicken_thigh', 500], ['onion', 100], ['oil', 30]], cooked: 470, portions: [P('1 katori', 100, true), P('1 plate', 200)], notes: '~1.5 tsp oil per katori.' })
recipe({ id: 'chicken-keema', name: 'Chicken keema', aliases: ['chicken mince', 'chicken kheema'],
  ing: [['chicken_thigh', 400], ['onion', 80], ['tomato', 80], ['peas', 50], ['oil', 20]], cooked: 520, portions: [KATORI(), P('1 small katori', 100)], notes: '~1 tsp oil per katori.' })
recipe({ id: 'mutton-curry-home', name: 'Mutton curry (home)', aliases: ['mutton curry', 'gosht', 'mutton masala', 'kosha mangsho', 'mutton'],
  ing: [['goat', 500], ['onion', 150], ['tomato', 100], ['curd', 50], ['oil', 35]], cooked: 750, portions: [P('1 katori (3-4 pieces)', 150, true), BOWL], notes: 'Boneless-equivalent; ~1.5 tsp oil per katori.' })
recipe({ id: 'keema-matar', name: 'Keema matar', aliases: ['keema', 'mutton keema', 'kheema pav (keema only)'],
  ing: [['goat', 200], ['lamb_mince', 200], ['peas', 80], ['onion', 80], ['tomato', 80], ['oil', 15]], cooked: 520, portions: [KATORI(), P('1 small katori', 100)], notes: 'Mince modelled as half lean goat, half fatty lamb mince; ~1 tsp oil per katori.' })
recipe({ id: 'fish-curry-home', name: 'Fish curry (home)', aliases: ['machli curry', 'macher jhol', 'meen curry', 'fish curry'],
  ing: [['carp', 500], ['onion', 100], ['tomato', 100], ['mustard_oil', 30]], cooked: 800, portions: [P('1 katori (2 pieces)', 150, true), BOWL], notes: '~1 tsp oil per katori. Carp/rohu values.' })
recipe({ id: 'fish-fry-tawa', name: 'Fish fry (tawa)', aliases: ['tawa fish', 'machli fry', 'meen varuval', 'fish fry'],
  ing: [['carp', 300], ['rice_flour', 15], ['oil', 20]], cooked: 260, portions: [P('1 piece', 80, true), P('2 pieces', 160)], notes: 'Shallow fried; ~1 tsp oil per piece absorbed.' })
recipe({ id: 'prawn-curry', name: 'Prawn curry', aliases: ['jhinga curry', 'chingri malai', 'prawn masala', 'royyala kura'],
  ing: [['prawn', 400], ['onion', 80], ['tomato', 100], ['coconut_milk', 60], ['oil', 20]], cooked: 600, portions: [KATORI(), BOWL], notes: 'With some coconut milk; ~1 tsp oil per katori.' })
recipe({ id: 'chicken-soup-home', name: 'Chicken soup (clear)', aliases: ['chicken soup', 'yakhni', 'chicken shorba'],
  ing: [['chicken_breast', 150], ['carrot', 40], ['onion', 40], ['butter', 5]], cooked: 500, portions: [P('1 bowl', 250, true)], notes: 'Clear soup with shredded chicken.' })

// --- Breakfast
recipe({ id: 'poha', name: 'Poha', aliases: ['kanda poha', 'aloo poha', 'pohe', 'avalakki', 'aval upma', 'chiwda'],
  ing: [['poha', 100], ['onion', 40], ['potato', 40], ['peanut', 15], ['oil', 12]], cooked: 330, portions: [P('1 plate', 200, true), KATORI(false)], notes: '~1.5 tsp oil per plate. Flattened rice uses raw rice values.' })
recipe({ id: 'upma', name: 'Upma (rava)', aliases: ['upma', 'uppittu', 'rava upma', 'suji upma', 'uppumavu'],
  ing: [['suji', 100], ['onion', 40], ['carrot', 20], ['peas', 20], ['oil', 15]], cooked: 400, portions: [P('1 plate', 200, true), KATORI(false)], notes: '~1.5 tsp oil per plate.' })
recipe({ id: 'oats-upma', name: 'Oats upma / masala oats (home)', aliases: ['oats upma', 'masala oats', 'oats poha', 'savoury oats'],
  ing: [['oats', 100], ['onion', 40], ['carrot', 30], ['peas', 30], ['oil', 10]], cooked: 380, portions: [P('1 bowl', 200, true)], notes: '~1 tsp oil per bowl.' })
recipe({ id: 'oats-milk-porridge', name: 'Oats porridge with milk', aliases: ['oats with milk', 'oatmeal', 'oats porridge', 'daliya oats'],
  ing: [['oats', 40], ['milk_toned', 200], ['sugar', 5]], cooked: 240, portions: [P('1 bowl', 240, true)], notes: '40 g oats, 200 ml toned milk, 1 tsp sugar.' })
recipe({ id: 'daliya-sweet', name: 'Daliya (sweet, with milk)', aliases: ['dalia', 'daliya', 'broken wheat porridge', 'lapsi'],
  ing: [['bulgur', 40], ['milk_toned', 200], ['sugar', 8]], cooked: 300, portions: [P('1 bowl', 250, true)], notes: 'USDA bulgur used for broken wheat.' })
recipe({ id: 'idli', name: 'Idli', aliases: ['idly', 'idli', 'iddli'],
  ing: [['rice', 75], ['urad', 25]], cooked: 260, portions: [P('1 idli', 40, true), P('3 idlis', 120)], notes: '3:1 rice to urad batter, no oil.' })
recipe({ id: 'dosa-plain', name: 'Dosa, plain', aliases: ['dosa', 'dosai', 'plain dosa', 'sada dosa', 'dose'],
  ing: [['rice', 75], ['urad', 25], ['oil', 8]], cooked: 200, portions: [P('1 dosa', 90, true), P('2 dosas', 180)], notes: 'Home dosa, ~1 tsp oil each.' })
recipe({ id: 'masala-dosa-home', name: 'Masala dosa (home)', aliases: ['masala dosa', 'aloo dosa', 'dosa'],
  ing: [['rice', 75], ['urad', 25], ['oil', 14], ['potato_boiled', 150], ['onion', 30]], cooked: 380, portions: [P('1 masala dosa', 190, true)], notes: 'Dosa + ~80 g potato masala; ~1.5 tsp oil per dosa.' })
recipe({ id: 'uttapam', name: 'Uttapam', aliases: ['uthappam', 'utappa', 'onion uttapam'],
  ing: [['rice', 75], ['urad', 25], ['onion', 40], ['tomato', 30], ['oil', 10]], cooked: 280, portions: [P('1 uttapam', 140, true)], notes: '~1 tsp oil each.' })
recipe({ id: 'rava-dosa', name: 'Rava dosa', aliases: ['rava dosa', 'suji dosa'],
  ing: [['suji', 50], ['rice_flour', 50], ['onion', 20], ['oil', 15]], cooked: 220, portions: [P('1 dosa', 100, true)], notes: '~1.5 tsp oil each (crisp).' })
recipe({ id: 'pesarattu', name: 'Pesarattu (moong dosa)', aliases: ['pesarattu', 'moong dosa', 'green gram dosa'],
  ing: [['moong', 100], ['onion', 20], ['oil', 10]], cooked: 250, portions: [P('1 dosa', 100, true)], notes: '~1 tsp oil each.' })
recipe({ id: 'besan-chilla', name: 'Besan chilla', aliases: ['besan cheela', 'chilla', 'pudla', 'gram flour pancake'],
  ing: [['besan', 100], ['onion', 30], ['tomato', 30], ['oil', 10]], cooked: 240, portions: [P('1 chilla', 60, true), P('2 chillas', 120)], notes: '~1/2 tsp oil each.' })
recipe({ id: 'moong-chilla', name: 'Moong dal chilla', aliases: ['moong chilla', 'moong dal cheela'],
  ing: [['moong', 100], ['onion', 30], ['oil', 10]], cooked: 250, portions: [P('1 chilla', 60, true), P('2 chillas', 120)], notes: '~1/2 tsp oil each.' })
recipe({ id: 'paneer-chilla', name: 'Paneer stuffed chilla', aliases: ['paneer cheela', 'chilla'],
  ing: [['besan', 100], ['paneer', 80], ['onion', 30], ['oil', 12]], cooked: 300, portions: [P('1 chilla', 100, true)], notes: '~1/2 tsp oil each.' })
recipe({ id: 'dhokla', name: 'Dhokla (khaman)', aliases: ['dhokla', 'khaman', 'khaman dhokla'],
  ing: [['besan', 100], ['curd', 30], ['sugar', 10], ['oil', 10]], cooked: 280, portions: [P('2 pieces', 60, true), P('1 plate (4 pieces)', 120)], notes: 'Steamed; tempering ~2 tsp oil per batch.' })
recipe({ id: 'veg-sandwich', name: 'Vegetable sandwich (home)', aliases: ['veg sandwich', 'bombay sandwich', 'sandwich'],
  ing: [['bread_white', 50], ['butter', 5], ['cucumber', 30], ['tomato', 30], ['potato_boiled', 30]], cooked: 145, portions: [P('1 sandwich', 145, true)], notes: '2 slices + 1 tsp butter.' })
recipe({ id: 'paneer-sandwich', name: 'Paneer sandwich (home)', aliases: ['paneer sandwich', 'sandwich'],
  ing: [['bread_brown', 56], ['paneer', 50], ['onion', 15], ['tomato', 20], ['butter', 5]], cooked: 146, portions: [P('1 sandwich', 146, true)], notes: 'Brown bread, 50 g paneer, 1 tsp butter.' })
recipe({ id: 'peanut-butter-toast', name: 'Peanut butter toast', aliases: ['pb toast', 'peanut butter bread'],
  ing: [['bread_brown', 28], ['peanut_butter', 16]], cooked: 44, portions: [P('1 slice', 44, true), P('2 slices', 88)], notes: '1 tbsp peanut butter per slice.' })
recipe({ id: 'bread-omelette', name: 'Bread omelette', aliases: ['bread omelette', 'bread amlet'],
  ing: [['bread_white', 50], ['egg', 100], ['onion', 15], ['butter', 5], ['oil', 5]], cooked: 170, portions: [P('1 serving', 170, true)], notes: '2 eggs, 2 slices, 1 tsp butter + 1 tsp oil.' })

// --- Curd, raita, salads
recipe({ id: 'cucumber-raita', name: 'Raita (cucumber)', aliases: ['raita', 'kheera raita', 'cucumber raita', 'pachadi'],
  ing: [['curd', 200], ['cucumber', 100]], cooked: 300, portions: [KATORI(), P('1 small katori', 100)], notes: 'Whole-milk curd.' })
recipe({ id: 'boondi-raita', name: 'Boondi raita', aliases: ['boondi raita', 'raita'],
  ing: [['curd', 200], ['besan', 15], ['oil', 8]], cooked: 230, portions: [KATORI(), P('1 small katori', 100)], notes: 'Fried boondi included (oil absorbed estimated).' })
recipe({ id: 'buttermilk', name: 'Buttermilk (chaas)', aliases: ['chaas', 'chaach', 'mattha', 'majjige', 'mor', 'buttermilk'],
  ing: [['curd_toned', 100], ['water', 200]], cooked: 300, portions: [P('1 glass', 250, true)], notes: '1 part curd : 2 parts water, salted, no sugar.' })
recipe({ id: 'lassi-sweet', name: 'Lassi, sweet', aliases: ['lassi', 'meethi lassi', 'sweet lassi'],
  ing: [['curd', 200], ['water', 50], ['sugar', 20]], cooked: 270, portions: [P('1 glass', 250, true)], notes: 'Whole-milk curd, 4 tsp sugar per glass.' })
recipe({ id: 'lassi-salted', name: 'Lassi, salted', aliases: ['namkeen lassi', 'salted lassi'],
  ing: [['curd', 200], ['water', 50]], cooked: 250, portions: [P('1 glass', 250, true)], notes: 'Whole-milk curd, no sugar.' })
recipe({ id: 'green-salad', name: 'Green salad (kachumber)', aliases: ['salad', 'kachumber', 'cucumber onion salad'],
  ing: [['cucumber', 100], ['tomato', 60], ['onion', 40], ['lemon', 5]], cooked: 205, portions: [P('1 bowl', 150, true)], notes: 'No oil or dressing.' })
recipe({ id: 'sprouts-chaat', name: 'Sprouts chaat', aliases: ['sprouts salad', 'moong sprouts chaat', 'ankurit chaat'],
  ing: [['moong_sprouts', 200], ['onion', 30], ['tomato', 30], ['potato_boiled', 30], ['lemon', 10]], cooked: 300, portions: [P('1 bowl', 150, true)], notes: 'No oil.' })
recipe({ id: 'chana-chaat', name: 'Chana chaat', aliases: ['chana salad', 'chickpea chaat'],
  ing: [['chickpeas_boiled', 200], ['onion', 30], ['tomato', 30], ['lemon', 10]], cooked: 270, portions: [P('1 bowl', 150, true)], notes: 'No oil.' })
recipe({ id: 'fruit-chaat', name: 'Fruit chaat', aliases: ['fruit salad', 'fruit chaat'],
  ing: [['apple', 100], ['banana', 100], ['papaya', 100], ['pomegranate', 50]], cooked: 350, portions: [P('1 bowl', 200, true)], notes: 'No sugar or cream.' })

// --- Snacks
recipe({ id: 'roasted-makhana', name: 'Makhana, roasted in ghee', aliases: ['roasted makhana', 'makhana', 'phool makhana'],
  ing: [['makhana', 50], ['ghee', 5]], cooked: 55, portions: [P('1 bowl', 25, true)], notes: '1 tsp ghee per 50 g.' })
recipe({ id: 'besan-pakora', name: 'Pakora (onion / mixed veg)', aliases: ['pakoda', 'bhajiya', 'bajji', 'onion pakora', 'pakore'],
  ing: [['besan', 100], ['onion', 150], ['oil', 45]], cooked: 260, portions: [P('4 pieces', 80, true), P('1 plate', 150)], notes: 'Deep fried; oil absorbed ~17% of cooked weight (estimate).', conf: 'estimate' })
recipe({ id: 'poha-chivda', name: 'Poha chivda (namkeen)', aliases: ['chivda', 'chiwda', 'poha namkeen', 'mixture'],
  ing: [['poha', 100], ['peanut', 30], ['oil', 25], ['sugar', 5]], cooked: 160, portions: [P('1 small katori', 30, true)], notes: 'Roasted/fried in oil.', conf: 'estimate' })
recipe({ id: 'murmura-bhel-home', name: 'Bhel (home, murmura)', aliases: ['bhel', 'jhal muri', 'murmura chaat'],
  ing: [['puffed_rice', 50], ['onion', 30], ['tomato', 30], ['peanut', 10], ['potato_boiled', 30], ['tamarind', 5]], cooked: 155, portions: [P('1 bowl', 155, true)], notes: 'No sev, no oil.' })
recipe({ id: 'peanut-chikki', name: 'Peanut chikki', aliases: ['chikki', 'gajak', 'peanut brittle'],
  ing: [['peanut_roasted', 60], ['jaggery', 45], ['ghee', 2]], cooked: 105, portions: [P('1 piece', 20, true)], notes: 'Jaggery value is an estimate.' })

// --- Sweets
recipe({ id: 'kheer', name: 'Kheer (rice)', aliases: ['kheer', 'payasam', 'payesh', 'chawal ki kheer'],
  ing: [['milk', 1000], ['rice', 40], ['sugar', 60]], cooked: 700, portions: [KATORI(false), P('1 small katori', 100, true)], notes: 'Whole milk reduced by ~1/3.' })
recipe({ id: 'suji-halwa', name: 'Suji halwa (sheera)', aliases: ['sooji halwa', 'sheera', 'kesari', 'rava kesari', 'halwa'],
  ing: [['suji', 100], ['ghee', 50], ['sugar', 100]], cooked: 450, portions: [P('1 small katori', 100, true)], notes: '1 part suji : 1/2 ghee : 1 sugar.' })
recipe({ id: 'gajar-halwa', name: 'Gajar halwa', aliases: ['gajar ka halwa', 'carrot halwa', 'halwa'],
  ing: [['carrot', 500], ['milk', 500], ['sugar', 100], ['ghee', 30]], cooked: 600, portions: [P('1 small katori', 100, true)], notes: 'Milk reduced; 2 tbsp ghee per 500 g carrots.' })
recipe({ id: 'besan-ladoo', name: 'Besan ladoo', aliases: ['besan laddu', 'ladoo', 'laddoo'],
  ing: [['besan', 100], ['ghee', 45], ['sugar', 90]], cooked: 232, portions: [P('1 ladoo', 35, true)], notes: 'Typical sweet-shop ratio.' })
recipe({ id: 'gulab-jamun', name: 'Gulab jamun', aliases: ['gulab jamun', 'gulabjamun', 'kala jamun'],
  ing: [['khoa', 100], ['maida', 25], ['oil', 25], ['sugar', 90]], cooked: 330, portions: [P('1 piece with syrup', 50, true), P('2 pieces', 100)], notes: 'Fried and soaked; syrup and oil uptake are estimates.', conf: 'estimate' })
recipe({ id: 'rasgulla', name: 'Rasgulla', aliases: ['rasgulla', 'rosogolla', 'roshogolla'],
  ing: [['paneer', 150], ['suji', 5], ['sugar', 180]], cooked: 600, portions: [P('1 piece with syrup', 50, true)], notes: 'Chhena (~ unpressed paneer, from 1 L milk) cooked in syrup; syrup uptake approximate.', conf: 'estimate' })
recipe({ id: 'kaju-katli', name: 'Kaju katli', aliases: ['kaju barfi', 'kaju katli', 'kaju'],
  ing: [['cashew', 100], ['sugar', 70], ['ghee', 3]], cooked: 170, portions: [P('1 piece', 15, true)], notes: 'Typical ratio.' })
recipe({ id: 'kheer-seviyan', name: 'Seviyan kheer', aliases: ['seviyan', 'semiya payasam', 'vermicelli kheer', 'sheer khurma'],
  ing: [['milk', 750], ['pasta', 40], ['sugar', 50], ['ghee', 5]], cooked: 600, portions: [P('1 small katori', 100, true)], notes: 'Wheat vermicelli (USDA dry pasta).' })

// --- Drinks
recipe({ id: 'chai-milk-sugar', name: 'Chai with milk and sugar', aliases: ['chai', 'tea', 'cha', 'masala chai', 'adrak chai', 'doodh wali chai'],
  ing: [['milk_toned', 60], ['water', 90], ['sugar', 8]], cooked: 130, portions: [P('1 cup', 130, true), P('1 cutting', 70)], notes: 'About 1/3 milk, 2 tsp sugar per cup.' })
recipe({ id: 'chai-no-sugar', name: 'Chai with milk, no sugar', aliases: ['chai', 'tea', 'sugar free chai', 'chai bina cheeni'],
  ing: [['milk_toned', 60], ['water', 90]], cooked: 130, portions: [P('1 cup', 130, true)], notes: 'About 1/3 milk.' })
recipe({ id: 'filter-coffee', name: 'Filter coffee with milk and sugar', aliases: ['filter coffee', 'kaapi', 'coffee', 'madras coffee'],
  ing: [['milk_toned', 100], ['water', 40], ['sugar', 8]], cooked: 140, portions: [P('1 tumbler', 140, true)], notes: 'Mostly milk, 2 tsp sugar.' })
recipe({ id: 'nimbu-pani', name: 'Nimbu pani (sweet)', aliases: ['nimbu paani', 'shikanji', 'lemonade', 'lime juice'],
  ing: [['lemon', 15], ['sugar', 15], ['water', 230]], cooked: 260, portions: [P('1 glass', 250, true)], notes: '3 tsp sugar per glass.' })
recipe({ id: 'banana-shake', name: 'Banana milkshake', aliases: ['banana shake', 'kela shake'],
  ing: [['banana', 100], ['milk_toned', 200], ['sugar', 10]], cooked: 310, portions: [P('1 glass', 300, true)], notes: '1 banana, 200 ml toned milk, 2 tsp sugar.' })
recipe({ id: 'haldi-doodh', name: 'Haldi doodh (turmeric milk)', aliases: ['haldi doodh', 'turmeric latte', 'golden milk'],
  ing: [['milk_toned', 250], ['sugar', 5]], cooked: 250, portions: [P('1 glass', 250, true)], notes: '1 tsp sugar.' })

// ===========================================================================
// 6. RESTAURANT — always 'estimate'. Restaurants use 2-3x the fat of home cooking and
//    recipes/portions vary widely; values model a typical North Indian / street-food
//    / quick-service version. Bone weight excluded.
// ===========================================================================
const R = (o) => recipe({ ...o, cat: 'restaurant' })
const RPLATE = (g, def = true) => P('1 plate', g, def)
const USDA_FAST = (fdc) => ({ name: 'USDA FoodData Central (SR Legacy, US fast-food composite)', ref: `FDC ${fdc}`, url: FDC_URL(fdc) })

// Biryani and rice
R({ id: 'chicken-biryani', name: 'Chicken biryani (restaurant)', aliases: ['biryani', 'biriyani', 'murgh biryani', 'hyderabadi biryani', 'chicken biryani'],
  ing: [['rice', 200], ['chicken_thigh', 250], ['onion', 100], ['curd', 60], ['oil', 35], ['ghee', 15]], cooked: 900, portions: [RPLATE(350), P('1 full handi', 600)], notes: 'Includes fried onions and ~1 tbsp oil/ghee per plate.' })
R({ id: 'mutton-biryani', name: 'Mutton biryani (restaurant)', aliases: ['mutton biryani', 'gosht biryani', 'biryani'],
  ing: [['rice', 200], ['goat', 250], ['onion', 100], ['curd', 60], ['oil', 35], ['ghee', 20]], cooked: 880, portions: [RPLATE(350)], notes: 'Boneless-equivalent meat; ~1 tbsp+ fat per plate.' })
R({ id: 'veg-biryani', name: 'Veg biryani (restaurant)', aliases: ['veg biryani', 'vegetable biryani', 'biryani'],
  ing: [['rice', 200], ['potato', 80], ['carrot', 50], ['beans', 50], ['peas', 50], ['onion', 100], ['curd', 50], ['oil', 35], ['ghee', 10]], cooked: 900, portions: [RPLATE(350)], notes: '~1 tbsp oil/ghee per plate.' })
R({ id: 'egg-biryani', name: 'Egg biryani (restaurant)', aliases: ['anda biryani', 'egg biryani', 'biryani'],
  ing: [['rice', 200], ['egg_boiled', 150], ['onion', 100], ['curd', 40], ['oil', 35], ['ghee', 10]], cooked: 820, portions: [RPLATE(350)], notes: '~2 eggs per plate.' })
R({ id: 'veg-fried-rice', name: 'Veg fried rice (Indo-Chinese)', aliases: ['fried rice', 'veg fried rice', 'chinese rice'],
  ing: [['rice', 100], ['cabbage', 40], ['carrot', 30], ['capsicum', 30], ['beans', 20], ['oil', 20], ['soy_sauce', 10]], cooked: 400, portions: [RPLATE(300)], notes: '~1 tbsp oil per plate.' })
R({ id: 'chicken-fried-rice', name: 'Chicken fried rice (Indo-Chinese)', aliases: ['chicken fried rice', 'fried rice'],
  ing: [['rice', 100], ['chicken_breast', 80], ['egg', 25], ['cabbage', 30], ['carrot', 20], ['oil', 20], ['soy_sauce', 10]], cooked: 440, portions: [RPLATE(300)], notes: '~1 tbsp oil per plate.' })

// Curries
R({ id: 'butter-chicken', name: 'Butter chicken', aliases: ['murgh makhani', 'butter chicken', 'chicken makhani'],
  ing: [['chicken_thigh', 300], ['tomato', 250], ['butter', 40], ['cream', 60], ['cashew', 15], ['oil', 10], ['sugar', 5]], cooked: 600, portions: [P('1 bowl', 200, true), P('1 full portion', 350)], notes: 'Butter + cream gravy; boneless tandoori chicken.' })
R({ id: 'chicken-tikka-masala', name: 'Chicken tikka masala', aliases: ['chicken tikka masala', 'ctm', 'tikka masala'],
  ing: [['chicken_breast', 300], ['tomato', 200], ['onion', 80], ['cream', 40], ['oil', 30], ['butter', 10]], cooked: 600, portions: [P('1 bowl', 200, true), P('1 full portion', 350)], notes: '~2 tbsp fat per pot of 3 portions.' })
R({ id: 'kadai-chicken', name: 'Kadai chicken (restaurant)', aliases: ['kadhai chicken', 'karahi chicken', 'chicken kadai'],
  ing: [['chicken_thigh', 300], ['capsicum', 80], ['onion', 100], ['tomato', 150], ['oil', 40]], cooked: 580, portions: [P('1 bowl', 200, true)], notes: 'Oily restaurant gravy.' })
R({ id: 'chicken-curry-restaurant', name: 'Chicken curry (restaurant)', aliases: ['chicken curry', 'murgh masala', 'chicken masala', 'chicken handi'],
  ing: [['chicken_thigh', 300], ['onion', 120], ['tomato', 120], ['oil', 40], ['cream', 15]], cooked: 600, portions: [P('1 bowl', 200, true)], notes: 'About twice the oil of the home version.' })
R({ id: 'mutton-rogan-josh', name: 'Mutton rogan josh / mutton curry (restaurant)', aliases: ['rogan josh', 'mutton curry', 'gosht curry', 'laal maas'],
  ing: [['goat', 300], ['onion', 120], ['curd', 60], ['oil', 45]], cooked: 550, portions: [P('1 bowl', 200, true)], notes: 'Boneless-equivalent; oily gravy.' })
R({ id: 'dal-makhani-restaurant', name: 'Dal makhani (restaurant)', aliases: ['dal makhani', 'dal makhni', 'kaali dal', 'makhani dal'],
  ing: [['urad', 80], ['rajma', 20], ['tomato', 120], ['butter', 40], ['cream', 50]], cooked: 600, portions: [P('1 bowl', 200, true)], notes: 'Generous butter and cream.' })
R({ id: 'dal-tadka-restaurant', name: 'Dal tadka (restaurant)', aliases: ['dal tadka', 'dal fry', 'yellow dal', 'dal'],
  ing: [['toor', 70], ['moong', 30], ['onion', 50], ['tomato', 80], ['ghee', 25], ['oil', 10]], cooked: 480, portions: [P('1 bowl', 200, true)], notes: '~2 tsp ghee/oil per bowl.' })
R({ id: 'paneer-butter-masala', name: 'Paneer butter masala', aliases: ['paneer makhani', 'paneer butter masala', 'pbm', 'paneer makhanwala'],
  ing: [['paneer', 200], ['tomato', 250], ['butter', 35], ['cream', 50], ['cashew', 15], ['sugar', 5]], cooked: 560, portions: [P('1 bowl', 200, true)], notes: 'Butter + cream + cashew gravy.' })
R({ id: 'shahi-paneer', name: 'Shahi paneer', aliases: ['shahi paneer', 'paneer korma', 'paneer lababdar'],
  ing: [['paneer', 200], ['onion', 80], ['curd', 50], ['cashew', 25], ['cream', 50], ['ghee', 25]], cooked: 520, portions: [P('1 bowl', 200, true)], notes: 'Rich white/korma gravy.' })
R({ id: 'kadai-paneer-restaurant', name: 'Kadai paneer (restaurant)', aliases: ['kadhai paneer', 'karahi paneer'],
  ing: [['paneer', 200], ['capsicum', 80], ['onion', 100], ['tomato', 150], ['oil', 35], ['cream', 15]], cooked: 520, portions: [P('1 bowl', 200, true)], notes: 'Oily restaurant gravy.' })
R({ id: 'palak-paneer-restaurant', name: 'Palak paneer (restaurant)', aliases: ['palak paneer', 'saag paneer'],
  ing: [['spinach', 300], ['paneer', 150], ['onion', 60], ['cream', 40], ['butter', 20], ['oil', 15]], cooked: 520, portions: [P('1 bowl', 200, true)], notes: 'Cream + butter finish.' })
R({ id: 'chole-restaurant', name: 'Chole (restaurant)', aliases: ['chole', 'chana masala', 'pindi chole', 'amritsari chole'],
  ing: [['chana', 100], ['onion', 80], ['tomato', 120], ['oil', 35]], cooked: 500, portions: [P('1 bowl', 200, true)], notes: 'About twice home oil.' })
R({ id: 'malai-kofta', name: 'Malai kofta', aliases: ['malai kofta', 'kofta curry'],
  ing: [['paneer', 100], ['potato_boiled', 100], ['maida', 15], ['oil', 40], ['cashew', 20], ['cream', 60], ['tomato', 100], ['onion', 60]], cooked: 520, portions: [P('1 bowl (2 koftas)', 220, true)], notes: 'Deep-fried koftas; oil uptake estimated.' })
R({ id: 'veg-kolhapuri', name: 'Mixed veg curry (restaurant)', aliases: ['veg kolhapuri', 'mix veg', 'veg jalfrezi', 'navratan korma', 'mixed vegetable curry'],
  ing: [['potato', 80], ['carrot', 60], ['beans', 60], ['peas', 60], ['cauliflower', 80], ['onion', 80], ['tomato', 100], ['oil', 35], ['cream', 15]], cooked: 560, portions: [P('1 bowl', 200, true)], notes: 'Oily gravy.' })

// Tandoor and kebabs
R({ id: 'chicken-tikka', name: 'Chicken tikka (dry)', aliases: ['chicken tikka', 'murgh tikka', 'tikka', 'malai tikka'],
  ing: [['chicken_breast', 400], ['curd', 60], ['oil', 15], ['butter', 10]], cooked: 330, portions: [P('6 pieces', 180, true), P('1 full plate (8 pcs)', 240)], notes: 'Boneless, basted with butter.' })
R({ id: 'tandoori-chicken', name: 'Tandoori chicken', aliases: ['tandoori murgh', 'tandoori chicken', 'tangdi kebab'],
  ing: [['chicken_thigh', 400], ['curd', 60], ['oil', 15], ['butter', 10]], cooked: 320, portions: [P('half (edible meat)', 200, true), P('1 leg piece (edible)', 100)], notes: 'Edible meat only; skin removed. Bone not counted.' })
R({ id: 'paneer-tikka-restaurant', name: 'Paneer tikka (restaurant)', aliases: ['paneer tikka', 'tandoori paneer', 'achari paneer tikka'],
  ing: [['paneer', 250], ['curd', 50], ['capsicum', 50], ['onion', 50], ['oil', 15], ['butter', 10]], cooked: 380, portions: [P('6 pieces', 180, true)], notes: 'Basted with butter/oil.' })
R({ id: 'seekh-kebab', name: 'Seekh kebab (mutton)', aliases: ['seekh kabab', 'sheekh kebab', 'kebab'],
  ing: [['goat', 150], ['lamb_mince', 150], ['onion', 40], ['oil', 10]], cooked: 240, portions: [P('2 kebabs', 100, true)], notes: 'Mince modelled as half lean goat, half fatty lamb mince.' })
R({ id: 'chicken-seekh-kebab', name: 'Chicken seekh kebab', aliases: ['chicken seekh', 'chicken kebab'],
  ing: [['chicken_thigh', 300], ['onion', 40], ['oil', 12]], cooked: 250, portions: [P('2 kebabs', 100, true)] })
R({ id: 'fish-tikka', name: 'Fish tikka / tandoori fish', aliases: ['fish tikka', 'tandoori fish', 'amritsari fish (grilled)'],
  ing: [['carp', 300], ['curd', 40], ['oil', 12]], cooked: 260, portions: [P('6 pieces', 150, true)] })

// Breads
R({ id: 'naan-restaurant', name: 'Naan (plain, tandoor)', aliases: ['naan', 'nan', 'plain naan', 'tandoori naan'],
  ing: [['maida', 100], ['curd', 15], ['milk', 15], ['oil', 5]], cooked: 140, portions: [P('1 naan', 100, true)], notes: 'Tandoor naan, no butter.' })
R({ id: 'butter-naan', name: 'Butter naan', aliases: ['butter naan', 'naan', 'makhani naan'],
  ing: [['maida', 100], ['curd', 15], ['milk', 15], ['oil', 5], ['butter', 10]], cooked: 150, portions: [P('1 naan', 110, true)], notes: '~1.5 tsp butter brushed per naan.' })
R({ id: 'garlic-naan', name: 'Garlic naan', aliases: ['garlic naan', 'lehsuni naan'],
  ing: [['maida', 100], ['curd', 15], ['milk', 15], ['oil', 5], ['butter', 10], ['garlic', 5]], cooked: 152, portions: [P('1 naan', 110, true)] })
R({ id: 'tandoori-roti', name: 'Tandoori roti', aliases: ['tandoori roti', 'tandoor roti', 'roti'],
  ing: [['atta', 100]], cooked: 135, portions: [P('1 roti', 60, true)], notes: 'Plain; add butter separately if brushed.' })
R({ id: 'laccha-paratha', name: 'Laccha paratha (restaurant)', aliases: ['lachha paratha', 'laccha parantha', 'paratha'],
  ing: [['atta', 50], ['maida', 50], ['ghee', 22]], cooked: 155, portions: [P('1 paratha', 90, true)], notes: 'Layered with ghee.' })
R({ id: 'kulcha', name: 'Kulcha (plain)', aliases: ['kulcha', 'amritsari kulcha (plain)'],
  ing: [['maida', 100], ['curd', 20], ['butter', 10], ['oil', 5]], cooked: 150, portions: [P('1 kulcha', 100, true)] })
R({ id: 'amritsari-kulcha', name: 'Amritsari kulcha (stuffed)', aliases: ['aloo kulcha', 'amritsari kulcha', 'stuffed kulcha'],
  ing: [['maida', 100], ['potato_boiled', 100], ['onion', 20], ['butter', 20], ['oil', 5]], cooked: 240, portions: [P('1 kulcha', 160, true)], notes: 'Potato stuffing, butter on top.' })
R({ id: 'bhatura', name: 'Bhatura', aliases: ['bhature', 'bhatoora', 'batura'],
  ing: [['maida', 100], ['curd', 20], ['oil', 30]], cooked: 155, portions: [P('1 bhatura', 80, true)], notes: 'Deep fried; oil uptake ~19% of cooked weight.' })
R({ id: 'chole-bhature', name: 'Chole bhature (plate)', aliases: ['chole bhature', 'chhole bhature', 'chole bhatura'],
  ing: [['maida', 100], ['curd', 20], ['oil', 30], ['chana', 50], ['onion', 40], ['tomato', 60], ['oil', 18]], cooked: 405, portions: [RPLATE(405)], notes: '2 bhature + 1 bowl chole (~250 g).' })

// Street food and snacks
R({ id: 'pav-bhaji', name: 'Pav bhaji (plate)', aliases: ['pav bhaji', 'pao bhaji', 'bhaji pav'],
  ing: [['potato', 150], ['cauliflower', 50], ['peas', 40], ['capsicum', 40], ['tomato', 100], ['onion', 50], ['butter', 30], ['bun', 100]], cooked: 520, portions: [RPLATE(400)], notes: 'Bhaji (~250 g) + 2 buttered pav; lots of butter.' })
R({ id: 'vada-pav', name: 'Vada pav', aliases: ['vada pav', 'wada pav', 'batata vada pav'],
  ing: [['bun', 50], ['potato_boiled', 70], ['besan', 15], ['oil', 14]], cooked: 145, portions: [P('1 vada pav', 145, true)], notes: 'Deep-fried batata vada in pav; chutneys excluded.' })
R({ id: 'samosa', name: 'Samosa', aliases: ['samosa', 'singhara', 'aloo samosa'],
  ing: [['maida', 35], ['potato_boiled', 50], ['peas', 8], ['oil', 17]], cooked: 100, portions: [P('1 samosa', 80, true), P('2 samosas', 160)], notes: 'Deep fried; fat ~17% of weight.' })
R({ id: 'kachori', name: 'Kachori (dal)', aliases: ['kachori', 'khasta kachori', 'moong dal kachori'],
  ing: [['maida', 40], ['moong', 15], ['oil', 16]], cooked: 72, portions: [P('1 kachori', 50, true)], notes: 'Deep fried.' })
R({ id: 'pani-puri', name: 'Pani puri / golgappa', aliases: ['golgappa', 'gol gappa', 'puchka', 'pani puri', 'gupchup'],
  ing: [['suji', 20], ['maida', 5], ['oil', 8], ['potato_boiled', 30], ['chickpeas_boiled', 15], ['water', 60], ['tamarind', 5]], cooked: 140, portions: [P('6 puris with pani', 140, true)], notes: 'Fried puris + filling + pani.' })
R({ id: 'bhel-puri', name: 'Bhel puri (street)', aliases: ['bhel', 'bhel puri', 'bhelpuri'],
  ing: [['puffed_rice', 40], ['besan', 15], ['oil', 8], ['onion', 30], ['potato_boiled', 30], ['tamarind', 10], ['sugar', 5]], cooked: 140, portions: [RPLATE(140)], notes: 'Includes sev and sweet chutney.' })
R({ id: 'pakora-restaurant', name: 'Pakora (restaurant)', aliases: ['pakoda', 'bhajiya', 'bhaji', 'pakore'],
  ing: [['besan', 100], ['onion', 150], ['oil', 50]], cooked: 260, portions: [RPLATE(150)], notes: 'Deep fried.' })
R({ id: 'aloo-tikki', name: 'Aloo tikki', aliases: ['aloo tikki', 'tikki', 'aloo patties'],
  ing: [['potato_boiled', 100], ['bread_white', 10], ['oil', 10]], cooked: 110, portions: [P('1 tikki', 70, true), P('2 tikkis', 140)], notes: 'Shallow fried; chutney/chole not included.' })
R({ id: 'dhokla-shop', name: 'Dhokla (shop)', aliases: ['khaman', 'dhokla'],
  ing: [['besan', 100], ['curd', 30], ['sugar', 20], ['oil', 20]], cooked: 300, portions: [RPLATE(120)], notes: 'Sweeter, more tempering oil than home.' })
R({ id: 'medu-vada', name: 'Medu vada', aliases: ['medu vada', 'uddina vade', 'ulundu vadai', 'vada'],
  ing: [['urad', 100], ['onion', 20], ['oil', 35]], cooked: 230, portions: [P('1 vada', 50, true), P('2 vadas', 100)], notes: 'Deep fried.' })
R({ id: 'masala-dosa-restaurant', name: 'Masala dosa (restaurant)', aliases: ['masala dosa', 'mysore masala dosa', 'dosa'],
  ing: [['rice', 75], ['urad', 25], ['oil', 15], ['butter', 10], ['potato_boiled', 150], ['onion', 30], ['oil', 8]], cooked: 380, portions: [P('1 dosa', 250, true)], notes: 'Larger, crisper, with butter/ghee. Sambar and chutney not included.' })
R({ id: 'idli-sambar-plate', name: 'Idli sambar (plate)', aliases: ['idli sambar', 'idli plate'],
  ing: [['rice', 37], ['urad', 13], ['toor', 15], ['pumpkin', 15], ['onion', 12], ['tomato', 18], ['oil', 4]], cooked: 330, portions: [RPLATE(330)], notes: '2 idlis (~130 g) + ~200 g sambar; coconut chutney not included.' })

// Indo-Chinese
R({ id: 'veg-hakka-noodles', name: 'Veg hakka noodles', aliases: ['hakka noodles', 'chowmein', 'chow mein', 'noodles'],
  ing: [['egg_noodles', 100], ['cabbage', 60], ['carrot', 30], ['capsicum', 30], ['onion', 30], ['oil', 25], ['soy_sauce', 10]], cooked: 420, portions: [RPLATE(300)], notes: '~1.5 tbsp oil per plate.' })
R({ id: 'chicken-hakka-noodles', name: 'Chicken hakka noodles', aliases: ['chicken chowmein', 'chicken noodles', 'noodles'],
  ing: [['egg_noodles', 100], ['chicken_breast', 80], ['cabbage', 50], ['carrot', 20], ['onion', 30], ['oil', 25], ['soy_sauce', 10]], cooked: 450, portions: [RPLATE(300)] })
R({ id: 'veg-manchurian', name: 'Veg manchurian (gravy)', aliases: ['manchurian', 'veg manchurian', 'gobi manchurian'],
  ing: [['cabbage', 150], ['carrot', 50], ['maida', 30], ['cornstarch', 20], ['oil', 40], ['soy_sauce', 15], ['onion', 30]], cooked: 420, portions: [P('1 bowl', 200, true)], notes: 'Deep-fried balls in sauce.' })
R({ id: 'chilli-chicken', name: 'Chilli chicken (dry)', aliases: ['chilli chicken', 'chili chicken', 'dragon chicken'],
  ing: [['chicken_thigh', 300], ['cornstarch', 30], ['maida', 15], ['oil', 40], ['capsicum', 60], ['onion', 60], ['soy_sauce', 15]], cooked: 430, portions: [RPLATE(200)], notes: 'Batter-fried then tossed.' })
R({ id: 'chilli-paneer', name: 'Chilli paneer (dry)', aliases: ['chilli paneer', 'chili paneer', 'paneer chilli'],
  ing: [['paneer', 200], ['cornstarch', 25], ['oil', 30], ['capsicum', 60], ['onion', 60], ['soy_sauce', 15]], cooked: 360, portions: [RPLATE(200)] })
R({ id: 'veg-momos-steamed', name: 'Veg momos (steamed)', aliases: ['momos', 'momo', 'veg momos', 'dumplings'],
  ing: [['maida', 100], ['cabbage', 100], ['carrot', 30], ['onion', 30], ['oil', 8]], cooked: 300, portions: [P('6 pieces', 150, true), P('1 piece', 25)], notes: 'Steamed.' })
R({ id: 'chicken-momos-steamed', name: 'Chicken momos (steamed)', aliases: ['chicken momos', 'momos', 'momo'],
  ing: [['maida', 100], ['chicken_thigh', 120], ['onion', 40], ['cabbage', 30], ['oil', 6]], cooked: 300, portions: [P('6 pieces', 150, true), P('1 piece', 25)], notes: 'Steamed.' })
R({ id: 'fried-momos', name: 'Momos (fried)', aliases: ['fried momos', 'kurkure momos', 'momos'],
  ing: [['maida', 100], ['cabbage', 100], ['carrot', 30], ['onion', 30], ['oil', 35]], cooked: 300, portions: [P('6 pieces', 150, true)], notes: 'Deep fried.' })
R({ id: 'spring-roll', name: 'Spring roll (veg)', aliases: ['spring roll', 'veg roll chinese'],
  ing: [['maida', 40], ['cabbage', 60], ['carrot', 20], ['oil', 20]], cooked: 120, portions: [P('1 roll', 60, true), P('2 rolls', 120)], notes: 'Deep fried.' })

// Rolls, wraps, Western fast food
R({ id: 'chicken-kathi-roll', name: 'Chicken kathi roll', aliases: ['kathi roll', 'chicken roll', 'frankie', 'kolkata roll'],
  ing: [['maida', 60], ['oil', 15], ['chicken_thigh', 100], ['onion', 30]], cooked: 200, portions: [P('1 roll', 200, true)], notes: 'Paratha wrap + chicken tikka; sauces excluded.' })
R({ id: 'egg-roll', name: 'Egg roll', aliases: ['egg roll', 'anda roll', 'egg frankie'],
  ing: [['maida', 60], ['oil', 15], ['egg', 50], ['onion', 30]], cooked: 145, portions: [P('1 roll', 145, true)] })
R({ id: 'paneer-roll', name: 'Paneer kathi roll', aliases: ['paneer roll', 'paneer frankie', 'kathi roll'],
  ing: [['maida', 60], ['oil', 15], ['paneer', 80], ['onion', 30], ['capsicum', 20]], cooked: 200, portions: [P('1 roll', 200, true)] })
R({ id: 'chicken-shawarma', name: 'Chicken shawarma (roll)', aliases: ['shawarma', 'shawarma roll', 'chicken shawarma', 'shwarma'],
  ing: [['pita', 70], ['chicken_thigh', 120], ['mayo', 20], ['cabbage', 20], ['onion', 15], ['oil', 5]], cooked: 220, portions: [P('1 roll', 220, true)], notes: 'Includes garlic mayo (toum).' })
R({ id: 'pizza-margherita-slice', name: 'Pizza, cheese / margherita (slice)', aliases: ['pizza', 'margherita', 'cheese pizza', 'pizza slice'],
  ing: [['maida', 45], ['oil', 4], ['mozzarella', 25], ['tomato', 20]], cooked: 90, portions: [P('1 slice (medium pizza)', 75, true), P('1 regular pizza (4 slices)', 250)], notes: 'Indian chain style; cross-check USDA FDC 170317 frozen cheese pizza (268 kcal/100 g).' })
R({ id: 'pizza-veg-slice', name: 'Pizza, veg loaded (slice)', aliases: ['veg pizza', 'farmhouse pizza', 'pizza'],
  ing: [['maida', 45], ['oil', 5], ['mozzarella', 22], ['tomato', 15], ['capsicum', 10], ['onion', 10], ['corn', 8]], cooked: 110, portions: [P('1 slice', 110, true)] })
R({ id: 'pizza-chicken-slice', name: 'Pizza, chicken (slice)', aliases: ['chicken pizza', 'pizza'],
  ing: [['maida', 45], ['oil', 5], ['mozzarella', 22], ['tomato', 15], ['chicken_breast', 25], ['onion', 8]], cooked: 110, portions: [P('1 slice', 110, true)] })
add({ id: 'burger-fast-food', name: 'Burger (fast food, single patty)', aliases: ['burger', 'hamburger', 'chicken burger', 'mcchicken'], category: 'restaurant',
  per100g: per100(ING.ff_burger), portions: [P('1 burger', 150, true)], source: USDA_FAST(170694), confidence: 'estimate',
  notes: 'USDA lab-analysed US hamburger; Indian chain chicken burgers are similar per 100 g. Used as an estimate.' })
add({ id: 'cheeseburger-fast-food', name: 'Cheeseburger (fast food)', aliases: ['cheeseburger', 'cheese burger', 'burger'], category: 'restaurant',
  per100g: per100(ING.ff_cheeseburger), portions: [P('1 burger', 160, true)], source: USDA_FAST(170691), confidence: 'estimate', notes: 'USDA lab-analysed US cheeseburger, used as an estimate.' })
R({ id: 'aloo-tikki-burger', name: 'Aloo tikki burger', aliases: ['mcaloo tikki', 'aloo burger', 'veg burger', 'burger'],
  ing: [['bun', 60], ['potato_boiled', 70], ['bread_white', 8], ['oil', 12], ['mayo', 12], ['tomato', 15], ['onion', 10]], cooked: 185, portions: [P('1 burger', 150, true)], notes: 'Fried potato patty + mayo.' })
add({ id: 'french-fries', name: 'French fries', aliases: ['fries', 'french fries', 'finger chips', 'chips'], category: 'restaurant',
  per100g: per100(ING.ff_fries), portions: [P('medium', 110, true), P('small', 75), P('large', 150)], source: USDA_FAST(170698), confidence: 'estimate',
  notes: 'USDA lab-analysed US fast-food fries, used as an estimate for chain fries.' })
R({ id: 'grilled-sandwich', name: 'Grilled sandwich (veg, cheese)', aliases: ['grilled sandwich', 'cheese sandwich', 'bombay grilled sandwich'],
  ing: [['bread_white', 75], ['butter', 12], ['cheese', 20], ['potato_boiled', 30], ['cucumber', 20], ['tomato', 20], ['capsicum', 15]], cooked: 190, portions: [P('1 sandwich (3 slices)', 190, true)] })

// Sweets (shop)
R({ id: 'jalebi', name: 'Jalebi', aliases: ['jalebi', 'jilebi', 'imarti'],
  ing: [['maida', 50], ['curd', 10], ['oil', 25], ['sugar', 70]], cooked: 160, portions: [P('2 pieces', 50, true), P('100 g', 100)], notes: 'Fried and syrup-soaked; uptake varies a lot.' })
R({ id: 'rasmalai', name: 'Rasmalai', aliases: ['ras malai', 'rasmalai'],
  ing: [['paneer', 150], ['milk', 1000], ['sugar', 120], ['pistachio', 5]], cooked: 750, portions: [P('1 piece with rabri', 70, true)], notes: 'Chhena discs in milk reduced by half; approximate.' })
R({ id: 'kulfi', name: 'Kulfi', aliases: ['kulfi', 'malai kulfi', 'matka kulfi'],
  ing: [['milk', 1000], ['sugar', 80], ['pistachio', 10]], cooked: 450, portions: [P('1 kulfi', 70, true)], notes: 'Milk reduced by more than half.' })
R({ id: 'cold-coffee', name: 'Cold coffee (cafe)', aliases: ['cold coffee', 'iced coffee', 'frappe'],
  ing: [['milk', 250], ['sugar', 20], ['cream', 20]], cooked: 300, portions: [P('1 glass', 300, true)], notes: 'Whole milk + sugar + cream/ice cream.' })
R({ id: 'mango-lassi', name: 'Mango lassi (restaurant)', aliases: ['mango lassi', 'aam lassi', 'lassi'],
  ing: [['curd', 150], ['mango', 80], ['sugar', 20], ['milk', 50]], cooked: 300, portions: [P('1 glass', 300, true)] })
R({ id: 'masala-chai-tapri', name: 'Chai (tapri / stall)', aliases: ['cutting chai', 'tapri chai', 'chai', 'tea'],
  ing: [['milk', 50], ['water', 40], ['sugar', 10]], cooked: 90, portions: [P('1 cutting glass', 90, true)], notes: 'Sweeter and milkier than home chai.' })

// ===========================================================================
// 7. Write foods.json
// ===========================================================================
const here = dirname(fileURLToPath(import.meta.url))
const dataset = { version: VERSION, generated: GENERATED, foods }
// One food per line: compact, and diffs show exactly which food changed.
const json = `{\n "version": ${JSON.stringify(VERSION)},\n "generated": ${JSON.stringify(GENERATED)},\n "foods": [\n` +
  foods.map((f) => '  ' + JSON.stringify(f)).join(',\n') + '\n ]\n}\n'
writeFileSync(join(here, 'foods.json'), json)
const by = (k) => foods.reduce((m, f) => ((m[f[k]] = (m[f[k]] ?? 0) + 1), m), {})
console.log(`foods.json: ${foods.length} foods`, by('category'), by('confidence'))
