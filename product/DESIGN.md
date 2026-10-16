# TrackFit — Design Direction

**Direction:** *Chalk and plate.* The look comes from the gym itself: chalk-grey surfaces, graphite black, and the colour code of weight plates. It should feel like a gym tool, not a wellness app.

Clickable prototype: [`prototype.html`](prototype.html)

---

## Principles

1. **Colour means something.** Blue = lifting. Yellow = protein. Green = avoided sugar / junk food. Nothing else uses these colours, on any screen.
2. **Numbers are the hero.** Weights and grams are set big, wide and heavy, readable at arm's length between sets. Everything around them stays quiet.
3. **Graphics only show data.** The protein ring, week strip and trend lines are the only graphics. No illustrations, gradients or decorative backgrounds.
4. **Motion only answers an action.** The ring fills when you log, a toast confirms a save. Nothing animates on its own.
5. **Thumb-first.** Primary actions sit in the bottom half of the screen; tap targets are at least 44 px.
6. **Light and dark.** Both themes are designed, following the phone's setting.

---

## Colour tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `chalk` | `#E8EBEA` | `#121517` | Page background |
| `card` | `#FFFFFF` | `#1C2023` | Cards, chips |
| `ink` | `#1D2227` | `#ECEFF0` | Primary text |
| `steel` | `#5B636B` | `#9AA3AB` | Secondary text |
| `slab` | `#1D2227` | `#2A3036` | The featured "last time" card |
| `lift` | `#2F5BE0` | `#6E8EFF` | Lifting: actions, active nav, lift data |
| `protein` | `#E8A900` | `#FFC21A` | Protein: ring, progress |
| `habit` | `#23824A` | `#5CCB8A` | Habits: "Avoided" state, sugar / junk-free counts |
| `danger` | `#C73A3A` | `#FF7A7A` | Delete, errors (never used for a habit slip) |

---

## Typography

One family: **Archivo** (Google Fonts, variable width + weight).

| Role | Setting |
|---|---|
| Big numbers (weights, grams) | Archivo, width 125%, weight 800, tabular figures |
| Screen titles | Archivo, width 125%, weight 700, 22 px |
| Body / labels | Archivo, normal width, 400–500, 15 px |
| Captions | Archivo, 400, 13 px, `steel` |

---

## Key components

- **Protein ring:** yellow arc on a pale yellow track; grams eaten in big numerals, goal and remaining beside it. A check appears when the goal is hit.
- **Last-time slab:** graphite card on the Today screen for the most recent exercise. Shows per-set weights in big numerals with their unit, the date, and a blue *Repeat* button.
- **Set row:** set number, − / weight / + stepper (2.5 kg or 5 lb steps), unit toggle per set.
- **Quick-add chips:** white pills, one tap logs, undo toast for 5 seconds.
- **Split chips:** muscle-group pills on the Lift page; selected = `lift` blue. Selection is today's split and also filters the Today screen.
- **Dropdowns:** native `select` (Choose exercise grouped by muscle; Choose food), so phones show their own picker.
- **Habit toggle:** two-button segment per habit, *Avoided* (green fill) / *Had it* (graphite fill); tap again to clear.
- **Bottom nav:** Today · Lift · Protein · Week. Active item in `lift` blue.

---

## Screens (v1)

| Screen | Purpose |
|---|---|
| **Today** (default) | Protein ring + quick-adds, last-time weights for today's split, End of day habits card |
| **Lift** | Choose exercise dropdown, today's split chips with a *Plan week* link, exercises grouped by muscle → exercise detail: last session, log today's sets |
| **Plan week** (from Lift) | Week arrows; Mon–Sun cards with each day's groups (today outlined in `lift` blue, past in ink, planned in blue); tap a day to edit its group chips |
| **Protein** | Ring, quick-adds, type grams, today's entries (edit / delete) |
| **Week** | Days logged this week, protein goal hit/miss per day, days without sugar, days without junk food, body weight log + line chart (graphite line) |
