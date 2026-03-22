import { useEffect, useRef, useState } from 'react';
import {
  Mic, MicOff, Video, VideoOff, Monitor,
  Headphones, HeadphoneOff, PhoneOff, Volume2,
  MessageSquare, X, Send, Hash, Maximize2, Minimize2,
} from 'lucide-react';
import { useVoiceStore } from '../../stores/useVoiceStore';
import { useServerStore } from '../../stores/useServerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import {
  toggleMute, toggleDeafen, toggleCamera, toggleScreenShare, leaveVoiceChannel, kickVoiceUser,
  setMasterVolume,
} from '../../services/voice/webrtcService';
import UserVolumeContextMenu from './UserVolumeContextMenu';

interface VoiceCallViewProps {
  onOpenDM?: (id: string) => void;
}

export default function VoiceCallView(_props: VoiceCallViewProps) {
  const user = useAuthStore((s) => s.user);
  const { currentServer, members } = useServerStore();
  const {
    channelId, channelName, muted, deafened, cameraEnabled, screenShareEnabled,
    voiceStates, speakingUsers, localStream, remoteStreams,
    localScreenStream, remoteScreenStreams, masterVolume,
  } = useVoiceStore();

  const [volumePopoverOpen, setVolumePopoverOpen] = useState(false);
  const [userVolumeMenu, setUserVolumeMenu] = useState<{ userId: string; displayName: string; x: number; y: number } | null>(null);
  const volumePopoverRef = useRef<HTMLDivElement>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [expandedScreenId, setExpandedScreenId] = useState<string | null>(null);

  useEffect(() => {
    if (!volumePopoverOpen) return;
    const handler = (e: MouseEvent) => {
      if (volumePopoverRef.current && !volumePopoverRef.current.contains(e.target as Node)) {
        setVolumePopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [volumePopoverOpen]);

  const participants = channelId ? (voiceStates[channelId] || []) : [];

  const getMember = (userId: string) => members.find((m) => m._id === userId);
  const myServerMember = currentServer && user ? currentServer.members.find((m) => m.userId === user._id) : undefined;
  const canKick = !!user && !!currentServer && (
    currentServer.ownerId === user._id || myServerMember?.role === 'admin' || myServerMember?.role === 'moderator'
  );

  return (
    <div className="flex-1 flex h-full bg-[#0f0f12] overflow-hidden">
      {/* Main call area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-12 px-4 flex items-center gap-3 bg-[#1a1a22]/80 border-b border-white/5 shrink-0">
          <div className="relative" ref={volumePopoverRef}>
            <button
              type="button"
              onClick={() => setVolumePopoverOpen((o) => !o)}
              className={`p-1.5 rounded transition-colors ${volumePopoverOpen ? 'bg-layer-4 text-white' : 'text-[#80848E] hover:text-white hover:bg-layer-4'}`}
              title="Output volume"
            >
              <Volume2 className="w-5 h-5" />
            </button>
            {volumePopoverOpen && (
              <VolumePopover
                volume={masterVolume}
                onChange={(v) => setMasterVolume(v)}
              />
            )}
          </div>
          <span className="text-white font-semibold text-sm">{channelName || 'Voice Channel'}</span>
          <span className="px-2 py-0.5 rounded-full bg-danger-500 text-white text-2xs font-bold uppercase tracking-wider animate-pulse">
            Live
          </span>
          <div className="flex-1" />
          {/* Participant avatars */}
          <div className="flex -space-x-2">
            {participants.slice(0, 5).map((p) => {
              const member = getMember(p.userId);
              return (
                <div
                  key={p.userId}
                  className="w-7 h-7 rounded-full bg-layer-4 border-2 border-[#1a1a22] flex items-center justify-center overflow-hidden"
                  title={member?.displayName || p.userId}
                >
                  {member?.avatar ? (
                    <img src={member.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-2xs font-semibold">
                      {(member?.displayName || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              );
            })}
            {participants.length > 5 && (
              <div className="w-7 h-7 rounded-full bg-layer-4 border-2 border-[#1a1a22] flex items-center justify-center">
                <span className="text-[#80848E] text-2xs font-bold">+{participants.length - 5}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className={`p-1.5 rounded transition-colors cursor-pointer ${chatOpen ? 'bg-accent-500 text-white' : 'text-[#80848E] hover:text-white hover:bg-layer-4'
              }`}
            title="Toggle chat"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>

        {/* Screen shares + participants: extend screen only when total frames is ODD; when EVEN, all frames same size in one grid */}
        {(() => {
          const screenShares: { id: string; stream: MediaStream; label: string }[] = [];
          if (localScreenStream) {
            screenShares.push({ id: 'local', stream: localScreenStream, label: 'Your screen' });
          }
          for (const socketId of Object.keys(remoteScreenStreams)) {
            const stream = remoteScreenStreams[socketId];
            if (!stream) continue;
            const p = participants.find((x) => x.socketId === socketId);
            const member = p ? getMember(p.userId) : null;
            const label = member?.displayName ? `${member.displayName}'s screen` : 'Screen share';
            screenShares.push({ id: socketId, stream, label });
          }
          const totalFrames = screenShares.length + participants.length;
          const extendScreenShare = screenShares.length > 0 && totalFrames % 2 === 1;

          const screenShareCard = ({ id, stream, label }: { id: string; stream: MediaStream; label: string }) => (
            <div
              key={id}
              className="relative rounded-xl overflow-hidden bg-black border-2 border-online/50 group cursor-pointer h-full min-h-0"
              onDoubleClick={() => setExpandedScreenId((prev) => (prev === id ? null : id))}
            >
              <ScreenShareVideo stream={stream} label={label} isRemote={id !== 'local'} />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setExpandedScreenId((prev) => (prev === id ? null : id)); }}
                className="absolute top-2 right-2 p-1.5 rounded bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                title={expandedScreenId === id ? 'Minimize' : 'Expand'}
              >
                {expandedScreenId === id ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/70 to-transparent">
                <p className="text-[#f5f5f5] text-xs font-medium truncate">{label}</p>
              </div>
            </div>
          );

          const expandedOverlay = expandedScreenId && (() => {
            const item = screenShares.find((s) => s.id === expandedScreenId);
            if (!item) return null;
            return (
              <div
                className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
                onClick={() => setExpandedScreenId(null)}
              >
                <div className="w-full h-full flex flex-col p-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">{item.label}</span>
                    <button
                      type="button"
                      onClick={() => setExpandedScreenId(null)}
                      className="p-2 rounded bg-layer-4 hover:bg-layer-5 text-white"
                      title="Minimize"
                    >
                      <Minimize2 className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 rounded-lg overflow-hidden border-2 border-online/50 relative">
                    <ScreenShareVideo stream={item.stream} label={item.label} isRemote={item.id !== 'local'} />
                  </div>
                </div>
              </div>
            );
          })();

          const gridClassFor = (n: number) =>
            n <= 1 ? 'grid-cols-1' : n <= 2 ? 'grid-cols-2' : n <= 4 ? 'grid-cols-2' : n <= 6 ? 'grid-cols-3' : 'grid-cols-4';

          // EVEN total: one grid, screen shares + participants same size
          if (screenShares.length > 0 && !extendScreenShare) {
            return (
              <div className="flex-1 min-h-0 p-4 relative flex flex-col">
                <div className={`grid ${gridClassFor(totalFrames)} gap-3 flex-1 min-h-0 h-full auto-rows-fr`}>
                  {screenShares.map((s) => screenShareCard(s))}
                  {participants.map((p) => {
                    const isMe = p.userId === user?._id;
                    const member = getMember(p.userId);
                    const isSpeaking = speakingUsers.has(p.socketId) || speakingUsers.has(p.userId);
                    const isOwner = p.userId === currentServer?.ownerId;
                    const hasScreen = isMe ? !!screenShareEnabled : !!remoteScreenStreams[p.socketId];
                    const hasCamera = isMe ? cameraEnabled : p.camera;
                    const stream = isMe ? localStream : remoteStreams[p.socketId];
                    const screenStream = isMe ? null : remoteScreenStreams[p.socketId] || null;
                    return (
                      <ParticipantTile
                        key={p.socketId}
                        displayName={member?.displayName || 'Unknown'}
                        avatar={member?.avatar || ''}
                        muted={p.muted}
                        deafened={p.deafened}
                        isSpeaking={isSpeaking}
                        isOwner={!!isOwner}
                        hasCamera={!!hasCamera && !hasScreen}
                        hasScreen={!!hasScreen}
                        stream={stream || null}
                        screenStream={screenStream}
                        isMe={isMe}
                        fillCell
                        canKick={!!canKick && !isMe && !isOwner}
                        onKick={() => {
                          if (window.confirm(`Kick ${member?.displayName || 'this user'} from the voice channel?`)) {
                            kickVoiceUser(p.socketId);
                          }
                        }}
                        onContextMenu={(e) => {
                          if (!isMe) {
                            e.preventDefault();
                            setUserVolumeMenu({ userId: p.userId, displayName: member?.displayName || 'Unknown', x: e.clientX, y: e.clientY });
                          }
                        }}
                      />
                    );
                  })}
                </div>
                {expandedOverlay}
              </div>
            );
          }

          // ODD total: screen share extended on top, participants below
          if (screenShares.length > 0 && extendScreenShare) {
            return (
              <div className="flex-1 flex flex-col min-h-0 p-4 relative">
                <div className={`flex-1 min-h-0 grid gap-3 grid-rows-[1fr] ${screenShares.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                  {screenShares.map((s) => screenShareCard(s))}
                </div>
                {expandedOverlay}
                <div className="flex-1 min-h-0 pt-3 overflow-auto">
                  <ParticipantGrid
                    participants={participants}
                    localStream={localStream}
                    remoteStreams={remoteStreams}
                    remoteScreenStreams={remoteScreenStreams}
                    speakingUsers={speakingUsers}
                    currentUserId={user?._id || ''}
                    ownerId={currentServer?.ownerId || ''}
                    getMember={getMember}
                    cameraEnabled={cameraEnabled}
                    screenShareEnabled={screenShareEnabled}
                    canKick={canKick}
                    onUserContextMenu={setUserVolumeMenu}
                  />
                </div>
              </div>
            );
          }

          // No screen share
          return (
            <div className="flex-1 min-h-0 p-4 overflow-auto flex flex-col">
              <ParticipantGrid
                participants={participants}
                localStream={localStream}
                remoteStreams={remoteStreams}
                remoteScreenStreams={remoteScreenStreams}
                speakingUsers={speakingUsers}
                currentUserId={user?._id || ''}
                ownerId={currentServer?.ownerId || ''}
                getMember={getMember}
                cameraEnabled={cameraEnabled}
                screenShareEnabled={screenShareEnabled}
                canKick={canKick}
                onUserContextMenu={setUserVolumeMenu}
              />
            </div>
          );
        })()}

        {/* Bottom controls */}
        <div className="py-4 flex items-center justify-center gap-2 bg-[#1a1a22]/60 border-t border-white/5 shrink-0">
          <ControlButton
            active={!muted}
            danger={muted}
            onClick={toggleMute}
            icon={muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            title={muted ? 'Unmute' : 'Mute'}
          />
          <ControlButton
            active={cameraEnabled}
            onClick={toggleCamera}
            icon={cameraEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            title={cameraEnabled ? 'Turn off camera' : 'Turn on camera'}
          />
          <ControlButton
            active={screenShareEnabled}
            onClick={toggleScreenShare}
            icon={<Monitor className="w-5 h-5" />}
            title={screenShareEnabled ? 'Stop sharing' : 'Share Screen'}
          />
          <ControlButton
            active={!deafened}
            danger={deafened}
            onClick={toggleDeafen}
            icon={deafened ? <HeadphoneOff className="w-5 h-5" /> : <Headphones className="w-5 h-5" />}
            title={deafened ? 'Undeafen' : 'Deafen'}
          />
          <button
            onClick={leaveVoiceChannel}
            className="w-14 h-10 rounded-full bg-danger-500 hover:bg-danger-400 flex items-center justify-center text-white cursor-pointer transition-colors shadow-lg shadow-danger-500/20"
            title="Disconnect"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* User volume context menu */}
      {userVolumeMenu && (
        <UserVolumeContextMenu
          userId={userVolumeMenu.userId}
          displayName={userVolumeMenu.displayName}
          x={userVolumeMenu.x}
          y={userVolumeMenu.y}
          onClose={() => setUserVolumeMenu(null)}
        />
      )}

      {/* Chat sidebar */}
      {chatOpen && (
        <div className="w-80 border-l border-white/5 bg-[#1a1a22] flex flex-col shrink-0">
          <div className="h-12 px-4 flex items-center justify-between border-b border-white/5 shrink-0">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-[#80848E]" />
              <span className="text-white font-semibold text-sm">{channelName}</span>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="p-1 rounded text-[#80848E] hover:text-white hover:bg-layer-4 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chat messages area */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[#5C5F66] text-sm text-center">
                Voice channel chat
                <br />
                <span className="text-2xs">Messages sent here are visible to everyone in the call</span>
              </p>
            </div>
          </div>

          {/* Chat input */}
          <div className="p-3 border-t border-white/5">
            <div className="flex items-center gap-2 bg-[#0f0f12] rounded-lg px-3 py-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder={`Message #${channelName || 'voice'}`}
                className="flex-1 bg-transparent text-[#B5BAC1] text-sm outline-none placeholder-[#5C5F66]"
              />
              <button
                className="text-[#80848E] hover:text-accent-400 transition-colors cursor-pointer"
                title="Send"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== Volume popover (master volume) ===== */
function VolumePopover({ volume, onChange }: { volume: number; onChange: (v: number) => void }) {
  return (
    <div
      className="absolute left-0 top-full mt-1.5 z-50 w-48 p-3 rounded-lg bg-[#1e1e28] border border-white/10 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-[#B5BAC1] text-xs font-medium mb-2">Output volume</p>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 rounded-full appearance-none bg-layer-4 cursor-pointer accent-accent-500"
      />
      <p className="text-[#80848E] text-2xs mt-1">{Math.round(volume * 100)}%</p>
    </div>
  );
}

/* ===== Screen share video element ===== */
function ScreenShareVideo({ stream, label, isRemote = false }: { stream: MediaStream; label: string; isRemote?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const track = stream.getVideoTracks()[0];
  const trackId = track?.id ?? '';
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    const t = stream.getVideoTracks()[0];
    if (t) t.enabled = true;
    el.srcObject = stream;
    const play = () => el.play().catch(() => { });
    play();
    const onUnmute = () => play();
    const onLoaded = () => play();
    const onCanPlay = () => play();
    const onPlaying = () => play();
    t?.addEventListener('unmute', onUnmute);
    el.addEventListener('loadeddata', onLoaded);
    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('canplay', onCanPlay);
    el.addEventListener('playing', onPlaying);
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    [100, 300, 600, 1000, 1500, 2000, 3000, 4000, 5000].forEach((ms) => {
      timeouts.push(setTimeout(play, ms));
    });
    return () => {
      t?.removeEventListener('unmute', onUnmute);
      el.removeEventListener('loadeddata', onLoaded);
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('canplay', onCanPlay);
      el.removeEventListener('playing', onPlaying);
      timeouts.forEach(clearTimeout);
    };
  }, [stream, trackId]);
  const streamKey = `${stream?.id ?? ''}-${trackId}`;
  return (
    <div className="absolute inset-0 bg-black">
      <video
        key={streamKey}
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-contain"
        title={label}
      />
      {isRemote && track?.muted && (
        <span className="absolute inset-0 flex items-center justify-center text-[#80848E] text-sm">Waiting for video...</span>
      )}
    </div>
  );
}

/* ===== Participant Video Grid ===== */
function ParticipantGrid({
  participants, localStream, remoteStreams, remoteScreenStreams, speakingUsers,
  currentUserId, ownerId, getMember, cameraEnabled, screenShareEnabled, canKick,
  onUserContextMenu,
}: {
  participants: { socketId: string; userId: string; muted: boolean; deafened: boolean; camera?: boolean }[];
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  remoteScreenStreams: Record<string, MediaStream>;
  speakingUsers: Set<string>;
  currentUserId: string;
  ownerId: string;
  getMember: (id: string) => { _id: string; displayName: string; avatar: string; status: string } | undefined;
  cameraEnabled: boolean;
  screenShareEnabled?: boolean;
  canKick?: boolean;
  onUserContextMenu?: (data: { userId: string; displayName: string; x: number; y: number }) => void;
}) {
  const count = participants.length;
  const gridClass = count <= 1
    ? 'grid-cols-1'
    : count <= 2
      ? 'grid-cols-2'
      : count <= 4
        ? 'grid-cols-2'
        : count <= 6
          ? 'grid-cols-3'
          : 'grid-cols-4';

  return (
    <div className={`grid ${gridClass} gap-3 flex-1 min-h-0 ${count === 1 ? 'max-h-[50vh] w-full max-w-2xl mx-auto self-start' : 'h-full'} auto-rows-fr`}>
      {participants.map((p) => {
        const isMe = p.userId === currentUserId;
        const member = getMember(p.userId);
        const isSpeaking = speakingUsers.has(p.socketId) || speakingUsers.has(p.userId);
        const isOwner = p.userId === ownerId;
        const hasScreen = isMe ? !!screenShareEnabled : !!remoteScreenStreams[p.socketId];
        const hasCamera = isMe ? cameraEnabled : p.camera;
        const stream = isMe ? localStream : remoteStreams[p.socketId];
        const screenStream = isMe ? null : remoteScreenStreams[p.socketId] || null;

        return (
          <ParticipantTile
            key={p.socketId}
            displayName={member?.displayName || 'Unknown'}
            avatar={member?.avatar || ''}
            muted={p.muted}
            deafened={p.deafened}
            isSpeaking={isSpeaking}
            isOwner={isOwner}
            hasCamera={!!hasCamera && !hasScreen}
            hasScreen={!!hasScreen}
            stream={stream || null}
            screenStream={screenStream}
            isMe={isMe}
            fillCell={count >= 2}
            canKick={!!canKick && !isMe && !isOwner}
            onKick={() => {
              if (window.confirm(`Kick ${member?.displayName || 'this user'} from the voice channel?`)) {
                kickVoiceUser(p.socketId);
              }
            }}
            onContextMenu={
              onUserContextMenu && !isMe
                ? (e) => {
                    e.preventDefault();
                    onUserContextMenu({ userId: p.userId, displayName: member?.displayName || 'Unknown', x: e.clientX, y: e.clientY });
                  }
                : undefined
            }
          />
        );
      })}
    </div>
  );
}

/* ===== Single Participant Tile ===== */
function ParticipantTile({
  displayName, avatar, muted, deafened, isSpeaking, isOwner, hasCamera, hasScreen, stream, isMe, fillCell, canKick, onKick, onContextMenu,
}: {
  displayName: string;
  avatar: string;
  muted: boolean;
  deafened: boolean;
  isSpeaking: boolean;
  isOwner: boolean;
  hasCamera: boolean;
  hasScreen?: boolean;
  stream: MediaStream | null;
  screenStream?: MediaStream | null;
  isMe: boolean;
  fillCell?: boolean;
  canKick?: boolean;
  onKick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream && hasCamera) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, hasCamera]);

  // Show camera video in tile; when user is sharing screen, show avatar in tile (screen is in the big area above) so avatar is never missing
  const showVideoInTile = hasCamera && stream && !hasScreen;

  return (
    <div
      className={`relative rounded-xl overflow-hidden bg-[#1e1e28] border-2 transition-all duration-200 min-h-0 ${fillCell ? 'h-full w-full' : 'aspect-video'} ${isSpeaking
        ? 'border-online shadow-lg shadow-online/20'
        : 'border-transparent'
        }`}
      onContextMenu={onContextMenu}
    >
      {/* Video (camera only in tile) or Avatar */}
      {showVideoInTile ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMe}
          className="w-full h-full object-cover absolute inset-0"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className={`rounded-full bg-accent-600 flex items-center justify-center overflow-hidden transition-all ${isSpeaking ? 'w-20 h-20 ring-4 ring-online/30' : 'w-16 h-16'
            }`}>
            {avatar ? (
              <img src={avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-xl font-bold">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Name label */}
      <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-medium truncate">
            {displayName}
          </span>
          {isOwner && (
            <span className="px-1.5 py-0.5 rounded-sm bg-accent-500 text-white text-2xs font-bold uppercase">
              Host
            </span>
          )}
        </div>
      </div>

      {/* Muted/Deafened indicator */}
      {(muted || deafened) && (
        <div className="absolute top-2 right-2 flex gap-1">
          {muted && (
            <div className="w-6 h-6 rounded-full bg-danger-500/80 flex items-center justify-center backdrop-blur-sm">
              <MicOff className="w-3 h-3 text-white" />
            </div>
          )}
          {deafened && (
            <div className="w-6 h-6 rounded-full bg-danger-500/80 flex items-center justify-center backdrop-blur-sm">
              <HeadphoneOff className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
      )}

      {canKick && onKick && (
        <button
          type="button"
          onClick={onKick}
          className="absolute top-2 left-2 w-7 h-7 rounded-full bg-danger-500/30 hover:bg-danger-500/40 text-danger-200 flex items-center justify-center transition-colors"
          title="Kick from voice"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/* ===== Control Button ===== */
function ControlButton({
  active, danger, onClick, icon, title, disabled,
}: {
  active: boolean;
  danger?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all ${disabled
        ? 'bg-[#2a2a35] text-[#5C5F66] cursor-not-allowed opacity-50'
        : danger
          ? 'bg-danger-500/20 text-danger-400 hover:bg-danger-500/30'
          : active
            ? 'bg-[#2a2a35] text-white hover:bg-[#35354a]'
            : 'bg-[#2a2a35] text-[#80848E] hover:bg-[#35354a] hover:text-white'
        }`}
      title={title}
    >
      {icon}
    </button>
  );
}

