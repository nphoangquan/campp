import { Mic, MicOff, Headphones, HeadphoneOff, PhoneOff, Signal } from 'lucide-react';
import { useVoiceStore } from '../../stores/useVoiceStore';
import { toggleMute, toggleDeafen, leaveVoiceChannel } from '../../services/voice/webrtcService';

export default function VoicePanel() {
  const { connected, channelName, muted, deafened } = useVoiceStore();

  if (!connected) return null;

  return (
    <div className="bg-layer-0/80 border-t border-layer-4">
      {/* Connection info */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Signal className="w-4 h-4 text-online" />
          <div className="flex-1 min-w-0">
            <p className="text-online text-xs font-semibold">Voice Connected</p>
            <p className="text-[#80848E] text-2xs truncate">{channelName}</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1 px-2 pb-2">
        <button
          onClick={toggleMute}
          className={`flex-1 h-8 rounded flex items-center justify-center cursor-pointer transition-colors ${
            muted
              ? 'bg-danger-500/20 text-danger-400 hover:bg-danger-500/30'
              : 'bg-layer-4 text-[#B5BAC1] hover:bg-layer-5'
          }`}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <button
          onClick={toggleDeafen}
          className={`flex-1 h-8 rounded flex items-center justify-center cursor-pointer transition-colors ${
            deafened
              ? 'bg-danger-500/20 text-danger-400 hover:bg-danger-500/30'
              : 'bg-layer-4 text-[#B5BAC1] hover:bg-layer-5'
          }`}
          title={deafened ? 'Undeafen' : 'Deafen'}
        >
          {deafened ? <HeadphoneOff className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
        </button>

        <button
          onClick={leaveVoiceChannel}
          className="flex-1 h-8 rounded bg-danger-500/20 text-danger-400 hover:bg-danger-500 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          title="Disconnect"
        >
          <PhoneOff className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
