import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useVoiceStore } from '../../stores/useVoiceStore';
import { setUserVolume } from '../../services/voice/webrtcService';

interface UserVolumeContextMenuProps {
  userId: string;
  displayName: string;
  x: number;
  y: number;
  onClose: () => void;
}

export default function UserVolumeContextMenu({ userId, displayName, x, y, onClose }: UserVolumeContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const userVolumes = useVoiceStore((s) => s.userVolumes);
  const volume = userVolumes[userId] ?? 1;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[100] w-56 p-3 rounded-lg bg-[#1e1e28] border border-white/10 shadow-xl"
      style={{ left: Math.min(x, window.innerWidth - 224), top: Math.min(y, window.innerHeight - 120) }}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-[#B5BAC1] text-xs font-medium mb-2 truncate" title={displayName}>
        {displayName}
      </p>
      <p className="text-[#80848E] text-2xs mb-2">User volume</p>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => setUserVolume(userId, parseFloat(e.target.value))}
        className="w-full h-2 rounded-full appearance-none bg-layer-4 cursor-pointer accent-accent-500"
      />
      <p className="text-[#80848E] text-2xs mt-1">{Math.round(volume * 100)}%</p>
    </div>,
    document.body
  );
}
