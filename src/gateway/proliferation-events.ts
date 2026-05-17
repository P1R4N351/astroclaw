import { EventEmitter } from "node:events";

/**
 * Typed lifecycle events the astroclaw sidecar subscribes to.
 *
 * Subsequent patches add the emit-sites at the appropriate gateway code
 * paths (patch 0004 for session lifecycle, 0007 for channel send, etc.).
 * Defining the type up front keeps event names in one place.
 */
export type ProliferationEventMap = {
  "before-session-start": [{ sessionId: string }];
  "after-session-start": [{ sessionId: string }];
  "before-session-checkpoint": [{ sessionId: string }];
  "after-session-checkpoint": [
    {
      sessionId: string;
      cid: string;
      /**
       * Absolute path to the on-disk snapshot file (the pre-compaction
       * session transcript fork captured by
       * `captureCompactionCheckpointSnapshotAsync`). Subscribers can read
       * this file to push the snapshot bytes into out-of-process storage
       * (e.g. the astroclaw sidecar's CAS blob store for session migration).
       * The file is owned by the astroclaw checkpoint retention machinery —
       * subscribers MUST NOT mutate or unlink it.
       */
      snapshotFile?: string;
    },
  ];
  "before-message-send": [{ channelId: string; messageId?: string }];
  "after-message-send": [{ channelId: string; messageId?: string }];
  "before-skill-invoke": [{ skillId: string; sessionId?: string }];
  "before-workspace-write": [{ path: string }];
};

export interface ProliferationEvents {
  on<K extends keyof ProliferationEventMap>(
    event: K,
    listener: (...args: ProliferationEventMap[K]) => void,
  ): this;
  off<K extends keyof ProliferationEventMap>(
    event: K,
    listener: (...args: ProliferationEventMap[K]) => void,
  ): this;
  emit<K extends keyof ProliferationEventMap>(event: K, ...args: ProliferationEventMap[K]): boolean;
  removeAllListeners(): this;
}

export function createProliferationEvents(): ProliferationEvents {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(50);
  return emitter as unknown as ProliferationEvents;
}
