<script setup lang="ts">
useHead({ title: 'Manual · Replay' })
</script>

<template>
  <main class="container mx-auto max-w-6xl px-6 py-10">
    <PageHeader title="Manual · Replay">
      <template #eyebrow>
        <NuxtLink
          to="/manual"
          class="hover:text-zinc-300"
        >
          Manual
        </NuxtLink>
        <span class="text-zinc-700">/</span>
        <span class="text-zinc-300">Replay</span>
      </template>
      <template #intro>
        The replay player on session-detail pages lets you scrub through a
        finished lap frame-by-frame. Same live readouts as
        <NuxtLink
          to="/manual/live"
          class="text-green-300 hover:underline"
        >/live</NuxtLink>
        (CornerView, CenterPanel) plus whole-lap aggregate panels and
        trace strips you can drag-zoom.
      </template>
    </PageHeader>

    <ManualEntry
      id="damper-histogram"
      title="Damper velocity histogram"
      where="Below DynoCurve in the replay player · also on /tune/dampers (last 5 laps) and on /compare (A vs B)"
    >
      <template #intro>
        <p>
          Four small histograms (FL · FR · RL · RR) showing how much of
          the lap the suspension spent at each <em>damper velocity</em> —
          i.e. how fast the spring was moving at any given moment. The
          pro-tool standard view for damper tuning.
        </p>
      </template>
      <template #how>
        <ul class="list-disc space-y-1.5 pl-5">
          <li>
            <span class="font-mono text-zinc-100">X axis</span> — damper
            velocity in mm/s. Center = 0; left of zero = rebound
            (extension), right of zero = bump (compression).
          </li>
          <li>
            <span class="font-mono text-zinc-100">Y axis</span> — % of
            lap frames at that velocity (auto-scaled per chart).
          </li>
          <li>
            <span class="font-mono text-zinc-100">Bar colors</span> —
            <span style="color:#e4e4e7">zinc</span> in the slow zone
            (|v| &lt; 25 mm/s),
            <span style="color:#fbbf24">amber</span> in the medium zone
            (25-50),
            <span style="color:#f97316">orange</span> in the fast zone
            (|v| &gt; 50).
          </li>
          <li>
            <span class="font-mono text-zinc-100">Dashed horizontal line</span>
            at 12 % — pro reference for the ideal cone peak height.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Zone row below each chart</span>
            — time-share of the lap in each velocity zone:
            <span class="font-mono">F·reb</span> /
            <span class="font-mono">S·reb</span> /
            <span class="font-mono">S·bump</span> /
            <span class="font-mono">F·bump</span>.
          </li>
        </ul>
      </template>
      <template #shapes>
        <table class="w-full text-sm">
          <tbody class="divide-y divide-zinc-800/60">
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Symmetric cone, peak ~12 % at 0
              </td>
              <td class="py-2 text-zinc-400">
                Dampers are balanced.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Tall, narrow peak (well above 12 %)
              </td>
              <td class="py-2 text-zinc-400">
                Dampers too stiff — suspension barely moving.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Wide, low cone (peak below 12 %)
              </td>
              <td class="py-2 text-zinc-400">
                Dampers too soft — suspension moves too freely.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Skewed toward the bump side (right)
              </td>
              <td class="py-2 text-zinc-400">
                Too much rebound damping — spring not extending freely.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Skewed toward the rebound side (left)
              </td>
              <td class="py-2 text-zinc-400">
                Too much bump damping — spring not compressing freely.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                High fast-zone % (orange bars dominate the edges)
              </td>
              <td class="py-2 text-zinc-400">
                Bumpy surface, kerb hits, or under-damped fast events.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                FL vs FR (or RL vs RR) shapes differ
              </td>
              <td class="py-2 text-zinc-400">
                Side-to-side imbalance (camber, pressure, bump-steer).
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Fronts vs rears differ
              </td>
              <td class="py-2 text-zinc-400">
                Front/rear damping balance issue.
              </td>
            </tr>
          </tbody>
        </table>
      </template>
      <template #seeAlso>
        <NuxtLink
          to="/tune/dampers"
          class="text-green-300 hover:underline"
        >/tune/dampers</NuxtLink>
        ·
        <NuxtLink
          to="/tune/springs"
          class="text-green-300 hover:underline"
        >/tune/springs</NuxtLink>
        · the real-time mm/s readout on
        <NuxtLink
          to="/manual/live#damper-readout"
          class="text-green-300 hover:underline"
        >each CornerPanel</NuxtLink>
        is the same signal sampled instantaneously.
      </template>
    </ManualEntry>

    <ManualEntry
      id="track-map"
      title="Track map · single-trace mode"
      where="Bottom of the replay player"
    >
      <template #intro>
        <p>
          Top-down view of the lap path in world coordinates. The cursor
          dot tracks your scrub position; click anywhere on the route to
          jump there.
        </p>
      </template>
      <template #how>
        <ul class="list-disc space-y-1.5 pl-5">
          <li>
            <span class="font-mono text-zinc-100">Axes</span> — world (X, Z)
            ground-plane coordinates. Orientation matches the in-game map.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Color-mode chips</span>
            (top right) — recolor the line by
            <span class="font-mono">speed</span> /
            <span class="font-mono">throttle</span> /
            <span class="font-mono">brake</span> /
            <span class="font-mono">line</span> (driving-line deviation).
          </li>
          <li>
            <span class="font-mono text-zinc-100">Start marker</span> —
            small green dot at lap-distance = 0.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Cursor dot</span> — white
            dot at your current scrub position.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Click anywhere on the route</span>
            — replay jumps to the nearest frame.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Elevation strip</span> —
            Y (height) over lap distance below the map. Δ shows total
            elevation range.
          </li>
        </ul>
      </template>
      <template #shapes>
        <table class="w-full text-sm">
          <tbody class="divide-y divide-zinc-800/60">
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Smooth color gradient in speed mode
              </td>
              <td class="py-2 text-zinc-400">
                Hot colors on straights, cool at corner apexes — normal.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Brake mode shows red far from corners
              </td>
              <td class="py-2 text-zinc-400">
                Mid-corner braking — often a setup or confidence issue.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Line-mode bands away from neutral
              </td>
              <td class="py-2 text-zinc-400">
                Sustained off-line driving compared to the in-game
                reference line.
              </td>
            </tr>
          </tbody>
        </table>
      </template>
      <template #seeAlso>
        On
        <NuxtLink
          to="/manual/compare#track-map"
          class="text-green-300 hover:underline"
        >/compare</NuxtLink>
        the same component renders both laps' routes side-by-side with
        fixed legend colors instead of a single recolored line.
      </template>
    </ManualEntry>

    <ManualEntry
      id="dyno-curve"
      title="Dyno curve · this lap so far"
      where="Between TraceStrip (motor) and TrackMap in the replay player"
    >
      <template #intro>
        <p>
          Power, torque, and (when forced induction is detected) boost
          curves, plotted against RPM and growing as you scrub through the
          lap. Identical math to
          <NuxtLink
            to="/dyno"
            class="text-green-300 hover:underline"
          >/dyno</NuxtLink>'s
          session-wide curve, just constrained to one lap.
        </p>
      </template>
      <template #how>
        <ul class="list-disc space-y-1.5 pl-5">
          <li>
            <span class="font-mono text-zinc-100">X axis</span> — engine
            RPM, idle to max.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Y axes</span> — each line
            scaled to its own peak (so torque and power can share the
            view despite different units).
          </li>
          <li>
            <span class="font-mono text-zinc-100">Cyan</span> = torque,
            <span class="font-mono">purple</span> = power,
            <span class="font-mono">amber</span> = boost (when applicable).
          </li>
          <li>
            <span class="font-mono text-zinc-100">Grows as you scrub</span>
            — bins frames up to the current playback index. Late in the
            lap the curve is smoother because more samples fill the bins.
          </li>
        </ul>
      </template>
      <template #seeAlso>
        <NuxtLink
          to="/dyno"
          class="text-green-300 hover:underline"
        >/dyno</NuxtLink>
        for the session-wide version (more samples, smoother curve),
        and
        <NuxtLink
          to="/tune/gearing"
          class="text-green-300 hover:underline"
        >/tune/gearing</NuxtLink>
        for what to do with the powerband shape.
      </template>
    </ManualEntry>

    <p class="text-xs text-zinc-500">
      The G-G scatter, friction circles, damper velocity readouts, and
      input strips inside the live panels are described on
      <NuxtLink
        to="/manual/live"
        class="text-green-300 hover:underline"
      >/manual/live</NuxtLink>
      — same components, same readings. On `/replay` they're driven by the
      scrubbed frame instead of live telemetry, but everything else
      behaves the same way.
    </p>
  </main>
</template>
