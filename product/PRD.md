# TrackFit — Product Requirements Document

| | |
|---|---|
| **Status** | v1.0 — open questions resolved |
| **Owner** | Nibhrit Mohanty |
| **Last updated** | 16 Oct 2026 |
| **Tracking** | Jira project `TF` (Kanban) |

---

## 1. Summary

TrackFit is a mobile-first web app that lets people who lift weights do three things:

1. **Instantly recall the weight they used last time** for any exercise or machine, right there in the gym.
2. **Track daily protein intake against a goal** with a glanceable visual.
3. **Check off two daily habits at the end of the day:** avoiding sugar and avoiding junk food.

It runs on both phone and laptop with the same data, and it can be installed to the phone home screen.

---

## 2. Problem

People who lift regularly but don't track run into two recurring problems:

| # | Problem | When it happens | Consequence |
|---|---|---|---|
| P1 | **"What weight did I use last time?"** Recalling the weight for each of 10+ machines and exercises isn't realistic. | At the gym, at the start of every exercise | Guessing too light means wasted sessions and no progression. Guessing too heavy risks injury. |
| P2 | **"Have I had enough protein today?"** Intake is spread across meals and there's no running total. | After meals, and late in the day | Missing the protein goal undermines training results. The user often notices only when it's too late. |
| P3 | **"Am I actually cutting sugar and junk food?"** Without a record, a few slips feel like a good week. | End of day | No honest view of how many days were clean |

Existing apps (full nutrition trackers, workout planners, habit trackers) solve these problems as part of much heavier products. Food databases, calorie budgets and program builders all add friction. For this user, **friction is the main reason tracking gets abandoned**.

---

## 3. Target user

**Primary persona: the self-directed gym-goer**
- Lifts 3–5× a week, follows their own routine rather than a coach's program
- Has a simple protein target (e.g. 100 g/day) rather than full macro goals
- Uses a phone at the gym between sets; uses a laptop at other times
- Currently tracks nothing, or tracks inconsistently in a notes app

**v1 is built for a single user.** The architecture supports multiple users (see §9) so TrackFit can be opened to others later without a rewrite.

---

## 4. Goals and non-goals

### Goals (v1)
- G1. Make last-session weights visible **within 2 taps** of opening the app.
- G2. Make logging fast enough to do between sets: **under 15 seconds for a 3-set exercise**.
- G3. Make protein logging **one tap** for common foods.
- G4. Show today's protein progress **on the home screen, without any taps**.
- G5. Keep the same data on phone and laptop.
- G6. Log both end-of-day habits in **two taps**.

### Non-goals (v1)
- Calorie or full macro tracking
- Food database, barcode scanning
- Reps, RPE, rest timers, workout programs or templates
- Push notifications or reminders
- Social features, sharing, coaching
- Native iOS/Android apps

---

## 5. Success metrics

All metrics are computed from the app's own data. No third-party analytics are needed in v1.

| Type | Metric | Target (after 4 weeks of use) | Why this metric |
|---|---|---|---|
| **Primary** | **Days per week with at least one log** (lift, protein or habit) | ≥ 5 of 7 | A tracker only creates value if logging sticks. This is the leading indicator for everything else. |
| Secondary | % of days the protein goal is hit | ≥ 70% | Measures whether P2 is actually solved |
| Secondary | Days per week without sugar / without junk food | Rising over time | Measures whether P3 habits are sticking |
| Secondary | % of exercises logged that already had a previous session | Rising over time | Measures whether P1's "last weight" recall is being used |
| Guardrail | Median time to log a 3-set exercise | < 15 s | If logging gets slow, the primary metric will fall |

---

## 6. Scope and requirements

Priorities: **P0** = must-have for launch · **P1** = should-have for launch · **P2** = later.

### 6.1 Foundation — Epic `TF-1`

| ID | Requirement | Priority | Jira |
|---|---|---|---|
| F1 | Sign in with an email magic link (no password); session persists across visits | P0 | TF-7 |
| F2 | Data syncs between devices; each user can only access their own data | P0 | TF-6 |
| F3 | App is hosted at a public URL and updates automatically on release | P0 | TF-5 |
| F4 | Installable to phone home screen; opens full-screen; mobile-first layout that also works on desktop | P1 | TF-8 |

### 6.2 Lift Log — Epic `TF-2` (solves P1)

