/**
 * Tuning reference content — Forza Horizon 6.
 *
 * Distilled from years of FH4/FH5 community knowledge (ForzaTune, simracingsetup,
 * Forza forums, Diamond Lobby, GAMES.GG, Sportskeeda) and updated for the FH6
 * physics/UI changes (caster sensitivity, fixed brake-bias slider direction,
 * tighter differential default ranges, tire-width / track-width as first-class
 * build levers, R-Class).
 *
 * Tied to the telemetry signals this app decodes from the Car Dash packet —
 * each entry tells the user *which trace to look at* before reaching for the
 * tuning menu. Pure data; rendered by /tune pages.
 */

export type SignalKey
  = | 'suspension'
    | 'slipRatio'
    | 'slipAngle'
    | 'tireTempC'
    | 'throttle'
    | 'brake'
    | 'steer'
    | 'speed'
    | 'rumble'
    | 'boost'
    | 'gear'

export interface SignalRef {
  key: SignalKey
  /** Short hint for what to look for in this signal. */
  look: string
}

export interface SettingControl {
  /** In-game setting name(s) covered by this control. */
  name: string
  /** Typical range / starting point for this category. */
  range: string
  /** What raising the value does, in one short clause. */
  raises: string
  /** What lowering it does. */
  lowers: string
}

export interface Symptom {
  /** Driver-felt complaint. */
  symptom: string
  /** Cause hypothesis grounded in vehicle physics. */
  likelyCause: string
  /** Concrete tuning change. */
  fix: string
}

export interface TuneCategory {
  slug: string
  title: string
  /** Single-sentence summary for index cards and meta. */
  summary: string
  /** Free-text "what does this thing actually do" — markdown-ish but rendered as plain paragraphs. */
  what: string[]
  /** Settings exposed in-game under this category. */
  controls: SettingControl[]
  /** Telemetry signals to watch when diagnosing this category. */
  signals: SignalRef[]
  /** Symptom → fix table. */
  symptoms: Symptom[]
  /** Cross-references to other categories. */
  related?: string[]
  /** Slug of icon from `lucide` set (no `i-` prefix). */
  icon: string
}

/** Friendly labels for telemetry signals (matches the packet decoder fields). */
export const SIGNAL_LABEL: Record<SignalKey, string> = {
  suspension: 'Suspension travel',
  slipRatio: 'Tire slip ratio (longitudinal)',
  slipAngle: 'Tire slip angle (lateral)',
  tireTempC: 'Tire temperature',
  throttle: 'Throttle input',
  brake: 'Brake input',
  steer: 'Steering input',
  speed: 'Speed',
  rumble: 'Rumble strip / off-track',
  boost: 'Boost (turbo)',
  gear: 'Gear'
}

export const SIGNAL_WHERE: Record<SignalKey, string> = {
  suspension: 'Corner panels, suspension bar (0..1, flashes red at >0.95)',
  slipRatio: 'Corner panels, "slip R" — front/rear and L/R',
  slipAngle: 'Corner panels, "slip A" — compare front vs rear',
  tireTempC: 'Corner panels, tire temp heatmap (cold blue → optimal green → hot red)',
  throttle: 'Trace strip, green line',
  brake: 'Trace strip, red line',
  steer: 'Trace strip, yellow line',
  speed: 'Center panel + replay',
  rumble: 'Corner panel rumble dot',
  boost: 'Center panel (when turbo equipped)',
  gear: 'Center panel'
}

