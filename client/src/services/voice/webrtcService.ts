import { getSocket } from '../socket/socketService';
import { useVoiceStore, type VoiceUser } from '../../stores/useVoiceStore';
import { toast } from 'sonner';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const SPEAKING_THRESHOLD = 15;
const SPEAKING_CHECK_INTERVAL = 100;
const REQUEST_OFFER_COOLDOWN_MS = 5000;

let localStream: MediaStream | null = null;
let rawMicStream: MediaStream | null = null;
let cameraStream: MediaStream | null = null;
let screenStream: MediaStream | null = null;
const peerConnections = new Map<string, RTCPeerConnection>();
const remoteAudios = new Map<string, HTMLAudioElement>();
/** Accumulated streams per peer (audio + camera); screen is stored separately in store */
const peerMainStreams = new Map<string, MediaStream>();
const lastRequestOfferTime = new Map<string, number>();
let speakingInterval: ReturnType<typeof setInterval> | null = null;
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let inputGainNode: GainNode | null = null;
let inputAudioContext: AudioContext | null = null;

export async function joinVoiceChannel(channelId: string, channelName: string, serverId: string): Promise<void> {
  const socket = getSocket();
  if (!socket) throw new Error('Socket not connected');

  let rawStream: MediaStream;
  try {
    rawStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
  } catch {
    throw new Error('Microphone access denied');
  }

  const inputVol = useVoiceStore.getState().inputVolume;
  inputAudioContext = new AudioContext();
  const source = inputAudioContext.createMediaStreamSource(rawStream);
  inputGainNode = inputAudioContext.createGain();
  inputGainNode.gain.value = inputVol;
  const destination = inputAudioContext.createMediaStreamDestination();
  source.connect(inputGainNode);
  inputGainNode.connect(destination);

  rawMicStream = rawStream;
  localStream = destination.stream;
  useVoiceStore.getState().setLocalStream(localStream);
  startSpeakingDetection(rawStream);

  socket.emit('joinVoice', channelId, (res: { success: boolean; users?: VoiceUser[]; error?: string }) => {
    if (!res.success) {
      cleanupLocal();
      return;
    }

    useVoiceStore.getState().setConnected(channelId, channelName, serverId);

    if (res.users) {
      const mySocketId = socket.id;
      for (const user of res.users) {
        if (user.socketId !== mySocketId) {
          // Avoid offer glare: as the joiner, wait for offers from existing users.
          createPeerConnection(user.socketId, false);
        }
      }
    }
  });

  socket.on('voiceOffer', handleVoiceOffer);
  socket.on('voiceAnswer', handleVoiceAnswer);
  socket.on('voiceIceCandidate', handleIceCandidate);
  socket.on('voiceStateUpdate', handleVoiceStateUpdate);
  // Viewer requests a fresh offer from sharer (e.g., to recover screen share video if renegotiation was missed)
  socket.on('voiceRequestOffer', (data: { fromSocketId: string; fromUserId: string }) => {
    const pc = peerConnections.get(data.fromSocketId);
    const s = getSocket();
    if (!pc || !s || pc.signalingState === 'closed') return;
    if (pc.signalingState === 'have-local-offer') return;
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => {
        if (pc.localDescription) s.emit('voiceOffer', { targetSocketId: data.fromSocketId, offer: pc.localDescription });
      })
      .catch((err) => console.error('voiceRequestOffer createOffer error:', err));
  });
  socket.on('voiceKicked', ({ channelId: kickedChannelId }: { channelId: string }) => {
    const store = useVoiceStore.getState();
    if (!store.connected || store.channelId !== kickedChannelId) return;
    toast.error('You have been kicked from the voice channel');
    leaveVoiceChannel();
  });
}

export function leaveVoiceChannel(): void {
  const socket = getSocket();
  if (socket) {
    socket.emit('leaveVoice');
    socket.off('voiceOffer', handleVoiceOffer);
    socket.off('voiceAnswer', handleVoiceAnswer);
    socket.off('voiceIceCandidate', handleIceCandidate);
    socket.off('voiceStateUpdate', handleVoiceStateUpdate);
    socket.off('voiceRequestOffer');
    socket.off('voiceKicked');
  }

  cleanupAll();
  useVoiceStore.getState().setDisconnected();
}

export function toggleMute(): void {
  const store = useVoiceStore.getState();
  const newMuted = !store.muted;
  store.setMuted(newMuted);

  if (localStream) {
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !newMuted;
    });
  }

  getSocket()?.emit('voiceToggleMute', newMuted);
}

