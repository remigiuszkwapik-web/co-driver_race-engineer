/**
 * Upgrade reference content — Forza Horizon 6.
 *
 * Companion to `tuning-reference.ts`. Where the tune reference covers the
 * slider-side of a setup (springs, dampers, alignment…), this covers the
 * build-side: what to install on the car *before* you start tuning, in what
 * order, and how to spend a PI budget without wasting points.
 *
 * Distilled from community guides (ForzaTune, ForzaFire, kboosting, ggwtb,
 * GTPlanet workshop threads) and updated for the FH6-era shifts:
 *  - Front tire **width** is now a first-class lever (often beats a full
 *    compound jump on PI cost).
 *  - Brake upgrades are no longer luxury parts — stock brakes cause lockup
 *    and trail-brake understeer on most cars now.
 *  - Weight reduction is the only upgrade that is universally PI-efficient
 *    (Speed, Grip, Drift, Rally, Off-road builds all benefit).
 *  - Engine swaps are decided on the **PWR delta**, not on displacement —
 *    a V12 in a small hatchback is usually a trap regardless of PI math.
 *  - Race transmission + clutch + driveline + diff stacked together can eat
 *    15–25 PI that is almost always better spent on tires / chassis.
 *
 * Pure data; rendered by `/upgrade/*` pages.
 */

/** Build discipline — which tier of an upgrade is "efficient" depends on this. */
export type Discipline = 'road' | 'dirt' | 'cross-country' | 'drift' | 'drag'

/** PI-efficiency rating per discipline. ✓ = recommended, · = situational,
 *  ✗ = actively wastes PI / hurts the build. Mirrors the ForzaTune dark-circle
 *  / white-circle / red-X taxonomy in a typeable form. */
export type EfficiencyMark = 'recommend' | 'situational' | 'avoid'

export interface DisciplineMatrix {
  'road': EfficiencyMark
  'dirt': EfficiencyMark
  'cross-country': EfficiencyMark
  'drift': EfficiencyMark
  'drag': EfficiencyMark
}

/** A single upgrade option / tier inside a category. */
export interface UpgradeOption {
  /** In-game part name. */
  name: string
  /** Approximate PI cost band — exact numbers are car-specific. */
  piCost: string
  /** When this option is the right pick. */
  bestFor: string
  /** Why you would skip it / what it costs you. */
  tradeoff: string
  /** Per-discipline efficiency. Categories that don't vary by discipline
   *  can omit this. */
  matrix?: DisciplineMatrix
}

export interface UpgradeTrap {
  /** Mistake summary — the thing people do without thinking. */
  trap: string
  /** Why it's a trap. */
  why: string
  /** What to do instead. */
  instead: string
}

export interface UpgradeCategory {
  slug: string
  title: string
  /** lucide icon name, no `i-` prefix. */
  icon: string
  /** Single sentence for index cards. */
  summary: string
  /** Multi-paragraph "what this lever actually does and when to spend PI on it". */
  what: string[]
  /** Options inside the category — ordered tier ascending. */
  options: UpgradeOption[]
  /** Decision rules — short imperative statements. */
  rules: string[]
  /** Common traps for this category. */
  traps?: UpgradeTrap[]
  /** Cross-references to other categories. */
  related?: string[]
  /** Linked tune-reference slug if there's a direct tuning equivalent. */
  tuneRef?: string
}

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  'road': 'Road',
  'dirt': 'Dirt',
  'cross-country': 'Cross-country',
  'drift': 'Drift',
  'drag': 'Drag'
}

export const EFFICIENCY_LABEL: Record<EfficiencyMark, string> = {
  recommend: 'Recommended',
  situational: 'Situational',
  avoid: 'Avoid'
}

/** Display glyph for matrix cells — kept ASCII so it renders identically in
 *  the monospace font we use across /tune. */
export const EFFICIENCY_GLYPH: Record<EfficiencyMark, string> = {
  recommend: '●',
  situational: '○',
  avoid: '✗'
}