| ID | Requirement | Priority | Jira |
|---|---|---|---|
| L1 | User maintains a personal list of exercises/machines (add, rename, archive), each with a **default unit (kg or lb)**; most recently used shown first; searchable | P0 | TF-9 |
| L2 | Log an exercise as a list of sets, **each set with its own weight** (e.g. 60 / 60 / 65 kg). A new set pre-fills with the previous set's weight. Weight is entered in the exercise's unit (kg or lb), switchable per set. ± buttons step 2.5 kg / 5 lb. Bodyweight exercises log added load; 0 is allowed | P0 | TF-10 |
| L3 | **On selecting an exercise, show the last session's date and per-set weights, in the unit they were logged in.** Offer "repeat last session" to pre-fill | P0 | TF-11 |
| L4 | Exercise history: past sessions, heaviest weight (PR), simple trend of top-set weight | P1 | TF-12 |
| L5 | Exercises belong to a muscle group (Chest, Back, Shoulders, Legs, Biceps, Triceps, Core). Lift page is grouped by muscle; user picks **today's split** (one or more groups) and both Lift and Today show only those groups | P0 | TF-24 |
| L6 | "Choose exercise" dropdown, grouped by muscle, opens the exercise directly | P1 | TF-25 |

### 6.3 Protein Tracker — Epic `TF-3` (solves P2)

| ID | Requirement | Priority | Jira |
|---|---|---|---|
| R1 | Daily protein goal, default 100 g, editable; changing the goal does not rewrite past days | P0 | TF-13 |
| R2 | Log protein by typing grams (+ optional label) | P0 | TF-14 |
| R3 | User-defined quick-add buttons (name + grams); one tap logs, with undo | P0 | TF-15 |
| R4 | **Home screen shows today's progress: grams eaten / goal, grams remaining, "goal hit" state** | P0 | TF-16 |
| R5 | Edit or delete an entry; totals update immediately | P1 | TF-17 |
| R6 | "Choose food" dropdown of saved foods fills grams and label; "Something else" for typing | P1 | TF-26 |

### 6.4 Habit & Insights — Epic `TF-4`

| ID | Requirement | Priority | Jira |
|---|---|---|---|
| H1 | Week view: which days had a log, "X / 7 days", current streak | P1 | TF-18 |
| H2 | Protein goal hit/miss per day over the last 7 / 30 days | P1 | TF-19 |
| H3 | **End-of-day habits** on the Today screen: Sugar and Junk food, each **Avoided** or **Had it**; one answer per habit per day, changeable | P0 | TF-27 |
| H5 | **Body weight:** log once a day (kg or lb, set once), line chart over 30 / 90 days, latest value and change vs 30 days ago | P1 | TF-29 |
| H4 | Week page: "X of Y days without sugar" and "without junk food", each with a day strip (avoided / had it / not logged) | P1 | TF-28 |

### 6.5 Future (v2 candidates)

| Item | Notes | Jira |
|---|---|---|
| Protein reminders | Requires web push (Android Chrome; iPhone only on iOS 16.4+ when installed to the home screen) plus a server-side scheduler | TF-20 |
| Calorie tracking | Likely paired with the food database | TF-21 |
| Food database search | Third-party data dependency | TF-22 |
| Open to other users | Onboarding, privacy policy, abuse limits, hosting cost | TF-23 |

---

## 7. Key user flows

**Flow A: At the gym (P1)**
1. Open TrackFit from the home screen. The **Lift** tab is one tap away.
2. Pick today's split once (e.g. Chest + Triceps). Tap an exercise from those groups, or use the **Choose exercise** dropdown. The screen shows **"Last: 12 Oct · 60 / 60 / 65 kg"**.
3. Tap "Repeat last" or add sets. Each new set pre-fills the previous weight, so it can be adjusted with ± buttons.
4. Done. The session is saved with today's date.

**Flow B: After a meal (P2)**
1. Open TrackFit. The home screen shows the protein ring: **"64 / 100 g · 36 g to go"**.
2. Tap a quick-add (e.g. "Whey scoop · 24 g"), or tap "+" and type grams.
3. The ring updates immediately. An undo toast appears for a few seconds.


**Flow C: Before bed (P3)**
1. Open TrackFit. The **End of day** card sits at the bottom of Today.
2. Tap **Avoided** or **Had it** for Sugar, then for Junk food. Done in two taps.

---

## 8. UX principles

Full visual direction ("Chalk and plate"), colour and type tokens, and components: [DESIGN.md](DESIGN.md). Clickable prototype: [prototype.html](prototype.html).

- **Speed over completeness.** Every field we add slows logging, and slow logging kills the habit.
- **One-handed, thumb-reachable.** Primary actions sit in the bottom half of the screen. Tap targets are at least 44 px.
- **Show before ask.** Display last weights and today's progress before asking for input.
- **Forgiving.** Prefer undo to confirmation dialogs, and make every entry editable.
- **Mobile-first, desktop-capable.** The same app should lay out sensibly at laptop widths.

