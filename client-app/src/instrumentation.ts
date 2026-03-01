/**
 * Next.js Instrumentation Hook
 * Runs once when the server process starts (Node.js runtime only).
 *
 * Handles EPIPE errors at the process level to prevent the dev server from
 * crashing when a browser tab closes mid-request (broken pipe write error).
 * This is a known issue with Next.js 16 + Node 22 on the dev server.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    process.on('uncaughtException', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EPIPE') {
        // Broken pipe: client disconnected before response completed.
        // Safe to ignore — no data loss occurs.
        return;
      }
      // Re-throw all other uncaught exceptions to preserve default behavior.
      throw err;
    });
  }
}