export const UPGRADE_CATEGORIES: UpgradeCategory[] = [
  {
    slug: 'tires',
    title: 'Tires (Compound & Width)',
    icon: 'circle-dot',
    summary: 'Where most PI-per-grip lives in FH6. Front width is its own lever now — use it before bumping compound.',
    tuneRef: 'tire-pressure',
    what: [
      'Tires touch the road; everything else only changes how. Two levers: compound (the rubber) and width (the contact patch). FH6 separated these out more aggressively than FH5 — front and rear width move independently, and adding 1–2 width notches to the front often beats a full compound jump on PI cost.',
      'Compound is matched to surface, not to ambition. Race slicks on dirt lose to rally tires by a wide margin in FH6, which deliberately added a heavier PI penalty for slicks on dirt than FH5 had. Same logic for cross-country — off-road tires are not a downgrade, they\'re the right tool.',
      'Width skew tracks drivetrain. RWD wants more rear than front for corner-exit traction (e.g. 285F / 325R at S1). FWD wants equal or slightly wider front, since the front handles steering, power, and braking simultaneously. AWD runs roughly symmetric, occasionally with a small rear bias.'
    ],
    options: [
      { name: 'Stock', piCost: '0', bestFor: 'D-class power builds where every PI point matters', tradeoff: 'Low peak grip; gives up cornering at any pace',
        matrix: { 'road': 'situational', 'dirt': 'avoid', 'cross-country': 'avoid', 'drift': 'avoid', 'drag': 'recommend' } },
      { name: 'Street', piCost: '5–10', bestFor: 'D/C-class road; cheap grip floor', tradeoff: 'Still well below peak; falls off in S-class corners',
        matrix: { 'road': 'recommend', 'dirt': 'avoid', 'cross-country': 'avoid', 'drift': 'situational', 'drag': 'situational' } },
      { name: 'Sport', piCost: '10–20', bestFor: 'B/A road; the workhorse compound', tradeoff: 'On a light car the PI cost can hurt PWR more than the grip helps',
        matrix: { 'road': 'recommend', 'dirt': 'avoid', 'cross-country': 'avoid', 'drift': 'recommend', 'drag': 'situational' } },
      { name: 'Semi-slick', piCost: '15–25', bestFor: 'A-class with PI headroom; gateway to S1', tradeoff: 'PI step is real — verify the lap-time gain',
        matrix: { 'road': 'recommend', 'dirt': 'avoid', 'cross-country': 'avoid', 'drift': 'recommend', 'drag': 'situational' } },
      { name: 'Race (Slicks)', piCost: '20–30', bestFor: 'S1/S2/R road racing — mandatory at this level', tradeoff: 'Heavy PI penalty on dirt and cross-country in FH6',
        matrix: { 'road': 'recommend', 'dirt': 'avoid', 'cross-country': 'avoid', 'drift': 'recommend', 'drag': 'recommend' } },
      { name: 'Rally', piCost: '15–25', bestFor: 'Dirt racing — the only correct compound on loose surface', tradeoff: 'Loses to slicks on tarmac',
        matrix: { 'road': 'avoid', 'dirt': 'recommend', 'cross-country': 'situational', 'drift': 'avoid', 'drag': 'avoid' } },
      { name: 'Off-road', piCost: '15–25', bestFor: 'Cross-country and rough terrain — grip and impact tolerance', tradeoff: 'Sluggish on smooth surfaces',
        matrix: { 'road': 'avoid', 'dirt': 'situational', 'cross-country': 'recommend', 'drift': 'avoid', 'drag': 'avoid' } },
      { name: 'Drag', piCost: '15–25', bestFor: 'Drag launches; straight-line traction only', tradeoff: 'No lateral grip — useless on circuits',
        matrix: { 'road': 'avoid', 'dirt': 'avoid', 'cross-country': 'avoid', 'drift': 'avoid', 'drag': 'recommend' } },
      { name: 'Front tire width (+1/+2)', piCost: '2–6 per step', bestFor: 'Almost every road build below max compound — cheapest cornering gain', tradeoff: 'On RWD power builds, adds PI for a small launch penalty',
        matrix: { 'road': 'recommend', 'dirt': 'situational', 'cross-country': 'situational', 'drift': 'recommend', 'drag': 'situational' } },
      { name: 'Rear tire width (+1/+2)', piCost: '2–6 per step', bestFor: 'RWD/AWD power builds; corner-exit and launch traction', tradeoff: 'Adds rotational inertia and front-end push on FWD',
        matrix: { 'road': 'recommend', 'dirt': 'situational', 'cross-country': 'situational', 'drift': 'recommend', 'drag': 'recommend' } }
    ],
    rules: [
      'Match compound to surface first, not to class. Slicks on dirt is a deliberate PI trap in FH6.',
      'Before stepping compound up a tier, try +1 front width. Usually cheaper PI for the same lap-time gain.',
      'On RWD, the rear should be wider than the front. On FWD, the front should be equal or wider.',
      'Stop widening when contact patch already saturates — wider tires you can\'t load are just PI cost.'
    ],
    traps: [
      { trap: 'Race slicks "to be safe" on dirt or cross-country', why: 'FH6 applies a much heavier PI penalty for slicks on loose surface than FH5 did — the math no longer leans your way', instead: 'Use rally or off-road compound for the actual surface' },
      { trap: 'Maxing front width on a RWD power build', why: 'Adds PI you could spend on rear width, where it actually helps put power down', instead: 'Step front width once at most; spend the rest on rear' }
    ],
    related: ['weight', 'aero', 'rims']
  },
  {
    slug: 'brakes',
    title: 'Brakes',
    icon: 'gauge-circle',
    summary: 'No longer optional in FH6 — stock brakes lock up under hard downshifts and trail-braking. Budget for one tier.',
    tuneRef: 'brakes',
    what: [
      'Brakes used to be the part you skipped because the PI was better spent on power. FH6 changed that — stock brakes now lock the fronts on aggressive downshifts and behave badly under trail-brake. The result is messy turn-in, mid-corner understeer that "feels like" a setup problem but isn\'t, and lap-time loss that no slider can recover.',
      'One brake upgrade tier (Sport or Race) is the rule. The second tier is rarely worth the PI because you can\'t actually use much more peak deceleration than tires can hold — you\'re already grip-limited, not brake-limited.',
      'Brake upgrades also unlock the in-tune brake bias and pressure sliders fully. See `/tune/brakes` for the slider-side of this lever.'
    ],
    options: [
      { name: 'Stock', piCost: '0', bestFor: 'Only if you literally have no PI to spare and the car already brakes well', tradeoff: 'Front lockup on downshifts; bad trail-brake behaviour' },
      { name: 'Sport brakes', piCost: '2–5', bestFor: 'B/A class — the sweet spot for most road builds', tradeoff: 'Marginal vs Race at the top end' },
      { name: 'Race brakes', piCost: '5–10', bestFor: 'S1/S2/R where bias tuning matters and entry speed is high', tradeoff: 'PI cost can be wasted at low classes where tires give up first' }
    ],
    rules: [
      'Budget at least one brake tier on any FH6 build above D-class.',
      'Sport tier is usually enough — Race tier is for S-class entry-speed work.',
      'If you still get lockup after upgrading, fix it with brake bias / pressure in the tune, not a higher tier.'
    ],
    related: ['weight', 'tires']
  },
  {
    slug: 'weight',
    title: 'Weight Reduction',
    icon: 'feather',
    summary: 'The only upgrade that is universally PI-efficient — improves braking, rotation, acceleration, and stability. Max it.',
    what: [
      'Weight is the upgrade that touches every other category. Less weight = less load on tires (more grip), less work for brakes (shorter stopping), more acceleration for the same power (better PWR), less roll for the same springs. Across every Forza community framework — ForzaTune, ForzaFire, the GTPlanet workshop — weight reduction is the *only* upgrade rated efficient for all five disciplines.',
      'Practical rule: max weight reduction as far as your PI budget allows, then come back to it as your fine-tuner. If you\'re 5 PI over class with no easy cut, see if one more weight step lets you keep an upgrade you actually want elsewhere.',
      'Two adjacent levers are easy to confuse with weight: rim diameter / style (lighter wheels at the same diameter — see `/upgrade/rims`) and the driveline upgrade (rotating-mass reduction, see `/upgrade/drivetrain-parts`). Both contribute weight savings without showing up under "Weight Reduction" in-game.'
    ],
    options: [
      { name: 'Stock body / interior', piCost: '0', bestFor: 'Cars already at class ceiling with no PI to play with', tradeoff: 'Leaves grip and lap time on the table everywhere' },
      { name: 'Race weight reduction', piCost: '5–15', bestFor: 'Almost every build — the highest-leverage single upgrade in FH6', tradeoff: 'PI cost scales with the kg removed; verify the PI per kg is reasonable on your specific car' }
    ],
    rules: [
      'Max it unless you can prove the PI buys more elsewhere.',
      'Pair with a Race hood (5–15 kg "free" weight off the front) — stacks with weight reduction.',
      'Weight reduction is the first place to look when you\'re 1–3 PI over the class cap.'
    ],
    traps: [
      { trap: 'Skipping weight reduction because "the car is already light"', why: 'Light cars benefit *more* from further reduction (PWR scales non-linearly at low weight)', instead: 'Always at least Sport-tier reduction; check the PI math before stopping there' }
    ],
    related: ['rims', 'drivetrain-parts']
  },
  {
    slug: 'suspension-class',
    title: 'Suspension Class',
    icon: 'sliders',
    summary: 'The "type" of suspension you install — gates which tune sliders unlock. Sport is the cheap path to full tuning.',
    tuneRef: 'springs',
    what: [
      'In-game "suspension" is a class of part, not a tune setting. Stock springs have almost no adjustability. Sport suspension unlocks ride height, springs, dampers. Race suspension adds the full slider range — taller bars, wider damper bands. Rally and off-road suspension are surface-specific variants with longer travel, softer defaults, and damping curves built for loose surface.',
      'For pure circuit / road racing, Sport is usually the right pick at B/A class (PI-efficient, unlocks the sliders that matter), Race at S1/S2/R (where you actually use the wider range). Race-tier suspension is actively wrong for dirt and off-road builds — the short travel binds up over bumps.',
      'Rally and off-road suspension are mandatory for their disciplines, and counterproductive for the others. There is no "compromise" option that does both well — pick one and tune it.'
    ],
    options: [
      { name: 'Stock', piCost: '0', bestFor: 'Drag-only builds where slider tuning doesn\'t change much', tradeoff: 'No adjustability — can\'t fix balance through tuning',
        matrix: { 'road': 'avoid', 'dirt': 'avoid', 'cross-country': 'avoid', 'drift': 'avoid', 'drag': 'situational' } },
      { name: 'Sport suspension', piCost: '3–6', bestFor: 'B/A road builds where Race-tier PI is better spent elsewhere', tradeoff: 'Slightly narrower slider range than Race',
        matrix: { 'road': 'recommend', 'dirt': 'avoid', 'cross-country': 'avoid', 'drift': 'situational', 'drag': 'situational' } },
      { name: 'Race suspension', piCost: '5–10', bestFor: 'S1/S2/R road and drift — full slider range, wide damper band', tradeoff: 'Short travel binds on dirt and off-road; PI penalty active for those',
        matrix: { 'road': 'recommend', 'dirt': 'avoid', 'cross-country': 'avoid', 'drift': 'recommend', 'drag': 'situational' } },
      { name: 'Rally suspension', piCost: '5–10', bestFor: 'Dirt racing — long travel, soft defaults, surface-tuned damping', tradeoff: 'Useless on tarmac — too soft, rolls excessively',
        matrix: { 'road': 'avoid', 'dirt': 'recommend', 'cross-country': 'situational', 'drift': 'avoid', 'drag': 'avoid' } },
      { name: 'Off-road suspension', piCost: '5–10', bestFor: 'Cross-country — maximum travel for jumps and ruts', tradeoff: 'Too tall and soft for any race surface',
        matrix: { 'road': 'avoid', 'dirt': 'situational', 'cross-country': 'recommend', 'drift': 'avoid', 'drag': 'avoid' } }
    ],
    rules: [
      'Pick suspension class to match discipline. Mixing is not a strategy.',
      'Sport unlocks 90% of the tuning value of Race at half the PI for B/A class.',
      'Rally / off-road suspension is mandatory for their surfaces and a PI penalty for any other.'
    ],
    related: ['weight', 'tires']
  },
  {
    slug: 'drivetrain-conversion',
    title: 'Drivetrain Conversion (FWD ↔ RWD ↔ AWD)',
    icon: 'arrow-right-left',
    summary: 'Changes the fundamental character of the car. AWD swap is heavy PI; RWD swap from AWD usually nets nothing.',
    what: [
      'Drivetrain conversion is one of the biggest single-PI decisions you can make. AWD swap can eat 30–80+ PI on a car that started RWD, in exchange for launch and corner-exit traction. RWD swap from a factory AWD car removes the traction advantage *without* a PI refund — almost always a net loss unless you specifically need RWD for a drift build.',
      'Lock the discipline first, then pick drivetrain. Road racing at A/S1: AWD if the car is heavy or you want forgiveness, RWD if it\'s light and PI is tight. Drift: RWD only. Drag: depends on launch weight transfer and tire choice. Cross-country and dirt: AWD wins almost always.',
      'FWD is the third option, and it\'s usually best on the stock factory FWD platforms (small hot-hatches at C/B class). Converting *to* FWD is rare; converting *from* FWD to AWD is common on lighter cars where you want grip without committing to RWD throttle work.'
    ],
    options: [
      { name: 'Keep stock drivetrain', piCost: '0', bestFor: 'Factory AWD cars (GT-R, WRX, Quattro) — already balanced for their power', tradeoff: 'Locks you into the factory character' },
      { name: 'Swap to AWD', piCost: '30–80', bestFor: 'Cross-country, dirt, snowy/wet weather builds; heavy power builds that can\'t put power down', tradeoff: 'Heavy PI cost; adds weight; reduces top speed' },
      { name: 'Swap to RWD', piCost: '0–10 refund (rare)', bestFor: 'Only if going for a drift build or a specific RWD chassis character', tradeoff: 'Loses AWD traction without a corresponding PI gain — usually a net loss' },
      { name: 'Swap to FWD', piCost: 'variable', bestFor: 'Extremely rare — almost never the answer', tradeoff: 'Adds on-throttle understeer and limits engine swap options' }
    ],
    rules: [
      'Decide discipline before drivetrain. Don\'t convert to AWD on a drag build that doesn\'t need it.',
      'Light cars at D/C class rarely benefit from AWD swap — the PI cost is too high for the budget.',
      'Don\'t swap to RWD on a factory AWD car unless you specifically want RWD behaviour.'
    ],
    traps: [
      { trap: 'AWD swap on a 600 kg D-class hatchback', why: 'The PI cost eats your entire engine + tire budget and you don\'t need the traction at D-class power levels', instead: 'Keep the factory drivetrain; spend the PI on tires and weight' },
      { trap: 'RWD swap on a factory AWD car for "purity"', why: 'No PI refund; you lose launch and exit traction with nothing in exchange', instead: 'Keep AWD and tune the center diff if you want more rotation' }
    ],
    related: ['engine-swap', 'drivetrain-parts']
  },
  {
    slug: 'engine-swap',
    title: 'Engine Swap',
    icon: 'cog',
    summary: 'Decide on PWR delta, not displacement. A bigger engine that ruins balance is a worse car.',
    what: [
      'Engine swaps are evaluated on power-to-weight after the swap, not on the engine itself. A stock 2.0L turbo that already has strong character may beat a swapped V12 if the V12 pushes the car into a higher class or wrecks the balance. Always compare PWR pre- and post-swap; if the number doesn\'t improve, skip the swap.',
      'Factory engines in many cars are already PI-efficient and well-tuned. AWD cars in particular (GT-R, WRX, Audi Quattro) ship with engines balanced for their drivetrain — swapping out usually pays back less than the PI cost.',
      'Historically PI-efficient swaps in FH-era titles: Racing V12, 6.2L V8 (415 HP), 7.2L Racing V8, 5.2L V10, 4.0L V8, and the 2.0L turbo rally engines. These pop up across guides because they consistently improve PWR relative to PI cost on a wide range of chassis. Specific availability is car-dependent.'
    ],
    options: [
      { name: 'Keep stock engine', piCost: '0', bestFor: 'Factory AWD cars; cars whose engine is already class-appropriate', tradeoff: 'Caps your peak power without internals upgrades' },
      { name: 'Larger-displacement same-family swap', piCost: '10–30', bestFor: 'Modest PWR gain without changing the car\'s character', tradeoff: 'Often a stepping stone that gets eclipsed by a proper swap' },
      { name: 'High-PI race engine swap (V8/V10/V12)', piCost: '30–80', bestFor: 'When you need to break into S1/S2/R from a lower-power chassis', tradeoff: 'Heavy; can wreck weight balance; expensive PI; verify PWR delta first' }
    ],
    rules: [
      'Always compare PWR before and after the swap. If PWR doesn\'t improve, don\'t swap.',
      'Don\'t swap factory-tuned AWD engines unless you have a specific power target the stock engine can\'t hit.',
      'Weight balance matters more than peak power for road racing — a V12 in a hatchback is rarely the right answer.'
    ],
    traps: [
      { trap: 'Swapping to "the biggest engine that fits"', why: 'Often kills weight balance and pushes the car into a higher class with no PWR gain', instead: 'Pick the smallest swap that hits your power target with balance intact' }
    ],
    related: ['aspiration', 'drivetrain-conversion', 'weight']
  },
  {
    slug: 'aspiration',
    title: 'Aspiration (Turbo / Supercharger / N/A)',
    icon: 'wind',
    summary: 'Power-delivery shape. Centrifugal SC is usually the most PI-efficient for road; twin turbo on small engines is a trap.',
    what: [
      'Aspiration changes the *shape* of the power curve, not just the peak. Naturally aspirated revs cleanly and stays light, at the cost of peak power. Centrifugal supercharger is the most PI-efficient choice for most road builds — strong, predictable power, modest weight. Positive-displacement supercharger gives instant torque off the line (drift, drag launches, cross-country) at higher PI. Single turbo balances stock turbo cars. Twin turbo is for big engines and top-speed builds — putting it on a small displacement engine creates lag without enough peak gain.',
      'Availability is engine-specific. Not every engine has every aspiration option, and the choice often appears alongside the engine swap decision. Pick aspiration after the engine, not before.'
    ],
    options: [
      { name: 'Naturally aspirated', piCost: '0', bestFor: 'Weight-reduction builds, high-revving small engines', tradeoff: 'Lowest power ceiling',
        matrix: { 'road': 'situational', 'dirt': 'situational', 'cross-country': 'situational', 'drift': 'situational', 'drag': 'avoid' } },
      { name: 'Single turbo', piCost: '15–30', bestFor: 'Mid-range balanced builds; cars with factory turbo', tradeoff: 'Less peak than twin; some lag',
        matrix: { 'road': 'recommend', 'dirt': 'recommend', 'cross-country': 'situational', 'drift': 'situational', 'drag': 'situational' } },
      { name: 'Twin turbo', piCost: '25–45', bestFor: 'Top-speed and big-displacement builds (5L+)', tradeoff: 'Lag is real; useless on small engines',
        matrix: { 'road': 'situational', 'dirt': 'avoid', 'cross-country': 'avoid', 'drift': 'situational', 'drag': 'recommend' } },
      { name: 'Centrifugal supercharger', piCost: '20–35', bestFor: 'Road racing — usually the most PI-efficient option', tradeoff: 'Less instant response than positive-displacement',
        matrix: { 'road': 'recommend', 'dirt': 'recommend', 'cross-country': 'recommend', 'drift': 'situational', 'drag': 'situational' } },
      { name: 'Positive-displacement SC', piCost: '25–40', bestFor: 'Drift, drag launches, cross-country — instant torque', tradeoff: 'Higher PI; heavier',
        matrix: { 'road': 'situational', 'dirt': 'situational', 'cross-country': 'recommend', 'drift': 'recommend', 'drag': 'recommend' } }
    ],
    rules: [
      'Pick the engine first; aspiration after.',
      'Centrifugal SC is the default for road builds unless the engine specifically suits a turbo.',
      'Don\'t put twin turbos on engines under 2.5L — you get lag without a power payoff.'
    ],
    related: ['engine-swap']
  },
  {
    slug: 'drivetrain-parts',
    title: 'Drivetrain Parts (Diff / Trans / Driveline / Clutch / Flywheel)',
    icon: 'split',
    summary: 'PI traps live here. Race-tier on everything stacks 15–25 PI you usually want elsewhere.',
    tuneRef: 'differential',
    what: [
      'The five drivetrain parts — Differential, Transmission, Driveline, Clutch, Flywheel — are individually small PI but stack quickly. The community rule of thumb across ForzaFire / kboosting / ggwtb is: don\'t Race-tier all five by default. The combined PI hit is 15–25 points, and that\'s budget that almost always returns more on tires or weight.',
      'Differential is the only one of the five that\'s usually worth Race-tier — it unlocks the full Accel + Decel sliders on both axles and the AWD center-balance slider. Without it, you can\'t do the corner-exit work the tune reference describes.',
      'Transmission PI cost *scales* with how much power you\'ve added. The Sport transmission at A-class might be cheap; the same Sport transmission at S2 with 700 HP costs noticeably more. Re-check after engine upgrades.',
      'Driveline is the underrated value upgrade — small PI, real rotating-mass weight reduction, and often the cleanest fine-tuner when you\'re hunting the last few PI points before the class ceiling.',
      'Clutch upgrades are a PI trap unless you actually use Manual-with-Clutch input. If you\'re on Automatic or Manual, the clutch upgrade does almost nothing.',
      'Flywheel reduces rotating mass — like driveline, it\'s a quiet weight reduction. PI cost is usually low and worth it on grip / drift builds.'
    ],
    options: [
      { name: 'Race differential', piCost: '3–8', bestFor: 'Anyone who plans to actually tune their car', tradeoff: 'PI cost is small; the unlocked tuning sliders are the entire reason to upgrade' },
      { name: 'Sport transmission', piCost: '2–5', bestFor: 'B/A class — unlocks Final Drive only, which is most of what you need', tradeoff: 'No individual gear ratios' },
      { name: 'Race transmission', piCost: '5–12 (scales with power)', bestFor: 'S1/S2/R where powerband matching matters', tradeoff: 'Often better spent on tires/brakes at lower class' },
      { name: 'Race driveline', piCost: '2–5', bestFor: 'PI fine-tuner; rotating-mass weight reduction', tradeoff: 'Almost always worth it on grip builds' },
      { name: 'Race clutch', piCost: '2–5', bestFor: 'Manual-with-Clutch input users only', tradeoff: 'Effectively wasted PI on Auto/Manual without clutch' },
      { name: 'Race flywheel', piCost: '2–5', bestFor: 'Most grip and drift builds — small PI, real benefit', tradeoff: 'Engine can feel snappier — pair with rev-matching habit' }
    ],
    rules: [
      'Race differential is the only must-have of the five. Everything else is a budget call.',
      'Don\'t install Race clutch unless you drive M/C — it\'s wasted PI.',
      'Re-check transmission tier AFTER engine upgrades — its PI cost scales with power.',
      'Use Race driveline / flywheel as PI fine-tuners when you\'re close to the class cap.'
    ],
    traps: [
      { trap: 'Race-tier every drivetrain part because they\'re "small"', why: 'Stacked, the five parts can eat 15–25 PI that wins more elsewhere', instead: 'Differential mandatory; the rest are budget calls' },
      { trap: 'Race clutch on Automatic transmission input', why: 'The simulation doesn\'t model your shifting; the upgrade does almost nothing', instead: 'Skip it; put the PI into tires or weight' }
    ],
    related: ['weight', 'drivetrain-conversion']
  },
  {
    slug: 'aero-body',
    title: 'Aero & Body (Wing / Splitter / Widebody)',
    icon: 'plane',
    summary: 'Cornering grip at the cost of top speed. Front aero is usually free; rear wing is the expensive half.',
    tuneRef: 'aero',
    what: [
      'Aero upgrades work in pairs with the tuning sliders they unlock. The Race front bumper enables the front downforce slider; the Race rear wing enables the rear. Without the part, the slider is grey. FH6 added an aero balance slider on top of the per-axle values — but you need at least one aero part installed for it to do anything.',
      'Front aero is usually cheap PI and worth installing on any road build above B-class. Rear aero is the expensive half — significant drag cost on top speed, only justified if the rear unhooks in fast corners (which becomes more common at S1/S2/R).',
      'Widebody kits unlock wider tire fitment and sometimes additional aero adjustability. They cost real PI *and* add drag — only install them if you\'re actually using the wider tires or the unlocked aero. Cosmetic widebody is a PI waste.',
      'Race hoods and bumpers also act as weight reduction (5–15 kg on the hood, more on combined kits). Stacks usefully with the main Race weight reduction part.'
    ],
    options: [
      { name: 'Race front bumper / splitter', piCost: '3–8', bestFor: 'Any road build A-class+; unlocks front downforce slider', tradeoff: 'Small drag; small weight; almost always worth it',
        matrix: { 'road': 'recommend', 'dirt': 'situational', 'cross-country': 'avoid', 'drift': 'situational', 'drag': 'avoid' } },
      { name: 'Race rear wing', piCost: '5–12', bestFor: 'Twisty S1/S2 circuits where fast-corner stability matters', tradeoff: 'Significant top-speed loss — avoid on speed circuits',
        matrix: { 'road': 'recommend', 'dirt': 'avoid', 'cross-country': 'avoid', 'drift': 'situational', 'drag': 'avoid' } },
      { name: 'Widebody (with wider tires)', piCost: '5–15', bestFor: 'S1/S2/R where you need 295+ tire width', tradeoff: 'Drag and weight — only install if you\'ll use the unlocked widths',
        matrix: { 'road': 'situational', 'dirt': 'avoid', 'cross-country': 'avoid', 'drift': 'recommend', 'drag': 'avoid' } },
      { name: 'Race hood', piCost: '1–3', bestFor: 'Cheap weight reduction; stacks with Race weight reduction', tradeoff: 'Almost always worth installing if available' }
    ],
    rules: [
      'Front aero before rear aero. Front is cheap PI; rear is expensive drag.',
      'Widebody only if you\'re actually using the wider tires or the unlocked aero. Otherwise it\'s cosmetics.',
      'Race hoods stack with weight reduction — install whenever offered.',
      'Avoid rear wing on cross-country and dirt — drag and pitch sensitivity hurt you on bumps.'
    ],
    traps: [
      { trap: 'Widebody for the look on a tight PI budget', why: 'You pay drag and PI for cosmetic visual change', instead: 'Skip widebody unless the wider tires actually save lap time' },
      { trap: 'Rear wing on a speed-circuit build', why: 'Top-speed loss outweighs the cornering gain when most of the lap is straight', instead: 'Front splitter only; tune aero balance forward' }
    ],
    related: ['tires', 'weight']
  },
  {
    slug: 'rims',
    title: 'Rims (Style & Diameter)',
    icon: 'circle',
    summary: 'Cosmetic-looking but real weight. Pick the lightest style at the smallest diameter that fits your target tire width.',
    what: [
      'Rims look like a cosmetic menu but they have real weight implications. At the same diameter, single-piece forged styles are usually the lightest. At different diameters, smaller is lighter and lets you run more sidewall flex (which off-road and rally builds want). Larger rims look more aggressive, weigh more, and worsen aero behaviour at high speed.',
      'Practical rule: pick the smallest diameter that lets your target tire width fit, and the lightest style at that diameter. The PI you save can move 1–2 points to weight reduction or driveline.',
      '15–16" is optimal for off-road; 17–18" is the sweet spot for road racing; 19"+ is heavy and worsens aero unless you specifically need it for tire fitment.'
    ],
    options: [
      { name: 'Stock rims', piCost: '0', bestFor: 'Cars whose stock wheels are already light', tradeoff: 'Often heavier than the lightest aftermarket option' },
      { name: 'Lightest aftermarket style at stock diameter', piCost: '1–3', bestFor: 'Cheapest weight reduction outside the Weight Reduction part itself', tradeoff: 'PI cost is small but real; verify on the car' },
      { name: 'Smaller diameter + light style', piCost: '1–3', bestFor: 'Off-road and rally — sidewall flex is grip', tradeoff: 'Limits how wide you can go on tire fitment' }
    ],
    rules: [
      'Smallest diameter that fits the target tire width. Going bigger costs weight and aero.',
      'Pick by weight, not by looks. The PI difference between rim styles is small but real.',
      'Off-road and rally want smaller diameters for sidewall flex; road racing wants 17–18".'
    ],
    related: ['weight', 'tires']
  }
]

