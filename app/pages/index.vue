<script setup lang="ts">
const { telemetry, debug, connected, hasReceivedFrame } = useTelemetry()

const paused = computed(() => hasReceivedFrame.value && telemetry.value && !telemetry.value.isRaceOn)
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-100">
    <!-- Header strip -->
    <header class="flex items-center justify-between border-b border-zinc-800 px-6 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-400">
      <span>forza-data</span>
      <span class="flex items-center gap-4">
        <span class="flex items-center gap-2">
          <span
            class="inline-block h-2 w-2 rounded-full"
            :class="connected ? 'bg-green-400' : 'bg-zinc-600'"
          />
          {{ connected ? 'WS LINKED' : 'WS OFFLINE' }}
        </span>
        <span
          v-if="telemetry"
          class="text-zinc-500"
        >
          T+{{ (telemetry.timestampMs / 1000).toFixed(1) }}s
        </span>
      </span>
    </header>

    <!-- Waiting state — never received a frame yet -->
    <div
      v-if="!hasReceivedFrame"
      class="flex flex-col items-center justify-center px-6 py-32 text-center font-mono"
    >
      <div class="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
        awaiting
      </div>
      <div class="mt-3 text-2xl text-zinc-100">
        WAITING FOR TELEMETRY
      </div>
      <div class="mt-6 max-w-md text-xs text-zinc-400">
        Start a race in Forza Horizon with Data Out enabled
        (Settings → HUD and Gameplay → Data Out) and point it at this server's
        LAN IP, port 5300, format <span class="text-zinc-200">Car Dash</span>.
      </div>
    </div>

    <!-- Live view -->
    <main
      v-else
      class="relative mx-auto grid max-w-6xl gap-4 px-6 py-6"
      style="grid-template-columns: 1fr 1.4fr 1fr; grid-template-rows: 1fr 1fr;"
    >
      <CornerPanel
        label="FRONT LEFT"
        side="left"
        :suspension="telemetry?.suspension.fl ?? 0"
        :slip-ratio="telemetry?.slipRatio.fl ?? 0"
        :slip-angle="telemetry?.slipAngle.fl ?? 0"
        :temp-c="telemetry?.tireTempC.fl ?? 0"
        :rumble="telemetry?.rumble.fl ?? false"
      />
      <CenterPanel
        class="row-span-2"
        :rpm="telemetry?.rpm ?? 0"
        :rpm-max="telemetry?.rpmMax ?? 8000"
        :rpm-idle="telemetry?.rpmIdle ?? 800"
        :gear="telemetry?.gear ?? 1"
        :speed-kmh="telemetry?.speedKmh ?? 0"
        :throttle="telemetry?.throttle ?? 0"
        :brake="telemetry?.brake ?? 0"
        :steer="telemetry?.steer ?? 0"
        :boost="telemetry?.boost ?? 0"
      />
      <CornerPanel
        label="FRONT RIGHT"
        side="right"
        :suspension="telemetry?.suspension.fr ?? 0"
        :slip-ratio="telemetry?.slipRatio.fr ?? 0"
        :slip-angle="telemetry?.slipAngle.fr ?? 0"
        :temp-c="telemetry?.tireTempC.fr ?? 0"
        :rumble="telemetry?.rumble.fr ?? false"
      />
      <CornerPanel
        label="REAR LEFT"
        side="left"
        :suspension="telemetry?.suspension.rl ?? 0"
        :slip-ratio="telemetry?.slipRatio.rl ?? 0"
        :slip-angle="telemetry?.slipAngle.rl ?? 0"
        :temp-c="telemetry?.tireTempC.rl ?? 0"
        :rumble="telemetry?.rumble.rl ?? false"
      />
      <CornerPanel
        label="REAR RIGHT"
        side="right"
        :suspension="telemetry?.suspension.rr ?? 0"
        :slip-ratio="telemetry?.slipRatio.rr ?? 0"
        :slip-angle="telemetry?.slipAngle.rr ?? 0"
        :temp-c="telemetry?.tireTempC.rr ?? 0"
        :rumble="telemetry?.rumble.rr ?? false"
      />

      <!-- Paused overlay -->
      <div
        v-if="paused"
        class="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div class="border-y border-zinc-700/60 bg-zinc-950/40 px-12 py-3 backdrop-blur-sm">
          <div class="font-mono text-2xl uppercase tracking-[0.5em] text-zinc-100">
            PAUSED
          </div>
          <div class="text-center font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
            no race active — last frame frozen
          </div>
        </div>
      </div>
    </main>

    <DebugPanel
      :telemetry="telemetry"
      :debug="debug"
    />
  </div>
</template>