---

## 9. Data model (v1)

Every table carries `user_id`, and row-level security restricts each user to their own rows. This is what makes "open to other users" (TF-23) an additive change rather than a rewrite.

| Table | Key fields | Notes |
|---|---|---|
| `exercises` | id, user_id, name, muscle_group, default_unit (`kg`/`lb`), archived_at, created_at | Unique name per user |
| `lift_sessions` | id, user_id, exercise_id, performed_at | One per exercise per workout |
| `lift_sets` | id, session_id, set_number, weight, unit (`kg`/`lb`) | Per-set weight supports 60 / 60 / 65. Stored **as entered**, never converted, so it always matches the number on the machine or dumbbell. Conversion (1 lb = 0.4536 kg) only for cross-unit comparisons like PRs and trends |
| `protein_entries` | id, user_id, grams, label, quick_add_id (nullable), logged_at | |
| `quick_adds` | id, user_id, name, grams, sort_order | |
| `protein_goals` | id, user_id, goal_g, effective_from | History of goals, so past days keep the goal they had |
| `daily_habits` | user_id, date, sugar (`avoided`/`had`/null), junk_food (`avoided`/`had`/null) | One row per user per day |
| `user_settings` | user_id, current_split (list of muscle groups), body_weight_unit | Today's split and preferences, synced across devices |
| `body_weights` | user_id, date, weight, unit | One per user per day; a second entry that day replaces the first |

"Today" is determined by the user's **local time zone** and resets at local midnight.

---

## 10. Technical approach

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | React + Vite + TypeScript, Progressive Web App | Mobile-first, installable, no app-store overhead |
| Data + auth | Supabase (Postgres, magic-link auth, row-level security) | Cross-device sync without running a server; free tier; multi-user ready |
| Hosting | GitHub Pages, deployed via GitHub Actions | Free, automatic on release |

---

## 11. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Poor signal in the gym** (basements, metal buildings) | Logging fails at the exact moment it matters | Save locally first and sync when back online (optimistic UI). Confirm scope in TF-10 |
| Logging feels like a chore → habit drops | Primary metric fails | Pre-fill, quick-adds, "repeat last", guardrail metric on time-to-log |
| Supabase free project pauses after ~7 days idle | App unavailable after a break | Acceptable with daily use. Revisit before opening to others (TF-23) |
| Magic-link email delayed or lands in spam | Can't sign in at the gym | Long-lived sessions mean sign-in is rare; sign in on the phone once at setup |
| Data loss / lock-in concerns | Low trust | Data lives in Postgres. Consider a CSV export in v1.1 |

---

## 12. Decisions log (resolved open questions)

| # | Question | Decision | Rationale |
|---|---|---|---|
| D1 | Units | **Both kg and lb.** Each exercise has a default unit; each set stores its unit; weights are stored as entered | Gym machines are labelled in either unit and dumbbells are often in lb. Converting would show numbers that don't match the equipment, which breaks "last weight" recall |
| D2 | Offline | **Retry queue:** entries save on the device first and sync when back online. No full offline mode in v1 | Covers poor gym signal at a fraction of full offline sync's complexity |
| D3 | Bodyweight exercises | Weight = **added load**; 0 allowed | Keeps one data model for all exercises |
| D5 | "Had it" colour | Graphite, not red | Red is kept for errors and deleting. A slip isn't an error, and the app shouldn't shame the user |
| D6 | Mixed units in one session | Each weight shows its own unit | Matches the equipment |
| D7 | Heaviest weight across units | Compared after converting to kg, shown in the unit logged | Fair comparison without changing what the user sees |
| D8 | Body weight chart colour | Neutral graphite line | Blue, yellow and green already mean lifting, protein and habits |
| D4 | ± increments | **2.5 kg / 5 lb**, editable when typing | Matches the smallest common plate and dumbbell jumps |

---

## 13. Release plan

| Milestone | Contents | Exit criteria |
|---|---|---|
| M1 Foundation | TF-5 → TF-8 | Sign in on phone and laptop at the live URL |
| M2 Lift Log | TF-9 → TF-12, TF-24, TF-25 | Used for 3 real gym sessions without falling back to memory |
| M3 Protein | TF-13 → TF-17, TF-26 | Used for 5 consecutive days |
| M4 Habits and insights | TF-18, TF-19, TF-27, TF-28, TF-29 | Habits logged for 5 nights; Week view reflects real data |
| **v1 launch** | M1–M4 | 4 weeks of personal use, then measured against §5 targets |