export function toggleDeafen(): void {
  const store = useVoiceStore.getState();
  const newDeafened = !store.deafened;
  store.setDeafened(newDeafened);

  if (localStream) {
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !(newDeafened || store.muted);
    });
  }

  for (const audio of remoteAudios.values()) {
    audio.muted = newDeafened;
  }

  getSocket()?.emit('voiceToggleDeafen', newDeafened);
}

export async function toggleCamera(): Promise<void> {
  const store = useVoiceStore.getState();
  const newEnabled = !store.cameraEnabled;
  const socket = getSocket();

  if (newEnabled) {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = cameraStream.getVideoTracks()[0];

      // Attach track to all existing peer connections
      for (const pc of peerConnections.values()) {
        pc.addTrack(videoTrack, cameraStream);
      }

      // Ensure localStream exists and contains the video track for local preview
      if (!localStream) {
        localStream = new MediaStream([videoTrack]);
      } else {
        localStream.addTrack(videoTrack);
      }
      store.setLocalStream(localStream);
      store.setCameraEnabled(true);

      // Renegotiate so peers receive the new camera track
      for (const [targetSocketId, pc] of peerConnections) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            if (socket && pc.localDescription) socket.emit('voiceOffer', { targetSocketId, offer: pc.localDescription });
          })
          .catch(console.error);
      }
    } catch {
      // Camera access denied or cancelled
      return;
    }
  } else {
    if (cameraStream) {
      const videoTrack = cameraStream.getVideoTracks()[0];
      for (const pc of peerConnections.values()) {
        const sender = pc.getSenders().find((s) => s.track === videoTrack);
        if (sender) pc.removeTrack(sender);
      }
      localStream?.removeTrack(videoTrack);
      videoTrack.stop();
      cameraStream = null;
    }
    store.setCameraEnabled(false);
    store.setLocalStream(localStream);

    // Renegotiate so peers remove the camera m-line cleanly
    for (const [targetSocketId, pc] of peerConnections) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          if (socket && pc.localDescription) socket.emit('voiceOffer', { targetSocketId, offer: pc.localDescription });
        })
        .catch(console.error);
    }
  }

  getSocket()?.emit('voiceToggleCamera', newEnabled);
}

export async function toggleScreenShare(): Promise<void> {
  const store = useVoiceStore.getState();
  const newEnabled = !store.screenShareEnabled;

  if (newEnabled) {
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as MediaTrackConstraints,
        audio: false,
      });
      const screenTrack = screenStream.getVideoTracks()[0];
      const socket = getSocket();

      // Add screen track to all peer connections and renegotiate so existing peers receive it
      for (const [targetSocketId, pc] of peerConnections) {
        pc.addTrack(screenTrack, screenStream);
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            if (socket && pc.localDescription) {
              socket.emit('voiceOffer', {
                targetSocketId,
                offer: pc.localDescription,
              });
            }
          })
          .catch(console.error);
      }

      // Handle browser native 'Stop sharing' button
      screenTrack.onended = () => {
        stopScreenShare();
      };

      store.setScreenShareEnabled(true);
      store.setLocalScreenStream(screenStream);
      socket?.emit('voiceScreenShare', true);
    } catch {
      // User cancelled the screen share picker
      return;
    }
  } else {
    stopScreenShare();
  }
}

function stopScreenShare(): void {
  const store = useVoiceStore.getState();
  const socket = getSocket();
  if (screenStream) {
    const screenTrack = screenStream.getVideoTracks()[0];
    for (const pc of peerConnections.values()) {
      const sender = pc.getSenders().find((s) => s.track === screenTrack);
      if (sender) pc.removeTrack(sender);
    }
    screenTrack.stop();
    screenStream = null;
  }
  store.setScreenShareEnabled(false);
  store.setLocalScreenStream(null);
  getSocket()?.emit('voiceScreenShare', false);

  // Renegotiate so peers remove the screen m-line cleanly
  for (const [targetSocketId, pc] of peerConnections) {
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => {
        if (socket && pc.localDescription) socket.emit('voiceOffer', { targetSocketId, offer: pc.localDescription });
      })
      .catch(console.error);
  }
}

export function kickVoiceUser(targetSocketId: string): void {
  getSocket()?.emit('voiceKickUser', { targetSocketId });
}

function applyVolumesToRemoteAudios(): void {
  const store = useVoiceStore.getState();
  const { masterVolume, userVolumes, channelId, voiceStates } = store;
  const participants = channelId ? voiceStates[channelId] || [] : [];
  const socketIdToUserId = new Map(participants.map((p) => [p.socketId, p.userId]));

  for (const [socketId, audio] of remoteAudios) {
    const userId = socketIdToUserId.get(socketId);
    const userVol = userId != null ? (userVolumes[userId] ?? 1) : 1;
    audio.volume = Math.max(0, Math.min(1, masterVolume * userVol));
  }
}