/** Homologation / build-strategy steps — the ordered checklist the user
 *  walks through when building a car. Distilled from the ggwtb / ForzaFire
 *  / kboosting upgrade-order recommendations. */
export interface HomologationStep {
  /** Step number / short title. */
  step: string
  /** What to do at this step. */
  do: string
  /** Why this step lives here (rationale). */
  why: string
  /** Linked upgrade-category slug, if applicable. */
  ref?: string
}

export const HOMOLOGATION_STEPS: HomologationStep[] = [
  {
    step: 'Pick the discipline',
    do: 'Lock in road / dirt / cross-country / drift / drag before touching upgrades.',
    why: 'Every upgrade tier\'s PI-efficiency is discipline-dependent. The same Race-slick tire is the right answer for S1 road and the wrong answer for dirt — and the PI penalty changed in FH6 to make this more punishing.'
  },
  {
    step: 'Set the target class',
    do: 'Choose D/C/B/A/S1/S2/X/R. Class caps in FH6: D 500, C 600, B 700, A 800, S1 900, S2 998, X/R uncapped within slot.',
    why: 'Class boundary determines the PI budget. A 800 PI A-class car will outperform a 701 PI A-class car despite both being "A". Build to within 0–3 PI of the cap.'
  },
  {
    step: 'Decide drivetrain',
    do: 'Keep stock unless a swap clearly serves the discipline. AWD swap = 30–80 PI; RWD swap from factory AWD = usually a net loss.',
    why: 'Drivetrain conversion is the single biggest PI commitment. Get it wrong and your budget for everything else collapses.',
    ref: 'drivetrain-conversion'
  },
  {
    step: 'Choose engine swap (or keep stock)',
    do: 'Only swap if PWR clearly improves. Verify before and after.',
    why: 'A bigger engine that ruins weight balance is a worse car. Many factory engines are already PI-efficient.',
    ref: 'engine-swap'
  },
  {
    step: 'Pick aspiration',
    do: 'Default to centrifugal SC for road; twin turbo only on large displacement; positive-displacement for drift/drag.',
    why: 'Aspiration shape matters as much as peak power. Wrong choice = lag or unusable torque.',
    ref: 'aspiration'
  },
  {
    step: 'Install chassis fundamentals',
    do: 'Suspension class to match discipline (Sport for B/A road, Race for S1+). One brake tier. Race weight reduction.',
    why: 'Chassis fundamentals make every later upgrade work. Skipping them is the classic "fast in a straight line, undriveable in corners" build.',
    ref: 'weight'
  },
  {
    step: 'Tires: compound + width',
    do: 'Match compound to surface. Try front tire width before bumping compound a tier.',
    why: 'FH6 made front tire width a first-class lever. Often beats a compound jump on PI cost.',
    ref: 'tires'
  },
  {
    step: 'Aero, if road racing A-class+',
    do: 'Front splitter first (cheap PI). Rear wing only if rear unhooks in fast corners. Widebody only if you need the wider tires.',
    why: 'Front aero is usually free PI; rear is expensive drag. Widebody is cosmetics unless you use the unlocked fitment.',
    ref: 'aero-body'
  },
  {
    step: 'Drivetrain parts: targeted, not stacked',
    do: 'Race differential mandatory. Sport transmission at B/A, Race at S1+. Skip Race clutch unless on M/C input.',
    why: 'Stacking Race-tier on all five drivetrain parts wastes 15–25 PI. Diff unlocks the tuning sliders; the rest are budget calls.',
    ref: 'drivetrain-parts'
  },
  {
    step: 'Power top-up: hit the class cap',
    do: 'Use engine internals (intake, exhaust, ignition, fuel) to dial PI to the ceiling.',
    why: 'Power last, after the car can handle it. Internals are cheap PI per HP and trim cleanly.'
  },
  {
    step: 'Fine-tune with weight, driveline, flywheel, tire width',
    do: 'When you\'re 1–5 PI over the cap, these are the surgical trims. When you\'re 1–5 PI under, these are the cheap top-ups.',
    why: 'Small adjustments here let you keep upgrades you want elsewhere. The driveline + flywheel pair quietly removes rotating mass too.'
  }
]

