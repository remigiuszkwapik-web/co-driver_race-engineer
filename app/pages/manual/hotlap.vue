<script setup lang="ts">
useHead({ title: 'Manual · Hotlap' })
</script>

<template>
  <main class="container mx-auto max-w-6xl px-6 py-10">
    <PageHeader title="Manual · Hotlap">
      <template #eyebrow>
        <NuxtLink
          to="/manual"
          class="hover:text-zinc-300"
        >
          Manual
        </NuxtLink>
        <span class="text-zinc-700">/</span>
        <span class="text-zinc-300">Hotlap</span>
      </template>
      <template #intro>
        The
        <NuxtLink
          to="/hotlap"
          class="text-green-300 hover:underline"
        >/hotlap</NuxtLink>
        page is the driver-glance view: a giant current-lap clock, a zero-
        centred delta bar, F1-style per-sector cells, and a compact route
        map. Designed to be propped next to the TV — built for fast
        peripheral reads, not deep analysis.
      </template>
    </PageHeader>

    <ManualEntry
      id="delta-bar"
      title="Delta to best · zero-centred bar"
      where="Hero card, below the current-lap clock"
    >
      <template #intro>
        <p>
          Shows how far ahead or behind your current lap is vs the
          reference lap at this exact distance. Reference = your
          session-best so far, with an all-time car+event PB as the
          fallback for the first lap of a session.
        </p>
      </template>
      <template #how>
        <ul class="list-disc space-y-1.5 pl-5">
          <li>
            <span class="font-mono text-zinc-100">Center line</span> = on
            par with the reference. Fill goes left (green) when you're
            ahead, right (amber) when behind.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Fill width</span>
            saturates at ±1 s — beyond that the number tells the truth but
            the bar is pegged.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Numeric readout</span>
            on the right of the bar shows the exact delta to two decimals,
            colored the same way (green ahead / amber behind).
          </li>
          <li>
            <span class="font-mono text-zinc-100">Hero card tint</span> —
            subtle background green when ahead, amber when behind. Reads
            without needing to focus.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Empty state</span>
            (first lap, no reference yet) → bar empty, text "—".
          </li>
        </ul>
      </template>
      <template #seeAlso>
        Inspired by the LED bar on AiM / MoTeC dashboards. Same idea
        re-implemented as a chunky UI bar so it reads at a glance on a
        phone three feet away.
      </template>
    </ManualEntry>

    <ManualEntry
      id="sector-cells"
      title="Per-sector cells · F1 broadcast colors"
      where="Three cells below the hero card"
    >
      <template #intro>
        <p>
          Three equal-distance sectors, each lit by its own state as you
          cross the boundary. Color convention is the one F1 TV graphics
          use: purple > green > yellow > red.
        </p>
      </template>
      <template #how>
        <table class="w-full text-sm">
          <tbody class="divide-y divide-zinc-800/60">
            <tr>
              <td class="py-2 pr-4 font-mono">
                <span class="rounded border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 text-purple-200">PURPLE</span>
              </td>
              <td class="py-2 text-zinc-400">
                Personal best in that sector this session.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono">
                <span class="rounded border border-green-500/40 bg-green-500/10 px-2 py-0.5 text-green-200">GREEN</span>
              </td>
              <td class="py-2 text-zinc-400">
                Faster than the reference lap's same sector (but not PB).
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono">
                <span class="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-200">YELLOW</span>
              </td>
              <td class="py-2 text-zinc-400">
                Within ±50 ms of the reference — essentially even.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono">
                <span class="rounded border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-red-200">RED</span>
              </td>
              <td class="py-2 text-zinc-400">
                Slower than the reference plus the ±50 ms band.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono">
                <span class="rounded border border-zinc-800 bg-zinc-900/40 px-2 py-0.5 text-zinc-500">PENDING</span>
              </td>
              <td class="py-2 text-zinc-400">
                Sector not yet completed in the current lap.
              </td>
            </tr>
          </tbody>
        </table>
      </template>
      <template #seeAlso>
        Sectors are equal-distance splits — same construction as
        <NuxtLink
          to="/manual/compare#sector-times"
          class="text-green-300 hover:underline"
        >sector times on /compare</NuxtLink>.
        Each cell shows Δ in seconds with the same B − A convention as
        elsewhere; the color is the additional cue.
      </template>
    </ManualEntry>

    <ManualEntry
      id="predicted-theoretical"
      title="Predicted · Last · Best + Theoretical"
      where="Three-column card below the sector cells"
    >
      <template #intro>
        <p>
          Four lap times in one card: the running prediction of what this
          lap will finish at, the last completed lap, the session best,
          and the sum of your best individual sector times.
        </p>
      </template>
      <template #how>
        <ul class="list-disc space-y-1.5 pl-5">
          <li>
            <span class="font-mono text-zinc-100">Predicted</span>
            — reference total + the current rolling delta. Updates every
            frame; reflects what this lap looks like it'll finish at if
            the current pace holds.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Last</span>
            — clock of the most recently completed lap.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Best</span>
            — fastest completed lap in this session.
          </li>
          <li>
            <span class="font-mono text-zinc-100">Theoretical</span>
            (footer row) — sum of your <em>best</em> individual sector
            times across all completed laps. The lap time you'd run if
            you put together your best S1, S2, and S3 in one lap.
          </li>
        </ul>
      </template>
      <template #shapes>
        <table class="w-full text-sm">
          <tbody class="divide-y divide-zinc-800/60">
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Theoretical near Best
              </td>
              <td class="py-2 text-zinc-400">
                You're already consistent — best lap is close to perfect
                for this session.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Theoretical &lt;&lt; Best
              </td>
              <td class="py-2 text-zinc-400">
                Lots of time on the table — your individual sectors don't
                line up in one lap.
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-mono text-zinc-100">
                Predicted &lt; Best mid-lap
              </td>
              <td class="py-2 text-zinc-400">
                You're on a personal-best run at this distance. Stay
                clean.
              </td>
            </tr>
          </tbody>
        </table>
      </template>
    </ManualEntry>

    <ManualEntry
      id="compact-track-map"
      title="Compact track map"
      where="Bottom of the page"
    >
      <template #intro>
        <p>
          A slimmer version of the
          <NuxtLink
            to="/manual/replay#track-map"
            class="text-green-300 hover:underline"
          >replay track map</NuxtLink>
          — same component in <span class="font-mono">compact</span> mode.
          Shows the session-best lap's route as the reference and a live
          cursor for your current position.
        </p>
      </template>
      <template #how>
        <ul class="list-disc space-y-1.5 pl-5">
          <li>
            <span class="font-mono text-zinc-100">Route</span> = session-
            best lap's path. No color-mode chips (the page is
            driver-glance, not analysis).
          </li>
          <li>
            <span class="font-mono text-zinc-100">Cursor dot</span>
            = your live world position. Off-screen / hidden when the game
            is on a loading screen or pause edge.
          </li>
          <li>
            <span class="font-mono text-zinc-100">No elevation strip</span>
            — suppressed in compact mode.
          </li>
        </ul>
      </template>
      <template #seeAlso>
        <NuxtLink
          to="/manual/replay#track-map"
          class="text-green-300 hover:underline"
        >Full-mode track map on /replay</NuxtLink>
        for color-mode chips, click-to-seek, and the elevation strip.
      </template>
    </ManualEntry>
  </main>
</template>
