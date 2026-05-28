<script setup lang="ts">
useHead({ title: 'Manual · Compare' })
</script>

<template>
  <main class="container mx-auto max-w-6xl px-6 py-10">
    <PageHeader title="Manual · Compare">
      <template #eyebrow>
        <NuxtLink
          to="/manual"
          class="hover:text-zinc-300"
        >
          Manual
        </NuxtLink>
        <span class="text-zinc-700">/</span>
        <span class="text-zinc-300">Compare</span>
      </template>
      <template #intro>
        The compare page sets two laps from the same event side by side and
        answers <em>what changed</em>. Lap A is shown in white, lap B in
        amber — that convention carries through every chart on the page.
      </template>
    </PageHeader>

    <ManualEntry
      id="delta-time"
      title="Δ TIME row · continuous delta-time vs distance"
      where="Topmost row of the OverlayTraces panel"
    >
      <template #intro>
        <p>
          The headline chart on the compare page. Plots the cumulative
          time difference between lap B and lap A along the distance axis
          — showing not just <em>how much</em> faster one lap was, but
          <em>where</em> the time came from.
        </p>
      </template>
      <template #how>
        <ul class="list-disc space-y-1.5 pl-5">
          <li>
            <span class="font-mono text-zinc-100">X axis</span> — distance
            along the lap, in meters from the start line.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Y axis</span> — Δt
            (B − A) in seconds. Above zero = A is ahead at this point;
            below = B is ahead.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Line color</span> —
            <span style="color:#22c55e">green</span> wherever A is ahead,
            <span style="color:#f59e0b">amber</span> wherever B is ahead.
            The line itself flips color at the zero crossing.
          </li>
          <li>
            <span class="font-mono text-zinc-100">"Δ at finish" badge</span>
            in the header — the final cumulative delta when both laps cross
            the line.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Drag to zoom · double-click to reset</span>
            — same as every uPlot row. The throttle / brake / steer rows
            below stay synced.
          </li>
        </ul>
      </template>
      <template #shapes>
        <table class="w-full text-sm">
          <tbody class="divide-y divide-zinc-800/60">
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Steady upward slope
              </td>
              <td class="py-2 text-zinc-400">
                A is pulling away from B continuously.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Step changes
              </td>
              <td class="py-2 text-zinc-400">
                Big gain/loss at a specific corner — drop the cursor on the
                step and look at the input traces below for the cause.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Line wobbles near zero across the whole lap
              </td>
              <td class="py-2 text-zinc-400">
                Pace was very similar; differences are pattern-level.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Switches color mid-lap
              </td>
              <td class="py-2 text-zinc-400">
                One lap is stronger in one part of the track, the other
                elsewhere.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Doesn't end at the badge value
              </td>
              <td class="py-2 text-zinc-400">
                Lap-time (from lap.timeMs) and resampled-trajectory delta
                can differ by a few ms — the badge is the resampled
                end-Δ; the header card is the truth-net from lap times.
              </td>
            </tr>
          </tbody>
        </table>
      </template>
      <template #seeAlso>
        <a
          href="#sector-times"
          class="text-green-300 hover:underline"
        >Sector times</a>
        and
        <a
          href="#apex-speed"
          class="text-green-300 hover:underline"
        >min speed per sector</a>
        below give the discrete equivalent. The
        <a
          href="#track-map"
          class="text-green-300 hover:underline"
        >track map</a>
        below shows the same delta in space.
      </template>
    </ManualEntry>

    <ManualEntry
      id="track-map"
      title="Track map · A · B overlay"
      where="Below OverlayTraces"
    >
      <template #intro>
        <p>
          Both laps' routes rendered on the same top-down view, in their
          legend colors (A white, B amber). The color-mode chips you see on
          /replay are hidden here because each trace has a fixed identity.
        </p>
      </template>
      <template #how>
        <ul class="list-disc space-y-1.5 pl-5">
          <li>
            <span class="font-mono text-zinc-100">A trace</span> = white
            (#fafafa), <span class="font-mono text-zinc-100">B trace</span>
            = amber (#fbbf24).
          </li>
          <li>
            <span class="font-mono text-zinc-100">Start marker</span> at
            lap-distance = 0. No live cursor (nothing to scrub).
          </li>
          <li>
            <span class="font-mono text-zinc-100">Click-to-seek is disabled</span>
            on this surface (it's a comparison view, not a replay).
          </li>
        </ul>
      </template>
      <template #shapes>
        <table class="w-full text-sm">
          <tbody class="divide-y divide-zinc-800/60">
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Traces fully overlap
              </td>
              <td class="py-2 text-zinc-400">
                Same line; differences are in timing / inputs, not path.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Split at a corner entry
              </td>
              <td class="py-2 text-zinc-400">
                Different braking points or turn-in points.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Split at a corner exit
              </td>
              <td class="py-2 text-zinc-400">
                Different throttle-application or apex-clipping line.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                One trace consistently wider through bends
              </td>
              <td class="py-2 text-zinc-400">
                That lap is running a wider racing line — could be more
                committed exits, or running off-line for traffic.
              </td>
            </tr>
          </tbody>
        </table>
      </template>
      <template #seeAlso>
        The single-trace version on
        <NuxtLink
          to="/manual/replay#track-map"
          class="text-green-300 hover:underline"
        >/replay</NuxtLink>
        has color-mode chips and a click-to-seek cursor that this
        comparison view drops.
      </template>
    </ManualEntry>

    <ManualEntry
      id="damper-histograms"
      title="A vs B damper velocity histograms"
      where="Between the track map and the sector tables"
    >
      <template #intro>
        <p>
          Two
          <NuxtLink
            to="/manual/replay#damper-histogram"
            class="text-green-300 hover:underline"
          >damper velocity histograms</NuxtLink>
          side by side — one per lap, each showing a 2×2 grid of corners
          (FL · FR · RL · RR). Same axes and zone-color convention as the
          /replay version.
        </p>
      </template>
      <template #how>
        <p>
          The two panels are independent — they auto-scale their Y axis
          separately. To compare peak heights between A and B, look at the
          12 % reference line rather than at the bars' apparent height.
          (Both panels draw that line at the same data position; if A's
          peak sits at the reference and B's peak is well above, the cones
          really are different shapes regardless of relative bar height.)
        </p>
        <p class="mt-3">
          Otherwise the reading is the same as the single-lap version on
          <NuxtLink
            to="/manual/replay#damper-histogram"
            class="text-green-300 hover:underline"
          >/replay</NuxtLink>.
        </p>
      </template>
      <template #shapes>
        <table class="w-full text-sm">
          <tbody class="divide-y divide-zinc-800/60">
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                A peak much taller than B peak
              </td>
              <td class="py-2 text-zinc-400">
                A's dampers tuned tighter (or driving was smoother on A's
                lap).
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Asymmetry flipped between A and B
              </td>
              <td class="py-2 text-zinc-400">
                The bump/rebound balance shifted between tunes — pair with
                the
                <a
                  href="#setup-diff"
                  class="text-green-300 hover:underline"
                >setup diff</a>
                to see which damper sliders changed.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                B has much more fast-zone time than A
              </td>
              <td class="py-2 text-zinc-400">
                B is hitting kerbs/bumps harder, or its dampers are softer
                in the fast zone.
              </td>
            </tr>
          </tbody>
        </table>
      </template>
      <template #seeAlso>
        <NuxtLink
          to="/manual/replay#damper-histogram"
          class="text-green-300 hover:underline"
        >Single-lap damper histogram</NuxtLink>
        for the full reading guide;
        <a
          href="#setup-diff"
          class="text-green-300 hover:underline"
        >setup diff</a>
        below to see which damper sliders actually differ.
      </template>
    </ManualEntry>

    <ManualEntry
      id="damper-scatter"
      title="A vs B damper position × velocity"
      where="Below the damper histograms"
    >
      <template #intro>
        <p>
          The two
          <NuxtLink
            to="/manual/replay#damper-scatter"
            class="text-green-300 hover:underline"
          >position×velocity scatters</NuxtLink>
          side by side. Reading is identical to the /replay version; here the
          question is whether the bump/rebound coupling — the "C" lean —
          changed between the two tunes.
        </p>
      </template>
      <template #shapes>
        <table class="w-full text-sm">
          <tbody class="divide-y divide-zinc-800/60">
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                B's cloud leans into a "C", A's is symmetric
              </td>
              <td class="py-2 text-zinc-400">
                A damper change introduced bump/rebound imbalance — pair with
                the
                <a
                  href="#setup-diff"
                  class="text-green-300 hover:underline"
                >setup diff</a>.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                B's cloud shifted right vs A
              </td>
              <td class="py-2 text-zinc-400">
                B rides lower through the lap — check the ride-height
                histograms below.
              </td>
            </tr>
          </tbody>
        </table>
      </template>
      <template #seeAlso>
        <NuxtLink
          to="/manual/replay#damper-scatter"
          class="text-green-300 hover:underline"
        >Full reading guide on /replay</NuxtLink>
      </template>
    </ManualEntry>

    <ManualEntry
      id="ride-height-histograms"
      title="A vs B ride-height histograms"
      where="Below the damper scatters"
    >
      <template #intro>
        <p>
          Two
          <NuxtLink
            to="/manual/replay#ride-height-histogram"
            class="text-green-300 hover:underline"
          >ride-height histograms</NuxtLink>
          side by side — where each lap's chassis sat over the travel range.
          The direct read of how a spring / ride-height / aero change moved the
          platform.
        </p>
      </template>
      <template #shapes>
        <table class="w-full text-sm">
          <tbody class="divide-y divide-zinc-800/60">
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                B's bars shifted right vs A
              </td>
              <td class="py-2 text-zinc-400">
                B rides lower — softer springs, lower ride height, or more
                downforce loading the platform.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                B's bottoming band grew vs A
              </td>
              <td class="py-2 text-zinc-400">
                B runs out of travel more often — pair with the
                <a
                  href="#setup-diff"
                  class="text-green-300 hover:underline"
                >setup diff</a>.
              </td>
            </tr>
          </tbody>
        </table>
      </template>
      <template #seeAlso>
        <NuxtLink
          to="/manual/replay#ride-height-histogram"
          class="text-green-300 hover:underline"
        >Full reading guide on /replay</NuxtLink>
      </template>
    </ManualEntry>

    <ManualEntry
      id="dyno-curves"
      title="A vs B dyno curves"
      where="Below the ride-height histograms"
    >
      <template #intro>
        <p>
          Two
          <NuxtLink
            to="/manual/replay#dyno-curve"
            class="text-green-300 hover:underline"
          >dyno curves</NuxtLink>
          side by side — engine torque, power, and boost (when applicable)
          vs RPM. Compare's only power-curve view; fills the gap when the
          <a
            href="#setup-diff"
            class="text-green-300 hover:underline"
          >setup diff</a>
          contains build-side changes (engine swap, aspiration,
          displacement) that move the curve.
        </p>
      </template>
      <template #shapes>
        <table class="w-full text-sm">
          <tbody class="divide-y divide-zinc-800/60">
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Curves overlap closely
              </td>
              <td class="py-2 text-zinc-400">
                Same engine package; differences are tune-side or driving.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                B's peak power higher / further right
              </td>
              <td class="py-2 text-zinc-400">
                Build change moved the engine — pair with the
                <a
                  href="#setup-diff"
                  class="text-green-300 hover:underline"
                >setup diff</a>.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                One curve missing the boost line
              </td>
              <td class="py-2 text-zinc-400">
                Aspiration changed between builds (N/A ↔ turbo / SC).
              </td>
            </tr>
          </tbody>
        </table>
      </template>
      <template #seeAlso>
        <NuxtLink
          to="/manual/replay#dyno-curve"
          class="text-green-300 hover:underline"
        >Full dyno reading guide on /replay</NuxtLink>
      </template>
    </ManualEntry>

    <ManualEntry
      id="slip-angle-balance"
      title="A vs B slip-angle balance"
      where="Below the dyno curves"
    >
      <template #intro>
        <p>
          Two
          <NuxtLink
            to="/manual/replay#slip-angle-balance"
            class="text-green-300 hover:underline"
          >slip-angle balance histograms</NuxtLink>
          side by side. The cleanest read of <em>did chassis balance shift
            between these two tunes</em> — pair with ARB, spring, and
          alignment rows on the
          <a
            href="#setup-diff"
            class="text-green-300 hover:underline"
          >setup diff</a>.
        </p>
      </template>
      <template #shapes>
        <table class="w-full text-sm">
          <tbody class="divide-y divide-zinc-800/60">
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                A peak at 0, B shifted right (positive)
              </td>
              <td class="py-2 text-zinc-400">
                B leans understeery — fronts working harder than on A.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                A peak at 0, B shifted left (negative)
              </td>
              <td class="py-2 text-zinc-400">
                B leans oversteery — rears working harder than on A.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                B's spread is wider than A's
              </td>
              <td class="py-2 text-zinc-400">
                B's balance varies more through corners — less consistent.
              </td>
            </tr>
          </tbody>
        </table>
      </template>
      <template #seeAlso>
        <NuxtLink
          to="/manual/replay#slip-angle-balance"
          class="text-green-300 hover:underline"
        >Full balance reading guide on /replay</NuxtLink>
      </template>
    </ManualEntry>

    <ManualEntry
      id="tire-temp"
      title="A vs B tire temperature distribution"
      where="Below the balance histograms"
    >
      <template #intro>
        <p>
          Per-corner (FL · FR · RL · RR) temperature distributions, A vs B.
          Diagnoses alignment and tire-pressure changes — they move heat
          patterns. Optimal grip band sits around 85-100 °C; well below =
          tire under-loaded, well above = overworked or under-inflated.
        </p>
      </template>
      <template #how>
        <ul class="list-disc space-y-1.5 pl-5">
          <li>
            <span class="font-mono text-zinc-100">X axis</span> — tire
            temperature, fixed 40-130 °C scale (out-of-range temps clamp
            into the end bins).
          </li>
          <li>
            <span class="font-mono text-zinc-100">Y axis</span> — % of lap
            frames at that temp (auto-scaled per corner).
          </li>
        </ul>
      </template>
      <template #shapes>
        <table class="w-full text-sm">
          <tbody class="divide-y divide-zinc-800/60">
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                B's bars shifted right vs A on one corner
              </td>
              <td class="py-2 text-zinc-400">
                That tire is running hotter — typically more camber, lower
                pressure, or more cornering load on B.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                FL ≠ FR (or RL ≠ RR) shape within a build
              </td>
              <td class="py-2 text-zinc-400">
                Left/right asymmetry — track-direction bias, camber/toe
                imbalance, or alignment difference between sides.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Fronts much hotter than rears (or vice versa)
              </td>
              <td class="py-2 text-zinc-400">
                Forward/rearward load bias — pair with balance histogram
                above and ARB / spring rows on the setup diff.
              </td>
            </tr>
          </tbody>
        </table>
      </template>
      <template #seeAlso>
        <NuxtLink
          to="/tune/tire-pressure"
          class="text-green-300 hover:underline"
        >/tune/tire-pressure</NuxtLink>
        ·
        <NuxtLink
          to="/tune/alignment"
          class="text-green-300 hover:underline"
        >/tune/alignment</NuxtLink>
      </template>
    </ManualEntry>

    <ManualEntry
      id="sector-times"
      title="Sector times table"
      where="Below the histograms, paired with min speed per sector"
    >
      <template #intro>
        <p>
          Splits each lap into three equal-distance sectors and reports
          the clock time spent in each. A vs B side-by-side with a delta
          column.
        </p>
      </template>
      <template #how>
        <ul class="list-disc space-y-1.5 pl-5">
          <li>
            <span class="font-mono text-zinc-100">Sector boundaries</span>
            — at 1/3 and 2/3 of <em>this lap's</em> `lap.distance`. Equal
            splits, not user-marked sector points.
          </li>
          <li>
            <span class="font-mono text-zinc-100">A / B columns</span>
            — each lap's sector time, formatted as M:SS.mmm.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Δ column</span>
            — B − A in seconds. Positive = A was faster, negative = B was
            faster.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Color rule</span>
            —
            <span style="color:#86efac">green</span> when A did better,
            <span style="color:#fcd34d">amber</span> when B did better,
            <span class="text-zinc-400">neutral</span> within ±50 ms.
          </li>
        </ul>
      </template>
      <template #shapes>
        <table class="w-full text-sm">
          <tbody class="divide-y divide-zinc-800/60">
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Sum of the three Δs equals the header net delta
              </td>
              <td class="py-2 text-zinc-400">
                Sanity check — should always be true within rounding.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                One sector contains most of the delta
              </td>
              <td class="py-2 text-zinc-400">
                That stretch is where to focus the next lap or tune change.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Mixed signs (A faster S1, B faster S2)
              </td>
              <td class="py-2 text-zinc-400">
                Different strengths — different lines or tune-side trade-
                offs.
              </td>
            </tr>
          </tbody>
        </table>
      </template>
      <template #seeAlso>
        <strong>Caveat:</strong> equal-distance splits are an
        approximation. For tracks with explicit corner-based sector points
        this works well; for routes where a single sector contains very
        different speeds, the per-sector reading is coarser than a real
        corner-by-corner breakdown.
      </template>
    </ManualEntry>

    <ManualEntry
      id="apex-speed"
      title="Min speed per sector · apex proxy"
      where="Paired with sector times"
    >
      <template #intro>
        <p>
          Lowest <span class="font-mono">speedKmh</span> observed in each
          equal-distance sector, A vs B with a delta. A rough apex-speed
          reading — each sector tends to contain the slowest point of one
          or two corners.
        </p>
      </template>
      <template #how>
        <ul class="list-disc space-y-1.5 pl-5">
          <li>
            <span class="font-mono text-zinc-100">A / B columns</span>
            — lowest speed observed in that sector, in your preferred
            unit (km/h or mph).
          </li>
          <li>
            <span class="font-mono text-zinc-100">Δ column</span>
            — B − A in the same unit.
            <strong>Higher apex speed is better</strong>, so the color
            rule is inverted vs the sector-times table:
            <span style="color:#86efac">green</span> when A carried more
            speed (Δ &lt; 0),
            <span style="color:#fcd34d">amber</span> when B carried more.
          </li>
          <li>
            "A did better" resolves to green across both tables — only
            the math sign of "better" flips.
          </li>
        </ul>
      </template>
      <template #shapes>
        <table class="w-full text-sm">
          <tbody class="divide-y divide-zinc-800/60">
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                A carries more speed AND has a faster sector time
              </td>
              <td class="py-2 text-zinc-400">
                Unambiguous win — higher commit, no time penalty.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                A carries more speed BUT has a slower sector time
              </td>
              <td class="py-2 text-zinc-400">
                Probably running wider line — gained mid-corner speed but
                lost time elsewhere in the sector.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Big apex-speed gap with small sector-time gap
              </td>
              <td class="py-2 text-zinc-400">
                One lap was much more committed but didn't convert it
                into time — usually a tune or exit-traction issue.
              </td>
            </tr>
          </tbody>
        </table>
      </template>
      <template #seeAlso>
        "Apex" here means "slowest moment in a sector," not a
        curvature-detected corner apex. A real corner-enumeration view is
        on the wishlist; this is the cheap version that falls out of the
        sector structure already in the code.
      </template>
    </ManualEntry>

    <ManualEntry
      id="setup-diff"
      title="Setup diff"
      where="Below the sector / apex tables"
    >
      <template #intro>
        <p>
          The flat list of every build + tune field that differs between
          the two laps' sessions. The headline glass-box-measurement view
          — "you changed X in the tune; here's what changed in the data."
        </p>
      </template>
      <template #how>
        <ul class="list-disc space-y-1.5 pl-5">
          <li>
            <span class="font-mono text-zinc-100">Header count</span>
            — "N changes" tells you the size of the setup delta at a
            glance.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Per row</span>
            — source (<span class="font-mono">Build</span> /
            <span class="font-mono">Tune</span>) · section · field · A
            value · B value.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Source labels</span>
            — <span class="font-mono">Build</span> = upgrade decisions
            that shape the car physically (tires, drivetrain, weight,
            power);
            <span class="font-mono">Tune</span> = slider settings
            layered on top (springs, dampers, ARBs, alignment, gearing).
          </li>
          <li>
            <span class="font-mono text-zinc-100">Values</span>
            run through the same formatter the form / display surfaces
            use, so the same unit prefs apply (psi vs bar, mm vs in,
            etc.).
          </li>
          <li>
            <span class="font-mono text-zinc-100">No row appears</span>
            when both sides are null/empty or numerically identical.
          </li>
        </ul>
      </template>
      <template #shapes>
        <table class="w-full text-sm">
          <tbody class="divide-y divide-zinc-800/60">
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Empty (panel hidden)
              </td>
              <td class="py-2 text-zinc-400">
                Same build + same tune. Lap-time difference is from
                driving, conditions, or noise.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                One or two rows
              </td>
              <td class="py-2 text-zinc-400">
                Targeted change — pair with trace and histogram deltas to
                see what it did.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Many rows across both Build and Tune
              </td>
              <td class="py-2 text-zinc-400">
                Comparing across builds — measurement deltas are still
                valid but you can't attribute them to any single change.
              </td>
            </tr>
          </tbody>
        </table>
      </template>
      <template #seeAlso>
        <strong>Caveat:</strong> the snapshot is captured at session start
        — patching a tune value mid-session is not reflected here.
        Per-session build/tune attachments stay editable; the diff reads
        whatever the snapshot said when the session began.
      </template>
    </ManualEntry>
  </main>
</template>