export function setMasterVolume(volume: number): void {
  const v = Math.max(0, Math.min(1, volume));
  useVoiceStore.getState().setMasterVolume(v);
  applyVolumesToRemoteAudios();
}

export function setUserVolume(userId: string, volume: number): void {
  const v = Math.max(0, Math.min(1, volume));
  useVoiceStore.getState().setUserVolume(userId, v);
  applyVolumesToRemoteAudios();
}

export function setInputVolume(volume: number): void {
  const v = Math.max(0, Math.min(1, volume));
  useVoiceStore.getState().setInputVolume(v);
  if (inputGainNode) {
    inputGainNode.gain.value = v;
  }
}

function createPeerConnection(targetSocketId: string, isInitiator: boolean): RTCPeerConnection {
  if (peerConnections.has(targetSocketId)) {
    peerConnections.get(targetSocketId)!.close();
  }

  const pc = new RTCPeerConnection(ICE_SERVERS);
  peerConnections.set(targetSocketId, pc);

  if (localStream) {
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream!);
    });
  }
  if (screenStream) {
    const t = screenStream.getVideoTracks()[0];
    if (t) pc.addTrack(t, screenStream);
  }

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      getSocket()?.emit('voiceIceCandidate', {
        targetSocketId,
        candidate: event.candidate.toJSON(),
      });
    }
  };

  pc.ontrack = (event) => {
    const track = event.track;
    const isVideo = track.kind === 'video';
    const label = (track.label || '').toLowerCase();
    const isScreenByLabel = isVideo && (
      label.includes('screen') || label.includes('window') || label.includes('display') ||
      label.includes('capture') || label.includes('desktop') || label.includes('browser') ||
      label.includes('application') || label.includes('monitor')
    );

    // Detect screen vs camera:
    // - If label implies screen, treat as screen
    // - If we already have a video track in main stream, the next video is likely screen
    const mainStream = peerMainStreams.get(targetSocketId);
    const alreadyHasVideo = !!mainStream && mainStream.getVideoTracks().length > 0;
    const streamFromEvent = event.streams && event.streams[0];
    const isVideoOnlyStream = !!streamFromEvent && streamFromEvent.getTracks().length === 1 && streamFromEvent.getVideoTracks().length === 1;
    const isScreenTrack = isScreenByLabel || (isVideo && alreadyHasVideo) || (isVideo && isVideoOnlyStream);

    if (isVideo && isScreenTrack) {
      track.enabled = true;
      const s = (event.streams && event.streams[0]) || new MediaStream([track]);
      if (s.getVideoTracks().length === 0) s.addTrack(track);
      useVoiceStore.getState().setRemoteScreenStream(targetSocketId, s);
      track.onended = () => useVoiceStore.getState().setRemoteScreenStream(targetSocketId, null);
      return;
    }

    if (track.kind === 'audio') {
      const stream = (event.streams && event.streams[0]) || new MediaStream([track]);
      const audio = new Audio();
      audio.srcObject = stream;
      audio.autoplay = true;
      audio.muted = useVoiceStore.getState().deafened;
      remoteAudios.set(targetSocketId, audio);
      applyVolumesToRemoteAudios();
    }

    // Camera video or audio: merge into one stream per peer (don't overwrite)
    let merged = peerMainStreams.get(targetSocketId);
    if (!merged) {
      merged = new MediaStream();
      peerMainStreams.set(targetSocketId, merged);
    }
    merged.addTrack(track);
    useVoiceStore.getState().setRemoteStream(targetSocketId, merged);
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
      pc.close();
      peerConnections.delete(targetSocketId);
      peerMainStreams.delete(targetSocketId);
      remoteAudios.get(targetSocketId)?.pause();
      remoteAudios.delete(targetSocketId);
      useVoiceStore.getState().setRemoteStream(targetSocketId, null);
      useVoiceStore.getState().setRemoteScreenStream(targetSocketId, null);
    }
  };

  if (isInitiator) {
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => {
        getSocket()?.emit('voiceOffer', {
          targetSocketId,
          offer: pc.localDescription,
        });
      })
      .catch(console.error);
  }

  return pc;
}

async function handleVoiceOffer(data: { fromSocketId: string; fromUserId: string; offer: RTCSessionDescriptionInit }): Promise<void> {
  let pc = peerConnections.get(data.fromSocketId);
  if (!pc) pc = createPeerConnection(data.fromSocketId, false);
  try {
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    getSocket()?.emit('voiceAnswer', {
      targetSocketId: data.fromSocketId,
      answer: pc.localDescription,
    });
  } catch (error) {
    console.error('handleVoiceOffer error:', error);
  }
}