export const TUNE_CATEGORIES: TuneCategory[] = [
  {
    slug: 'springs',
    title: 'Springs (Rate)',
    icon: 'waves',
    summary: 'Front vs rear spring rate sets the corner-balance floor. Softer end is the one that loses grip.',
    what: [
      'Springs support the car against weight transfer. The stiffer end of the car has less mechanical grip because the contact patch is loaded harder and unloaded faster. Counter-intuitive but consistent: the soft end keeps grip, the stiff end gives it up.',
      'Forza shows spring rate in lb/in (or kg/mm). The numbers are car-specific — what matters is the front-to-rear ratio relative to weight distribution. A nose-heavy car can take stiffer rears than its weight split suggests, because the front already has plenty of static load.',
      'Going too soft on both ends gives a wallowy car that bottoms out; going too stiff gives a skittish car that skips over bumps and lights up its tires.'
    ],
    controls: [
      {
        name: 'Front springs',
        range: 'Lower 1/3 of slider for road, mid for track, upper for stiff race cars',
        raises: 'less front grip (more understeer), faster response, more bottoming resistance',
        lowers: 'more front grip (less understeer), slower response, risk of front bottoming'
      },
      {
        name: 'Rear springs',
        range: 'Usually within 10–20% of front rate; closer to equal for RWD, stiffer-rear for FWD',
        raises: 'less rear grip (more oversteer), better rear bottoming resistance',
        lowers: 'more rear grip (less oversteer), more squat under power'
      }
    ],
    signals: [
      { key: 'suspension', look: 'Hits >0.95 on bumps or compressions → too soft; barely moves over rough surfaces → too stiff' },
      { key: 'slipAngle', look: 'Front >> rear in steady mid-corner = understeer (soften front or stiffen rear). Rear >> front = oversteer (the reverse).' },
      { key: 'tireTempC', look: 'Cold tires on one axle vs the other = that axle isn\'t loading its contact patch — likely too stiff for the surface' }
    ],
    symptoms: [
      { symptom: 'Bottoms out over kerbs / crests', likelyCause: 'Spring rate too low for the suspension travel available', fix: 'Stiffen the axle that bottoms; if both, raise overall rate or raise ride height' },
      { symptom: 'Car feels wallowy and slow to respond', likelyCause: 'Both springs too soft', fix: 'Raise both rates ~10% and re-test; pair with damper bump bump-up' },
      { symptom: 'Mid-corner push (steady understeer)', likelyCause: 'Front too stiff relative to rear', fix: 'Soften fronts a touch OR stiffen rears (latter helps if front bottoms)' },
      { symptom: 'Mid-corner loose (steady oversteer)', likelyCause: 'Rear too stiff relative to front', fix: 'Soften rears a touch; check rear ARB first (cheaper change)' }
    ],
    related: ['anti-roll-bars', 'dampers', 'ride-height']
  },
  {
    slug: 'dampers',
    title: 'Dampers (Bump & Rebound)',
    icon: 'gauge',
    summary: 'Dampers control how fast the suspension moves. Bump = compression speed, rebound = extension speed.',
    what: [
      'Springs decide how far the suspension travels; dampers decide how quickly. Stiff dampers make weight transfer feel sharp and immediate; soft dampers smear it across more time so the car feels languid but glued.',
      'Industry rule of thumb (used by ForzaTune and most community calculators): bump ≈ 60–70% of rebound. That asymmetry is because the spring is doing some of the work on the way back — rebound mostly fights overshoot, while bump has to absorb the full hit.',
      'Like springs, dampers can shift corner balance, but the effect only appears during a *transition* (turn-in, throttle-on, kerbs). Steady-state balance is a spring / ARB job.'
    ],
    controls: [
      { name: 'Rebound stiffness (front/rear)', range: 'Often 6–12 on the in-game scale; tied to spring rate', raises: 'sharper rebound, more stable on smooth tarmac; can crash over kerbs', lowers: 'softer rebound, soaks up bumps; can let car oscillate' },
      { name: 'Bump stiffness (front/rear)', range: '60–70% of rebound is a safe start', raises: 'crisp on turn-in but rejects bumps', lowers: 'absorbs hits but allows pitch dive' }
    ],
    signals: [
      { key: 'suspension', look: 'Plot the bar after a kerb: if it bounces back and oscillates, rebound is too soft. If it crashes back down hard, rebound is too stiff.' },
      { key: 'slipRatio', look: 'Spikes after a bump = wheel skipped briefly → dampers (usually bump) too stiff' },
      { key: 'slipAngle', look: 'Sharp turn-in oversteer that settles after 100 ms = front rebound too aggressive (front pops up, rear stays planted)' }
    ],
    symptoms: [
      { symptom: 'Car oscillates after kerbs / bumps', likelyCause: 'Rebound too soft — spring overshoots and dampers don\'t catch it', fix: 'Raise rebound 1–2 clicks on the offending axle' },
      { symptom: 'Car "skips" or loses grip over rough surfaces', likelyCause: 'Bump too stiff — wheel can\'t follow the surface', fix: 'Lower bump 1–2 clicks; if symptom is one axle only, just that axle' },
      { symptom: 'Snap oversteer on turn-in', likelyCause: 'Front rebound too high → front unloads aggressively', fix: 'Soften front rebound; consider softening rear bump to match' },
      { symptom: 'Sluggish response, vague turn-in', likelyCause: 'Bump too soft', fix: 'Raise front bump 1–2 clicks first' }
    ],
    related: ['springs', 'anti-roll-bars']
  },
  {
    slug: 'anti-roll-bars',
    title: 'Anti-Roll Bars (ARBs)',
    icon: 'rotate-3d',
    summary: 'The cheapest balance tweak. Stiffer ARB on an axle = less grip on that axle.',
    what: [
      'ARBs link left and right wheels on the same axle. Under cornering, the bar transfers load from the outside to the inside wheel, reducing roll. The stiffer the bar, the more aggressively it transfers load — and load transfer reduces grip.',
      'Almost every community guide says: tune ARBs *before* you touch springs, because ARBs affect cornering balance without breaking your bump/ride-height work. Springs are coarse, ARBs are fine.',
      'Default front ARB is usually stiffer than rear; that keeps the rear planted on weight transfer. Drift setups invert this.'
    ],
    controls: [
      { name: 'Front ARB', range: '20–35 on most cars', raises: 'less front grip — adds understeer', lowers: 'more front grip — reduces understeer' },
      { name: 'Rear ARB', range: 'Usually 60–90% of front', raises: 'less rear grip — adds oversteer (good for FWD or AWD that pushes)', lowers: 'more rear grip — reduces oversteer (good for skittish RWD)' }
    ],
    signals: [
      { key: 'slipAngle', look: 'Front-axle slip > rear in mid-corner = understeer → soften front ARB or stiffen rear. Opposite for oversteer.' },
      { key: 'suspension', look: 'Asymmetric L/R compression in steady cornering: very large delta = the ARB on that axle is doing a lot of work. Reduce if the axle is losing grip.' },
      { key: 'tireTempC', look: 'Outside tire much hotter than inside on the same axle = ARB is doing its job. Both edges very hot = car rolls too much overall (more ARB or more spring).' }
    ],
    symptoms: [
      { symptom: 'Steady understeer through long sweeping corners', likelyCause: 'Front ARB too stiff vs rear', fix: 'Lower front ARB by 2–4 clicks; if still pushy, raise rear ARB' },
      { symptom: 'Steady oversteer mid-corner', likelyCause: 'Rear ARB too stiff vs front', fix: 'Lower rear ARB by 2–4 clicks first' },
      { symptom: 'AWD car plows in tight corners', likelyCause: 'Rear ARB too soft; rear sticks while front washes', fix: 'Stiffen rear ARB; also consider center diff to send less power forward' },
      { symptom: 'Car rolls heavily, slow direction changes (chicanes)', likelyCause: 'Both ARBs too soft', fix: 'Raise both, keeping front:rear ratio' }
    ],
    related: ['springs', 'dampers']
  },
  {
    slug: 'ride-height',
    title: 'Ride Height',
    icon: 'arrow-down-up',
    summary: 'Lower = lower CoG = more grip. Too low = bottoming and broken suspension geometry.',
    what: [
      'Lower ride height drops the centre of gravity, reduces weight transfer, and improves cornering grip. The trade-off is suspension travel: the lower you sit, the easier it is to bottom out, and the harder dampers have to work to keep wheels on the ground.',
      'A small front-low rake (front slightly lower than rear) shifts a touch of static load forward and helps turn-in; rear-low rake does the opposite. Rake interacts with aero on cars with downforce — front-low feeds the diffuser less air than rear-low.',
      'Off-road and rally builds typically need 1–2 inches more than the slider minimum to clear ruts and bumps without bottoming.'
    ],
    controls: [
      { name: 'Front ride height', range: 'Minimum for track, mid for road, max for off-road', raises: 'higher CoG (less grip) but more travel', lowers: 'lower CoG (more grip), bottoming risk, sharper turn-in if lower than rear' },
      { name: 'Rear ride height', range: 'Equal to or 0.1–0.4" higher than front for most setups', raises: 'shifts weight forward, helps turn-in', lowers: 'shifts weight rearward, more rear grip, less rotation' }
    ],
    signals: [
      { key: 'suspension', look: 'Frequent >0.95 bottoming over normal road bumps = too low. Add height before stiffening springs.' },
      { key: 'rumble', look: 'Off-road or rumble strips lighting up while the underside grinds = you\'re scraping. Telemetry won\'t tell you scraping directly; rumble + repeated bottoming is the proxy.' }
    ],
    symptoms: [
      { symptom: 'Bottoms repeatedly on a smooth track', likelyCause: 'Ride height too low for spring/damper choice', fix: 'Raise 0.1–0.2" first; only stiffen springs if travel is otherwise wasted' },
      { symptom: 'Vague turn-in, car pushes initially', likelyCause: 'Too much front ride height OR rear lower than front', fix: 'Drop front a notch or raise rear slightly to add front rake' },
      { symptom: 'Off-road car bottoms over ruts even on stiff springs', likelyCause: 'Not enough total travel', fix: 'Raise ride height before adding more spring rate' }
    ],
    related: ['springs', 'aero']
  },
  {
    slug: 'alignment',
    title: 'Alignment (Camber, Caster, Toe)',
    icon: 'crosshair',
    summary: 'How the tires sit relative to the road. Sets the contact patch under cornering, braking, and steering.',
    what: [
      'Camber is the inward tilt of the tire as viewed from the front. Negative camber tips the top of the tire inward; as the car rolls in a corner, the outside tire flattens onto the road. A common starting point is −1.0 to −2.0° fronts, −0.5 to −1.5° rears. Too much and you wear the inside in straight-line driving (and lose braking grip).',
      'Caster is only on the front: the tilt of the steering axis. Positive caster (almost always positive in Forza) increases self-centering and adds camber gain when steering — meaning more grip in slow corners without paying for it on the straights. FH6 is noticeably more sensitive to caster than older Horizon titles — values above ~6.0° feel snappy on turn-in. A safe FH6 range is 5.0–6.0°.',
      'Toe is the angle of the tires viewed from above. Toe-in (toes pointing together) adds stability but hurts turn-in and adds drag. Toe-out adds turn-in response but makes the car twitchy. Most road/track tunes run zero or slight toe-in at the rear, slight toe-out at the front. FH6 sign convention is inverted from real-world: a NEGATIVE value is toe-in (stable), a POSITIVE value is toe-out (responsive) — so stabilizing rear toe-in is a negative number in-game.'
    ],
    controls: [
      { name: 'Front camber', range: '−0.5° to −3.0°', raises: '(toward 0°) more straight-line grip, less cornering grip', lowers: '(more negative) more cornering grip, hot inside edge in temps' },
      { name: 'Rear camber', range: '−0.5° to −2.0° (less than front)', raises: 'more rear straight-line grip — better launches', lowers: 'more rear cornering grip — less wheelspin under power on lateral load' },
      { name: 'Front caster', range: '5.0–6.0° in FH6 (above 6° gets twitchy on turn-in)', raises: 'faster centering, more camber gain in turns, heavier steering feel — snappy past 6°', lowers: 'lighter steering but less self-centering' },
      { name: 'Front toe', range: '−0.1° (in) to +0.2° (out) — FH6: − is in, + is out', raises: '(toward +, toe-out) sharper turn-in, twitchy on straights', lowers: '(toward −, toe-in) stability, dulls turn-in' },
      { name: 'Rear toe', range: '−0.3° (in) to 0° — FH6: − is in, + is out', raises: '(toward 0/+, toe-out) rotation aid; can make the rear nervous', lowers: '(more negative, toe-in) more rear stability, more understeer' }
    ],
    signals: [
      { key: 'tireTempC', look: 'Forza gives one temp per tire (not 3-point). Asymmetric F vs R on the same side hints at camber bias; hot fronts + cold rears = front-end pushing.' },
      { key: 'slipAngle', look: 'High slip with low temp on the same tire = that tire isn\'t loading evenly — usually too much camber for the speed range' },
      { key: 'steer', look: 'Constant correction (steering trace dancing) at speed = too much front toe-out, or too little caster' }
    ],
    symptoms: [
      { symptom: 'Inside edge of front tires runs much hotter (relative to others)', likelyCause: 'Too much negative front camber for the cornering speed', fix: 'Reduce front camber 0.3–0.5°' },
      { symptom: 'Outside edge runs hotter, car pushes mid-corner', likelyCause: 'Not enough negative camber — outside tire rolling onto its shoulder', fix: 'Add 0.3–0.5° negative camber' },
      { symptom: 'Twitchy on straights at speed', likelyCause: 'Too much front toe-out OR (FH6) too much caster above 6°', fix: 'Reduce front toe toward 0; if caster is already 6°+, drop it 0.5° rather than raising it' },
      { symptom: 'Car feels slow to turn but stable', likelyCause: 'Too much rear toe-in', fix: 'Reduce rear toe toward 0' },
      { symptom: 'Rear wags after gear shifts / throttle stabs', likelyCause: 'Rear toe at 0 with stiff suspension', fix: 'Add −0.1 to −0.2° rear toe-in for stability (negative = toe-in in FH6)' }
    ],
    related: ['tire-pressure', 'differential']
  },
  {
    slug: 'tire-pressure',
    title: 'Tire Pressure',
    icon: 'wind',
    summary: 'Sets the contact-patch shape and how grip loss feels (gradual vs sudden).',
    what: [
      'Higher pressure presses the middle of the tire harder into the road — peak grip is higher but the falloff into a slide is sharp and unforgiving. Lower pressure spreads the contact patch, gives more total grip up to a lower peak, and the slide arrives gradually.',
      'Community wisdom carrying into FH6: start with cold pressures around 28–30 psi (1.9–2.1 bar) and aim for warm pressures of 32–34 psi (2.2–2.35 bar). Cold start values are what the slider shows; warm pressures are what the tires actually run at after a few corners.',
      'Front and rear are usually equal. Using pressure to fix balance is a last resort — it changes contact patch shape too, which interacts with camber. Use ARBs first.',
      'FH6 build note: front tire **width** is now a first-class lever — if you need more front grip you can widen the fronts without bumping to the next compound tier (a path that didn\'t exist in FH5). Lives in the upgrade menu, not the tune sliders.'
    ],
    controls: [
      { name: 'Front tire pressure', range: '28–34 psi', raises: 'sharper response, higher peak grip, snappier breakaway', lowers: 'softer response, more progressive slide, more heat buildup' },
      { name: 'Rear tire pressure', range: '28–34 psi (usually equal to front)', raises: 'less rear grip overall (good vs oversteer on grip-limited cars)', lowers: 'more rear grip, more tendency to overheat under power' }
    ],
    signals: [
      { key: 'tireTempC', look: 'Sustained >100 °C after 1–2 laps = underinflated for the load. Cold tires (<70 °C) after a hard lap = overinflated or insufficient camber.' },
      { key: 'slipAngle', look: 'Slip ramps quickly past 0.4 with no warning = pressure too high; slip creeps up steadily = pressure low' },
      { key: 'slipRatio', look: 'On power, slip ratio spikes immediately past 0.1 then drops = wheelspin breaking traction sharply (high pressure)' }
    ],
    symptoms: [
      { symptom: 'Tires overheat by lap 2', likelyCause: 'Underinflated → too much sidewall flex', fix: 'Raise the corner that\'s hot by 1–2 psi' },
      { symptom: 'Car loses grip very suddenly (snap)', likelyCause: 'Overinflated — small contact patch at the limit', fix: 'Lower pressure 1–2 psi; recheck slip-angle behavior on telemetry' },
      { symptom: 'Tires never reach optimal band (always cold)', likelyCause: 'Overinflated or under-loaded (too much camber)', fix: 'Drop pressure first, then revisit camber' }
    ],
    related: ['alignment', 'differential']
  },
  {
    slug: 'differential',
    title: 'Differential (Accel & Decel)',
    icon: 'cog',
    summary: 'Controls how much the driven wheels lock together — at acceleration and on engine braking.',
    what: [
      'Forza\'s diff is a clutch-pack LSD with two values: Acceleration % and Deceleration %. Both are "how much the diff locks" — 0% is fully open (each wheel free to spin independently), 100% is locked (both driven wheels turning together regardless of grip).',
      'Higher accel % = more traction off corners (good for power-down), but the locked wheels resist rotation, so the car understeers more on throttle exit. Lower accel = the inside wheel can spin freely, the car rotates more on throttle but may dribble power.',
      'Higher decel % = stable corner entry (engine braking pushed evenly to both wheels), but reduces rotation on lift-off. Lower decel = the rear can swing on lift, useful for RWD trail-braking.',
      'For FWD cars, the LSD on the front works the same way — but stiffening accel adds torque-steer.'
    ],
    controls: [
      { name: 'Acceleration (driven axle)', range: 'FH6 RWD: 40–60%. AWD: 50–70%. Drag: 80–100%. Drift: 100%. FWD road: 20–40%. (FH6 narrowed the useful band — defaults sit lower than in FH5.)', raises: 'more traction out of corners, more on-power understeer', lowers: 'more rotation on throttle, risk of inside-wheel spin' },
      { name: 'Deceleration (driven axle)', range: 'FH6 RWD/AWD: 20–40%; higher for rally', raises: 'stable on entry, less rotation on lift', lowers: 'more rotation on lift-off, useful for trail-braking, can feel nervous' }
    ],
    signals: [
      { key: 'slipRatio', look: 'Compare driven-axle L vs R under power. Big asymmetry (one wheel spinning, the other gripping) = diff too open → raise accel. Both spinning equally = diff working, look at tires/aero.' },
      { key: 'throttle', look: 'Cross-reference throttle trace with slip-ratio spikes — if every throttle stab causes wheelspin, the issue is diff (or tire pressure) not driver' },
      { key: 'slipAngle', look: 'On lift-off into a corner: rear slip-angle spike for RWD = low decel %, may want more if you want stability. Drifters keep it low on purpose.' }
    ],
    symptoms: [
      { symptom: 'One rear wheel lights up under power, other doesn\'t', likelyCause: 'Diff too open under acceleration', fix: 'Raise accel % by 10 at a time until both wheels share slip' },
      { symptom: 'Car pushes wide on throttle out of slow corners', likelyCause: 'Accel % too high — diff locking and resisting rotation', fix: 'Lower accel by 5–10' },
      { symptom: 'Snap oversteer on lift-off (RWD)', likelyCause: 'Decel % too low — rear unhooks when engine drags', fix: 'Raise decel 5–10' },
      { symptom: 'AWD car turns in, then pushes the moment you touch gas', likelyCause: 'High accel combined with rear-biased center diff fighting itself', fix: 'Drop accel a step; consider shifting center diff slightly forward' }
    ],
    related: ['center-diff', 'alignment', 'tire-pressure']
  },
  {
    slug: 'center-diff',
    title: 'Center Differential (AWD)',
    icon: 'split',
    summary: 'Front/rear power split for AWD cars. Higher = more rear bias = more RWD-like.',
    what: [
      'Only appears on AWD cars (DrivetrainType = 2). The number is the percentage of torque sent rearward. 50% is a true 50:50 split; 100% is fully RWD-like.',
      'Standard track AWD lives around 65–80% (rear-biased). Drift builds push 90–100%. Rally builds sit closer to 50–60% so the front wheels can pull the car through ruts and loose surfaces. Drag setups can go either way depending on launch weight transfer.',
      'Center diff is the *cheapest* way to change AWD character without changing chassis balance. Moving 10% forward fixes a lot of corner-exit understeer at the cost of some throttle response.'
    ],
    controls: [
      { name: 'Center diff (% to rear)', range: '50–100%; defaults often 70%', raises: 'more RWD-like — more rotation on throttle, risk of corner-exit oversteer', lowers: 'more pull-out-of-corner traction, more on-throttle understeer' }
    ],
    signals: [
      { key: 'slipRatio', look: 'Compare front-axle vs rear-axle slip under power. Fronts slipping with rears gripping = too much front bias; rears slipping with fronts gripping = too rear-biased.' },
      { key: 'slipAngle', look: 'On corner exit: if the front pushes wide while the rear stays planted = center diff too far rear, fronts have no power to help pull through' }
    ],
    symptoms: [
      { symptom: 'AWD car understeers on corner exit', likelyCause: 'Too rear-biased — fronts have no torque to pull car straight', fix: 'Shift center diff 5–10% forward' },
      { symptom: 'Rear steps out under power on AWD', likelyCause: 'Too rear-biased AND/OR accel diff too locked', fix: 'Shift center diff 5–10% forward; if it stays, drop accel diff %' },
      { symptom: 'Car feels heavy on turn-in, doesn\'t rotate', likelyCause: 'Center diff too forward', fix: 'Shift 5–10% rearward; recheck' }
    ],
    related: ['differential']
  },
  {
    slug: 'brakes',
    title: 'Brakes (Bias & Pressure)',
    icon: 'gauge-circle',
    summary: 'Brake bias balances lockup risk front vs rear. Pressure scales overall braking force.',
    what: [
      'Brake bias is the percentage of braking force sent to the front. Defaults are usually 50–55% forward. More forward = more stability under hard braking; more rearward = more rotation but lockup risk grows. (FH6 fixed the long-standing FH5 bug where the slider label was inverted — the % front label now matches what the slider actually does. Forum advice quoted from FH5 era may say to "shift the slider the opposite of the label" — that no longer applies.)',
      'Pressure is a multiplier on total brake force. Leave at 100% unless you have a specific lockup problem you can\'t solve with bias. Reducing pressure makes ABS-off braking more forgiving.',
      'Trail-braking changes everything: as you carry brake into a corner, weight is forward, so even a 50% bias acts rear-heavy. If you trail-brake and get turn-in understeer, *shift bias 1–2% rearward* — counter-intuitive but real.'
    ],
    controls: [
      { name: 'Brake balance (% front)', range: '45–60% typical', raises: 'more stability, more front lockup risk, more understeer under brakes', lowers: 'more rotation under brakes, more rear lockup risk (snap-spin)' },
      { name: 'Brake pressure', range: '90–100% (rarely below 90%)', raises: 'shorter stopping, more lockup risk at high speed', lowers: 'gentler braking, harder to lock but longer stopping distance' }
    ],
    signals: [
      { key: 'slipRatio', look: 'Under braking, slip ratio < 0 (negative) means lockup. Front slip negative + rear at 0 = front lockup → shift bias rearward. Rear locked = shift forward.' },
      { key: 'brake', look: 'Cross-reference brake trace with slip spikes — if every hard brake event spikes one axle, that\'s the lockup tell' },
      { key: 'slipAngle', look: 'Trail-braking: turn-in slip-angle spike on front = front losing it under combined brake + cornering. Shift bias slightly rearward.' }
    ],
    symptoms: [
      { symptom: 'Front wheels lock approaching corners, car plows past turn-in', likelyCause: 'Too much forward bias OR too much pressure', fix: 'Bias 1–2% rear; if still locking, drop pressure to 95%' },
      { symptom: 'Rear locks under heavy braking, car spins', likelyCause: 'Too much rear bias', fix: 'Bias 1–2% forward immediately' },
      { symptom: 'Trail-braking causes understeer at turn-in', likelyCause: 'Bias too forward when you add lateral load on top of braking', fix: 'Bias 1–2% rear; the steady-state and trail-brake optimums differ' },
      { symptom: 'Snap-spin under braking on bumpy surface', likelyCause: 'Rear briefly unloads + bias too rear', fix: 'Move bias forward by 2%; also check rear bump damping' }
    ],
    related: ['dampers', 'differential']
  },
  {
    slug: 'aero',
    title: 'Aero (Downforce)',
    icon: 'plane',
    summary: 'Trades top speed for cornering grip. Effect scales with speed² — irrelevant in slow corners.',
    what: [
      'Aero only matters above ~100 km/h, and grip from downforce scales with the square of speed. At 200 km/h, downforce is 4× what it was at 100 km/h. Below 80 km/h, you might as well not have a wing.',
      'Front aero: run it high. More front downforce means more high-speed turn-in grip. The cost (top speed) is small for the front splitter; the gain (cornering) is large. Default to max front for most circuits.',
      'Rear aero: run as little as you can get away with. Rear wing drag is huge — drop it as far as you can without the rear stepping out in high-speed corners. If the rear feels loose only above 150 km/h, that\'s a rear-wing problem.',
      'Widebody kits in FH6 unlock front-axle downforce on cars that previously couldn\'t adjust it.',
      'Some cars don\'t have adjustable aero. Some have aero only at one end. Mods/upgrade slots unlock it.'
    ],
    controls: [
      { name: 'Front downforce', range: 'Usually run at max for road and circuit; lower for top-speed builds', raises: 'more high-speed turn-in grip; small top-speed loss', lowers: 'better top speed; high-speed understeer creeps in' },
      { name: 'Rear downforce', range: 'Start at minimum; raise only if rear unsticks in fast corners', raises: 'high-speed rear stability; significant top-speed loss', lowers: 'big top-speed gain; fast-corner oversteer if too low' }
    ],
    signals: [
      { key: 'slipAngle', look: 'High-speed corner only: rear slip-angle spike at 180+ km/h but fine at 100 km/h = rear aero too low' },
      { key: 'speed', look: 'Replay any fast lap; correlate slip events with speed. Slip events that cluster at high speed point to aero, not chassis' }
    ],
    symptoms: [
      { symptom: 'Rear pops out only in fast corners', likelyCause: 'Rear downforce too low', fix: 'Raise rear wing 2–3 steps; recheck top speed' },
      { symptom: 'Car feels glued in fast corners but slow on straights', likelyCause: 'Too much rear wing', fix: 'Drop rear wing 2–3 steps' },
      { symptom: 'Fast-corner understeer regardless of throttle', likelyCause: 'Front aero too low', fix: 'Raise front to max first; if max already, look at front camber/ARB' }
    ],
    related: ['ride-height', 'gearing']
  },
  {
    slug: 'gearing',
    title: 'Gear Ratios & Final Drive',
    icon: 'sliders-horizontal',
    summary: 'Picks the speeds at which each gear lives. Final drive scales everything together.',
    what: [
      'Each gear maps an engine RPM range to a road speed range. The goal is to keep the engine in its power band — usually the upper third of the rev range, near peak torque, when you\'re accelerating.',
      'Final Drive Ratio (FDR) is a multiplier on all gears. A higher FDR (e.g. 4.0) makes every gear shorter — more acceleration, lower top speed. A lower FDR (e.g. 3.0) does the opposite.',
      'For drag racing, raise FDR until the car redlines just past the strip length. For circuit, set FDR so you redline in top gear at the longest straight. For free-roam highway, lower FDR opens up top-end cruising.',
      'Individual gears can be tweaked to close gaps where the engine drops out of power. ForzaTune\'s rule: only mess with individual gears if a *specific* shift point feels wrong.'
    ],
    controls: [
      { name: 'Final Drive (FDR)', range: '2.5–5.0; tune to redline at end of longest straight', raises: 'snappier acceleration, lower top speed', lowers: 'faster top speed, lazier acceleration' },
      { name: 'Individual gear ratios', range: 'Adjust only if a gear shift drops the engine out of the power band', raises: 'shorter gear (faster engine for same road speed)', lowers: 'taller gear (lower revs for same speed)' }
    ],
    signals: [
      { key: 'gear', look: 'During a straight, count seconds the car spends in top gear. Less than 1–2 s = FDR too short (you\'re redlining mid-straight)' },
      { key: 'speed', look: 'Speed plateauing well before the next corner = top gear too tall — drop FDR slightly to use the headroom' },
      { key: 'boost', look: 'Boost dropping after each shift = gears too far apart, engine falls out of boost' }
    ],
    symptoms: [
      { symptom: 'Redline before the end of the longest straight', likelyCause: 'FDR too high (gears too short)', fix: 'Lower FDR 5–10%' },
      { symptom: 'Top gear never reached / car runs out of revs', likelyCause: 'FDR too low (gears too tall)', fix: 'Raise FDR 5–10%' },
      { symptom: 'Engine drops out of boost after each upshift', likelyCause: 'Gears spaced too widely', fix: 'Shorten the upper gears so each shift drops only ~1000 rpm' },
      { symptom: '1st gear spins tires off the line', likelyCause: '1st too short — driveshaft torque too high', fix: 'Lengthen 1st or raise tire pressure / drop accel diff %' }
    ],
    related: ['differential', 'aero']
  }
]

