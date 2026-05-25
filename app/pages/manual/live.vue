<script setup lang="ts">
useHead({ title: 'Manual · Live' })
</script>

<template>
  <main class="container mx-auto max-w-6xl px-6 py-10">
    <PageHeader title="Manual · Live">
      <template #eyebrow>
        <NuxtLink
          to="/manual"
          class="hover:text-zinc-300"
        >
          Manual
        </NuxtLink>
        <span class="text-zinc-700">/</span>
        <span class="text-zinc-300">Live</span>
      </template>
      <template #intro>
        The <NuxtLink
          to="/live"
          class="text-green-300 hover:underline"
        >/live</NuxtLink> page is your phone-propped-next-to-the-TV
        dashboard: real-time chassis state while you drive. Four corner
        panels around a center panel — per-tire grip on the sides, chassis
        attitude and inputs in the middle.
      </template>
    </PageHeader>

    <ManualEntry
      id="gg-scatter"
      title="G-G scatter · chassis"
      where="CenterPanel · center of the page"
    >
      <template #intro>
        <p>
          Round disc in the middle of the center panel. Plots the car's
          instantaneous lateral G against longitudinal G — the so-called
          "friction circle" or "G-G plot," a pro-tool standard. The
          scatter cloud shows the envelope of how the car has been driven
          over the last ~20 seconds.
        </p>
      </template>
      <template #how>
        <ul class="list-disc space-y-1.5 pl-5">
          <li>
            <span class="font-mono text-zinc-100">X axis</span> — lateral
            G. Left of center = cornering left; right = cornering right.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Y axis</span> —
            longitudinal G. <strong>Up = braking</strong>,
            <strong>down = accelerating</strong>. Matches the in-game G
            meter's convention (force on the driver).
          </li>
          <li>
            <span class="font-mono text-zinc-100">Inner dashed ring</span>
            at 1 g, <span class="font-mono text-zinc-100">outer rim</span>
            at 2 g.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Amber dots</span> — last
            ~20 s of history, fading from old (faint) to recent (brighter).
            ~200 dots, decimated to ~10 Hz so density carries the shape.
          </li>
          <li>
            <span
              style="color:#4ade80"
              class="font-mono"
            >Bright green dot</span>
            — current instantaneous position. Updates at 60 Hz.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Lat · long readout</span>
            in the corner, in g.
          </li>
        </ul>
      </template>
      <template #shapes>
        <table class="w-full text-sm">
          <tbody class="divide-y divide-zinc-800/60">
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Smooth arc from top to side
              </td>
              <td class="py-2 text-zinc-400">
                Trail-braking — releasing brake as steering loads up.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Vertical line (top-to-bottom)
              </td>
              <td class="py-2 text-zinc-400">
                Straight-line braking + acceleration without cornering.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Horizontal blob
              </td>
              <td class="py-2 text-zinc-400">
                Sustained cornering with neither throttle nor brake
                (coast / steady-state).
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Cloud fills the whole disc
              </td>
              <td class="py-2 text-zinc-400">
                Aggressive driving using all of the available envelope.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Tight near-center cluster
              </td>
              <td class="py-2 text-zinc-400">
                Smooth / cautious / cruising lap.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Cloud only on one side
              </td>
              <td class="py-2 text-zinc-400">
                Mostly turning one direction (a tight infield, hairpin
                loop, etc.).
              </td>
            </tr>
          </tbody>
        </table>
      </template>
      <template #seeAlso>
        The per-tire friction circles below answer the same question at
        each wheel rather than at the chassis level. On
        <NuxtLink
          to="/manual/replay"
          class="text-green-300 hover:underline"
        >/replay</NuxtLink>
        the same G-G scatter rebuilds as you scrub through a finished lap.
      </template>
    </ManualEntry>

    <ManualEntry
      id="friction-circle"
      title="Friction circle · per tire"
      where="CornerPanel — small disc inside each of the four corner panels"
    >
      <template #intro>
        <p>
          Same idea as the chassis G-G scatter, but plotting <em>slip</em>
          at one tire rather than acceleration at the whole car. Answers
          "is this specific tire past its grip limit right now?"
        </p>
      </template>
      <template #how>
        <ul class="list-disc space-y-1.5 pl-5">
          <li>
            <span class="font-mono text-zinc-100">X axis</span> — slip
            angle (lateral). Negative = slipping one way, positive = the
            other.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Y axis</span> — slip
            ratio. <strong>Up = lockup</strong> (wheel slowed past road
            speed, braking too hard), <strong>down = wheelspin</strong>
            (wheel turning faster than road, accelerating past grip).
          </li>
          <li>
            <span class="font-mono text-zinc-100">Dashed inner ring</span>
            at 0.7 — the "working zone" boundary. Inside = under-worked,
            outside = engaged in the grip envelope.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Solid outer ring</span>
            at 1.0 — friction limit. Outside this ring the tire is past
            grip; the <span class="font-mono">Past grip</span> chip lights
            up.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Amber trail</span> —
            recent ~0.5 s of slip.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Center dot color</span>
            — reflects the combined-slip value (greens through amber to
            red as you approach the limit).
          </li>
        </ul>
      </template>
      <template #shapes>
        <table class="w-full text-sm">
          <tbody class="divide-y divide-zinc-800/60">
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Dot stays inside the 0.7 ring
              </td>
              <td class="py-2 text-zinc-400">
                Tire under-worked at this moment — not at the grip limit.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Dot sits between the 0.7 and 1.0 rings
              </td>
              <td class="py-2 text-zinc-400">
                Working in the grip zone — what you want most of the time
                in a corner.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Dot passes outside the 1.0 ring
              </td>
              <td class="py-2 text-zinc-400">
                Past grip — the
                <span class="font-mono">Past grip</span> chip flares;
                could be intentional (drift, rally) or unwanted.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Trail stretches up
              </td>
              <td class="py-2 text-zinc-400">
                Braking past grip on this tire — lockup. The
                <span class="font-mono">Lockup</span> chip will follow.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Trail stretches down
              </td>
              <td class="py-2 text-zinc-400">
                Wheelspin under power. The
                <span class="font-mono">Wheelspin</span> chip will follow.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Trail stretches left or right
              </td>
              <td class="py-2 text-zinc-400">
                Lateral slip in that direction — the tire's sliding
                sideways rather than gripping.
              </td>
            </tr>
          </tbody>
        </table>
      </template>
      <template #seeAlso>
        The diagnostic chips above each friction circle
        (<span class="font-mono">Bottoming · Past grip · Lockup · Wheelspin · Understeer · Oversteer</span>)
        link to the
        <NuxtLink
          to="/tune"
          class="text-green-300 hover:underline"
        >/tune</NuxtLink>
        category that addresses each.
      </template>
    </ManualEntry>

    <ManualEntry
      id="damper-readout"
      title="Damper velocity readout · per corner"
      where="CornerPanel — next to the SUSP label in each corner panel header"
    >
      <template #intro>
        <p>
          Signed mm/s number showing how fast the spring is moving right
          now at that corner. Positive = compression (spring being
          squished), negative = rebound (spring extending). The aggregated
          version is the damper velocity histogram on
          <NuxtLink
            to="/manual/replay#damper-histogram"
            class="text-green-300 hover:underline"
          >/replay</NuxtLink>;
          this is the live equivalent.
        </p>
      </template>
      <template #how>
        <ul class="list-disc space-y-1.5 pl-5">
          <li>
            <span class="font-mono text-zinc-100">Number</span> — signed
            mm/s, rounded to integer. <strong>+ = compression</strong>,
            <strong>− = rebound</strong>.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Color</span> — zone
            convention from the histogram:
            <span style="color:#71717a">zinc</span> when |v| &lt; 25 mm/s
            (slow zone, normal),
            <span style="color:#e4e4e7">light</span> when 25-50,
            <span style="color:#fcd34d">amber</span> when |v| &gt; 50
            (fast zone — kerb hits, rapid weight transfer).
          </li>
        </ul>
      </template>
      <template #seeAlso>
        Open
        <NuxtLink
          to="/manual/replay#damper-histogram"
          class="text-green-300 hover:underline"
        >Damper velocity histogram</NuxtLink>
        for the whole-lap aggregate version — the histogram shape is the
        distribution of exactly the readout you see here, integrated over
        the lap.
      </template>
    </ManualEntry>
  </main>
</template>