async function handleVoiceAnswer(data: { fromSocketId: string; answer: RTCSessionDescriptionInit }): Promise<void> {
  const pc = peerConnections.get(data.fromSocketId);
  if (pc) {
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    } catch (error) {
      console.error('handleVoiceAnswer error:', error);
    }
  }
}

async function handleIceCandidate(data: { fromSocketId: string; candidate: RTCIceCandidateInit }): Promise<void> {
  const pc = peerConnections.get(data.fromSocketId);
  if (pc) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (error) {
      console.error('handleIceCandidate error:', error);
    }
  }
}

function handleVoiceStateUpdate(data: { channelId: string; users: VoiceUser[] }): void {
  useVoiceStore.getState().updateVoiceState(data.channelId, data.users);
  applyVolumesToRemoteAudios();

  const store = useVoiceStore.getState();
  const socket = getSocket();
  if (!socket || !store.connected || store.channelId !== data.channelId) return;

  // When someone stops screen share (or has no screenShare flag), clear their remote screen stream so viewer UI updates
  for (const u of data.users) {
    if (!u.screenShare && store.remoteScreenStreams[u.socketId]) {
      store.setRemoteScreenStream(u.socketId, null);
    }
  }

  // If someone is sharing but we don't have their stream yet, request a fresh offer
  const now = Date.now();
  for (const u of data.users) {
    if (u.socketId === socket.id) continue;
    if (!u.screenShare) continue;
    if (store.remoteScreenStreams[u.socketId]) continue;
    if (!peerConnections.has(u.socketId)) continue;
    const last = lastRequestOfferTime.get(u.socketId) ?? 0;
    if (now - last < REQUEST_OFFER_COOLDOWN_MS) continue;
    lastRequestOfferTime.set(u.socketId, now);
    setTimeout(() => {
      if (useVoiceStore.getState().remoteScreenStreams[u.socketId]) return;
      getSocket()?.emit('voiceRequestOffer', { targetSocketId: u.socketId });
    }, 400);
  }

  const currentPeerIds = new Set(peerConnections.keys());
  const activeUsers = data.users.filter((u) => u.socketId !== socket.id);

  for (const user of activeUsers) {
    if (!currentPeerIds.has(user.socketId)) {
      createPeerConnection(user.socketId, true);
    }
  }

  const activeSocketIds = new Set(activeUsers.map((u) => u.socketId));
  for (const socketId of currentPeerIds) {
    if (!activeSocketIds.has(socketId)) {
      peerConnections.get(socketId)?.close();
      peerConnections.delete(socketId);
      peerMainStreams.delete(socketId);
      remoteAudios.get(socketId)?.pause();
      remoteAudios.delete(socketId);
      useVoiceStore.getState().setRemoteStream(socketId, null);
      useVoiceStore.getState().setRemoteScreenStream(socketId, null);
    }
  }
}

function startSpeakingDetection(micStream: MediaStream): void {
  if (!micStream) return;

  audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(micStream);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  const { setSpeaking } = useVoiceStore.getState();
  const socket = getSocket();
  const userId = socket?.id;

  let wasSpeaking = false;

  speakingInterval = setInterval(() => {
    if (!analyser) return;
    analyser.getByteFrequencyData(dataArray);
    const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    const isSpeaking = avg > SPEAKING_THRESHOLD;

    if (isSpeaking !== wasSpeaking) {
      wasSpeaking = isSpeaking;
      if (userId) setSpeaking(userId, isSpeaking);
    }
  }, SPEAKING_CHECK_INTERVAL);
}

function cleanupLocal(): void {
  inputGainNode = null;
  if (inputAudioContext) {
    inputAudioContext.close().catch(() => {});
    inputAudioContext = null;
  }
  if (rawMicStream) {
    rawMicStream.getTracks().forEach((t) => t.stop());
    rawMicStream = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }

  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }

  if (screenStream) {
    screenStream.getTracks().forEach((t) => t.stop());
    screenStream = null;
  }
  useVoiceStore.getState().setLocalScreenStream(null);
  useVoiceStore.getState().setLocalStream(null);

  if (speakingInterval) {
    clearInterval(speakingInterval);
    speakingInterval = null;
  }

  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
    analyser = null;
  }
}

function cleanupAll(): void {
  cleanupLocal();

  for (const pc of peerConnections.values()) {
    pc.close();
  }
  peerConnections.clear();
  peerMainStreams.clear();

  for (const audio of remoteAudios.values()) {
    audio.pause();
    audio.srcObject = null;
  }
  remoteAudios.clear();

  const store = useVoiceStore.getState();
  Object.keys(store.remoteStreams).forEach((id) => store.setRemoteStream(id, null));
  Object.keys(store.remoteScreenStreams).forEach((id) => store.setRemoteScreenStream(id, null));
}
