import { EventEmitter } from "events";

// Next.js hot-reloading safe singleton
const globalForEvents = global as unknown as { _globalEmitter?: EventEmitter };

export const globalEmitter = globalForEvents._globalEmitter || new EventEmitter();

if (process.env.NODE_ENV !== "production") {
  globalForEvents._globalEmitter = globalEmitter;
}
