import { create } from 'zustand';

const VOICE_MASTER_KEY = 'camp-voice-master-volume';
const VOICE_USER_VOLUMES_KEY = 'camp-voice-user-volumes';
const VOICE_INPUT_VOLUME_KEY = 'camp-voice-input-volume';

function loadMasterVolume(): number {
  try {
    const v = localStorage.getItem(VOICE_MASTER_KEY);
    if (v != null) {
      const n = parseFloat(v);
      if (n >= 0 && n <= 1) return n;
    }
  } catch {}
  return 1;
}

function loadUserVolumes(): Record<string, number> {
  try {
    const v = localStorage.getItem(VOICE_USER_VOLUMES_KEY);
    if (v) {
      const o = JSON.parse(v) as Record<string, unknown>;
      if (o && typeof o === 'object') {
        const out: Record<string, number> = {};
        for (const [k, val] of Object.entries(o)) {
          if (typeof val === 'number' && val >= 0 && val <= 1) out[k] = val;
        }
        return out;
      }
    }
  } catch {}
  return {};
}

function loadInputVolume(): number {
  try {
    const v = localStorage.getItem(VOICE_INPUT_VOLUME_KEY);
    if (v != null) {
      const n = parseFloat(v);
      if (n >= 0 && n <= 1) return n;
    }
  } catch {}
  return 1;
}

export interface VoiceUser {
  socketId: string;
  userId: string;
  muted: boolean;
  deafened: boolean;
  camera?: boolean;
  screenShare?: boolean;
}

interface VoiceState {
  connected: boolean;
  channelId: string | null;
  channelName: string | null;
  serverId: string | null;
  muted: boolean;
  deafened: boolean;
  cameraEnabled: boolean;
  screenShareEnabled: boolean;
  voiceStates: Record<string, VoiceUser[]>;
  speakingUsers: Set<string>;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  /** Screen share stream from local user (host sees their own screen) */
  localScreenStream: MediaStream | null;
  /** Screen share streams from remote peers (keyed by socketId) */
  remoteScreenStreams: Record<string, MediaStream>;
  /** Master volume 0-1 for all remote audio */
  masterVolume: number;
  /** Per-user volume 0-1, keyed by userId for persistence */
  userVolumes: Record<string, number>;
  /** Input volume 0-1 (mic gain, how loud you sound to others) */
  inputVolume: number;

  setConnected: (channelId: string, channelName: string, serverId: string) => void;
  setDisconnected: () => void;
  setMuted: (muted: boolean) => void;
  setDeafened: (deafened: boolean) => void;
  setCameraEnabled: (enabled: boolean) => void;
  setScreenShareEnabled: (enabled: boolean) => void;
  updateVoiceState: (channelId: string, users: VoiceUser[]) => void;
  setAllVoiceStates: (states: Record<string, VoiceUser[]>) => void;
  setSpeaking: (userId: string, speaking: boolean) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (peerId: string, stream: MediaStream | null) => void;
  setLocalScreenStream: (stream: MediaStream | null) => void;
  setRemoteScreenStream: (peerId: string, stream: MediaStream | null) => void;
  setMasterVolume: (volume: number) => void;
  setUserVolume: (userId: string, volume: number) => void;
  setInputVolume: (volume: number) => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  connected: false,
  channelId: null,
  channelName: null,
  serverId: null,
  muted: false,
  deafened: false,
  cameraEnabled: false,
  screenShareEnabled: false,
  voiceStates: {},
  speakingUsers: new Set(),
  localStream: null,
  remoteStreams: {},
  localScreenStream: null,
  remoteScreenStreams: {},
  masterVolume: loadMasterVolume(),
  userVolumes: loadUserVolumes(),
  inputVolume: loadInputVolume(),

  setConnected: (channelId, channelName, serverId) => set({
    connected: true, channelId, channelName, serverId, muted: false, deafened: false, cameraEnabled: false, screenShareEnabled: false,
    localScreenStream: null, remoteScreenStreams: {},
  }),
  setDisconnected: () => set({
    connected: false, channelId: null, channelName: null, serverId: null,
    muted: false, deafened: false, cameraEnabled: false, screenShareEnabled: false, localStream: null, remoteStreams: {},
    localScreenStream: null, remoteScreenStreams: {},
  }),
  setMuted: (muted) => set({ muted }),
  setDeafened: (deafened) => set({ deafened }),
  setCameraEnabled: (cameraEnabled) => set({ cameraEnabled }),
  setScreenShareEnabled: (screenShareEnabled) => set({ screenShareEnabled }),
  updateVoiceState: (channelId, users) => set((s) => ({
    voiceStates: { ...s.voiceStates, [channelId]: users },
  })),
  setAllVoiceStates: (states) => set({ voiceStates: states }),
  setSpeaking: (userId, speaking) => set((s) => {
    const next = new Set(s.speakingUsers);
    if (speaking) next.add(userId);
    else next.delete(userId);
    return { speakingUsers: next };
  }),
  setLocalStream: (localStream) => set({ localStream }),
  setRemoteStream: (peerId, stream) => set((s) => {
    const next = { ...s.remoteStreams };
    if (stream) next[peerId] = stream;
    else delete next[peerId];
    return { remoteStreams: next };
  }),
  setLocalScreenStream: (stream) => set({ localScreenStream: stream }),
  setRemoteScreenStream: (peerId, stream) => set((s) => {
    const next = { ...s.remoteScreenStreams };
    if (stream) next[peerId] = stream;
    else delete next[peerId];
    return { remoteScreenStreams: next };
  }),
  setMasterVolume: (masterVolume) => {
    const v = Math.max(0, Math.min(1, masterVolume));
    try { localStorage.setItem(VOICE_MASTER_KEY, String(v)); } catch {}
    set({ masterVolume: v });
  },
  setUserVolume: (userId, volume) => set((s) => {
    const v = Math.max(0, Math.min(1, volume));
    const next = { ...s.userVolumes, [userId]: v };
    try { localStorage.setItem(VOICE_USER_VOLUMES_KEY, JSON.stringify(next)); } catch {}
    return { userVolumes: next };
  }),
  setInputVolume: (volume) => {
    const v = Math.max(0, Math.min(1, volume));
    try { localStorage.setItem(VOICE_INPUT_VOLUME_KEY, String(v)); } catch {}
    set({ inputVolume: v });
  },
}));
