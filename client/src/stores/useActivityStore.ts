import { create } from 'zustand';

export type ActivityKind = 'online' | 'idle' | 'offline' | 'voice-join' | 'voice-leave' | 'message' | 'join';

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  userId: string;
  name: string;
  /** Channel or room the event happened in, without the # */
  place?: string;
  at: number;
}

interface ActivityState {
  events: ActivityEvent[];
  push: (e: Omit<ActivityEvent, 'id' | 'at'>) => void;
  clear: () => void;
}

const MAX = 24;
let seq = 0;

/** Recent live activity in the open server, newest first, for the live band. */
export const useActivityStore = create<ActivityState>((set) => ({
  events: [],
  push: (e) =>
    set((s) => {
      // Collapse repeats: the same person doing the same thing in the same place.
      const rest = s.events.filter((x) => !(x.userId === e.userId && x.kind === e.kind && x.place === e.place));
      return { events: [{ ...e, id: `a${++seq}`, at: Date.now() }, ...rest].slice(0, MAX) };
    }),
  clear: () => set({ events: [] }),
}));