/** "Must do" rules — the most-quoted distilled wisdom. Surfaced on the index
 *  page as a prominent pre-built block. */
export const MUST_DO_RULES: Array<{ rule: string, why: string }> = [
  { rule: 'Build before you tune', why: 'No tune fixes a bad build. The parts decide the ceiling; the tune chases it.' },
  { rule: 'Pick discipline first, class second, drivetrain third', why: 'Every later choice gates on those three. Reorder them and you waste PI.' },
  { rule: 'Weight reduction is the only universally efficient upgrade', why: 'The only category rated efficient across all five disciplines. Max it as PI allows.' },
  { rule: 'Match tire compound to surface, not to class', why: 'Race slicks on dirt is a deliberate FH6 PI penalty. Rally / off-road tires are not downgrades.' },
  { rule: 'Try front tire width before stepping compound up', why: 'New in FH6: front width is a first-class lever, often cheaper PI for the same gain.' },
  { rule: 'One brake tier is mandatory above D-class', why: 'Stock brakes lock up under hard downshifts and trail-brake in FH6.' },
  { rule: 'Race differential is the only must-have drivetrain part', why: 'Unlocks the Accel + Decel + AWD center-balance sliders. The other four are budget calls.' },
  { rule: 'Power last — after the car can handle it', why: 'A car that can\'t put down its power is slower than a car with less power and better chassis.' },
  { rule: 'Verify PWR delta before any engine swap', why: 'Bigger engine ≠ better car. If the post-swap PWR doesn\'t improve, skip the swap.' },
  { rule: 'Widebody only if you use the wider tires', why: 'Otherwise you pay drag and PI for cosmetics.' }
]