/** Symptom-first cross-cut for the diagnose view. */
export interface DiagnosisEntry {
  symptom: string
  /** Which corner of the lap this typically appears at. */
  phase: 'entry' | 'mid' | 'exit' | 'braking' | 'straight' | 'bumps'
  /** Signals to look at first in the live or replay view. */
  signals: SignalRef[]
  /** Ordered list of categories to investigate, most-likely first. */
  investigate: { slug: string, note: string }[]
}

export const DIAGNOSES: DiagnosisEntry[] = [
  {
    symptom: 'Understeer on corner entry',
    phase: 'entry',
    signals: [
      { key: 'slipAngle', look: 'Front >> rear at the moment of turn-in' },
      { key: 'brake', look: 'Are you still braking when steering? Trail-brake may be the cause' }
    ],
    investigate: [
      { slug: 'brakes', note: 'If trail-braking — shift bias 1–2% rear' },
      { slug: 'alignment', note: 'Front toe-out or higher caster helps turn-in' },
      { slug: 'anti-roll-bars', note: 'Soften front ARB if mid-entry still pushes' }
    ]
  },
  {
    symptom: 'Understeer mid-corner (steady)',
    phase: 'mid',
    signals: [
      { key: 'slipAngle', look: 'Sustained front-axle slip while throttle and brake are near zero' },
      { key: 'tireTempC', look: 'Fronts hot, rears cold = chassis balance is front-limited' }
    ],
    investigate: [
      { slug: 'anti-roll-bars', note: 'Soften front ARB first — cheapest, most targeted' },
      { slug: 'springs', note: 'If ARB alone doesn\'t fix it, soften fronts a touch' },
      { slug: 'aero', note: 'In fast corners only: raise front aero' }
    ]
  },
  {
    symptom: 'Understeer on power (exit)',
    phase: 'exit',
    signals: [
      { key: 'throttle', look: 'Symptom appears as throttle ramps in' },
      { key: 'slipAngle', look: 'Front slip spikes after throttle application' },
      { key: 'slipRatio', look: 'Driven-wheel L/R asymmetry shows open-diff slip' }
    ],
    investigate: [
      { slug: 'differential', note: 'Lower accel % a step to let car rotate; or close the diff if open-wheel spin' },
      { slug: 'center-diff', note: 'AWD: shift center diff 5–10% forward' },
      { slug: 'anti-roll-bars', note: 'Soften front ARB if combined with mid-corner push' }
    ]
  },
  {
    symptom: 'Oversteer on entry (lift-off)',
    phase: 'entry',
    signals: [
      { key: 'slipAngle', look: 'Rear-axle slip spikes when throttle goes to 0' },
      { key: 'throttle', look: 'Are you fully off the gas before turn-in? Lift-oversteer arrives a beat after lift' }
    ],
    investigate: [
      { slug: 'differential', note: 'Raise decel % — locks rear wheels together, more stable on engine braking' },
      { slug: 'alignment', note: 'Add −0.1 to −0.2° rear toe-in for stability (negative = toe-in in FH6)' },
      { slug: 'dampers', note: 'Soften front rebound to slow the front unloading on lift' }
    ]
  },
  {
    symptom: 'Oversteer mid-corner (steady)',
    phase: 'mid',
    signals: [
      { key: 'slipAngle', look: 'Rear >> front in steady cornering' },
      { key: 'tireTempC', look: 'Rears hot, fronts cold = rear-limited chassis' }
    ],
    investigate: [
      { slug: 'anti-roll-bars', note: 'Soften rear ARB first' },
      { slug: 'springs', note: 'If still loose, soften rear springs' },
      { slug: 'aero', note: 'In fast corners: raise rear downforce' }
    ]
  },
  {
    symptom: 'Oversteer on power (exit)',
    phase: 'exit',
    signals: [
      { key: 'throttle', look: 'Symptom appears as throttle goes in' },
      { key: 'slipRatio', look: 'Rear-axle slip ratio > 0.1 = wheelspin' }
    ],
    investigate: [
      { slug: 'differential', note: 'Lower accel % (less rear lock); for RWD also try lower decel if you can\'t commit early' },
      { slug: 'tire-pressure', note: 'Drop rear 1–2 psi to widen contact patch' },
      { slug: 'center-diff', note: 'AWD: shift center diff 5% forward to bleed off rear torque' }
    ]
  },
  {
    symptom: 'Front brake lockup',
    phase: 'braking',
    signals: [
      { key: 'slipRatio', look: 'Front slip negative under brakes; rear at ~0' },
      { key: 'brake', look: 'Find the brake-trace peaks where lockup happens' }
    ],
    investigate: [
      { slug: 'brakes', note: 'Bias 1–2% rear; if still locking, drop pressure to ~95%' }
    ]
  },
  {
    symptom: 'Rear brake lockup / spin under brakes',
    phase: 'braking',
    signals: [
      { key: 'slipRatio', look: 'Rear slip negative under brakes' },
      { key: 'slipAngle', look: 'Rear slip angle climbing while braking straight' }
    ],
    investigate: [
      { slug: 'brakes', note: 'Bias 1–2% forward immediately' },
      { slug: 'dampers', note: 'Check rear bump — bumpy braking can unload the rear' }
    ]
  },
  {
    symptom: 'Bottoming over kerbs and bumps',
    phase: 'bumps',
    signals: [
      { key: 'suspension', look: 'Bar pegs >0.95 frequently; flashing red' }
    ],
    investigate: [
      { slug: 'ride-height', note: 'Raise ride height before stiffening springs' },
      { slug: 'springs', note: 'If height is already up, raise the offending axle\'s springs' },
      { slug: 'dampers', note: 'Bump damping shapes how the hit is absorbed' }
    ]
  },
  {
    symptom: 'Wheelspin on launch / slow corners',
    phase: 'exit',
    signals: [
      { key: 'slipRatio', look: 'Driven wheels >> 0.1 with steady throttle' },
      { key: 'gear', look: 'Spin only in 1st gear → gearing; in all = diff or aero' }
    ],
    investigate: [
      { slug: 'differential', note: 'Raise accel % if one wheel is doing all the spinning' },
      { slug: 'tire-pressure', note: 'Drop pressure 1–2 psi to grow contact patch' },
      { slug: 'gearing', note: 'Lengthen 1st gear if launch-only' }
    ]
  },
  {
    symptom: 'Tires overheating',
    phase: 'mid',
    signals: [
      { key: 'tireTempC', look: '>100 °C sustained; which corner is the worst?' }
    ],
    investigate: [
      { slug: 'tire-pressure', note: 'Raise pressure on hot corner by 1–2 psi' },
      { slug: 'alignment', note: 'Excess negative camber overheats the inside edge' },
      { slug: 'differential', note: 'Slipping diff overheats one drive wheel; raise accel %' }
    ]
  },
  {
    symptom: 'Car oscillates / unstable on straights',
    phase: 'straight',
    signals: [
      { key: 'steer', look: 'Trace dances around 0 — constant correction' },
      { key: 'suspension', look: 'Oscillating bar = damper rebound too soft' }
    ],
    investigate: [
      { slug: 'alignment', note: 'Add caster; reduce front toe-out' },
      { slug: 'dampers', note: 'Raise rebound — both ends, 1–2 clicks' },
      { slug: 'aero', note: 'High-speed instability: too little rear downforce' }
    ]
  }
]

export function findCategory(slug: string): TuneCategory | undefined {
  return TUNE_CATEGORIES.find(c => c.slug === slug)
}
