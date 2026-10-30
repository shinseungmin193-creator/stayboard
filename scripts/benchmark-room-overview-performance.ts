import { performance } from "node:perf_hooks";

import { listRoomOverview } from "@/features/room-overview/application/list-room-overview";
import { prisma } from "@/lib/prisma";

const iterations = Math.max(1, Number.parseInt(process.argv[2] ?? "5", 10) || 5);
async function main() {
  const samples: number[] = [];

  try {
    for (let index = 0; index < iterations; index += 1) {
      const startedAt = performance.now();
      const result = await listRoomOverview({}, new Date(), 7, false);
      const durationMs = performance.now() - startedAt;
      samples.push(durationMs);
      console.info(JSON.stringify({
        iteration: index + 1,
        durationMs: Math.round(durationMs * 100) / 100,
        roomCount: result.allCards.length,
        reservationCount: result.allCards.reduce((total, room) => total + room.reservations.length, 0),
        syncStateCount: result.allCards.reduce((total, room) => total + room.syncStates.length, 0),
      }));
    }

    const sorted = [...samples].sort((left, right) => left - right);
    console.info(JSON.stringify({
      summary: {
        iterations,
        minMs: Math.round(sorted[0] * 100) / 100,
        medianMs: Math.round(sorted[Math.floor(sorted.length / 2)] * 100) / 100,
        maxMs: Math.round(sorted.at(-1)! * 100) / 100,
        averageMs: Math.round((samples.reduce((total, sample) => total + sample, 0) / samples.length) * 100) / 100,
      },
    }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
