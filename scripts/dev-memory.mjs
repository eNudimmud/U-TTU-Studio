import { getHeapStatistics } from "node:v8";

// Restricted preview containers can omit /proc, making Node's RSS probe throw
// ENOENT. Next dev uses this optional metric during startup and after requests.
// Real V8 heap values remain available; unavailable RSS/array buffers are 0.
// Production and ordinary developer machines never take this fallback.
export function allowRestrictedDevMetrics() {
  if (process.env.NODE_ENV !== "development") return;
  try { process.memoryUsage(); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    const memoryUsage = () => {
      const stats = getHeapStatistics();
      return { rss: 0, heapTotal: stats.total_heap_size, heapUsed: stats.used_heap_size, external: stats.external_memory, arrayBuffers: 0 };
    };
    process.memoryUsage = Object.assign(memoryUsage, { rss: () => 0 });
  }
}