/** Common "build smells" — the FH6 equivalent of code smells. If you spot
 *  one of these on a build, you have PI to reallocate. */
export interface BuildSmell {
  smell: string
  fix: string
  /** Linked upgrade-category slug if applicable. */
  ref?: string
}

export const BUILD_SMELLS: BuildSmell[] = [
  { smell: 'Race-tier on all five drivetrain parts', fix: 'Keep Race diff; downgrade transmission to Sport at B/A; skip Race clutch on non-M/C input. Reclaim 5–15 PI.', ref: 'drivetrain-parts' },
  { smell: 'Race slicks on a dirt or cross-country build', fix: 'Switch to rally or off-road compound — FH6 made this a hard PI penalty.', ref: 'tires' },
  { smell: 'No brake upgrade above D-class', fix: 'Add one Sport brake tier. 2–5 PI, fixes lockup and trail-brake understeer.', ref: 'brakes' },
  { smell: 'Widebody installed without wider tires or aero use', fix: 'Remove widebody — you\'re paying drag and PI for cosmetics.', ref: 'aero-body' },
  { smell: 'AWD swap on a light low-class car', fix: 'Revert to factory drivetrain; spend the 30–80 PI on tires and weight.', ref: 'drivetrain-conversion' },
  { smell: 'Twin turbo on a sub-2.5L engine', fix: 'Switch to centrifugal SC or single turbo — twin turbos lag without payoff on small engines.', ref: 'aspiration' },
  { smell: 'Race clutch on Automatic or Manual input', fix: 'Skip it — the simulation doesn\'t model your shifting; the upgrade does nothing.', ref: 'drivetrain-parts' },
  { smell: 'Sport / Race suspension on a dirt or off-road build', fix: 'Switch to Rally or Off-road suspension — Sport/Race binds over bumps.', ref: 'suspension-class' },
  { smell: '5+ PI under the class cap', fix: 'Top up with weight reduction, driveline, flywheel, or front tire width. Free lap time.', ref: 'weight' },
  { smell: 'Rear wing on a long-straight speed circuit', fix: 'Remove rear wing or drop a tier — the top-speed loss outweighs cornering gain.', ref: 'aero-body' }
]

export function findUpgradeCategory(slug: string): UpgradeCategory | undefined {
  return UPGRADE_CATEGORIES.find(c => c.slug === slug)
}
