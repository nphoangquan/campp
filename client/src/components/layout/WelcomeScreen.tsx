import { X } from 'lucide-react';
import type { ServerData } from '../../types';

interface Props {
  server: ServerData;
  onClose: () => void;
}

export default function WelcomeScreen({ server, onClose }: Props) {
  const channelCount = Array.isArray(server.channels) ? server.channels.length : 0;
  const memberCount = server.members?.length || 0;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-layer-1 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header with server icon */}
        <div className="relative bg-layer-2 px-8 pt-10 pb-6 text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-[#80848E] hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-20 h-20 rounded-2xl bg-accent-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white text-3xl font-bold">
              {server.name?.charAt(0).toUpperCase() || 'S'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">
            Welcome to {server.name}
          </h1>
          <p className="text-[#B5BAC1] text-sm">
            You have joined the server successfully.
          </p>
        </div>

        {/* Stats */}
        <div className="px-8 py-6 flex gap-6 justify-center border-t border-layer-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-accent-400">{channelCount}</div>
            <div className="text-xs text-[#80848E] uppercase tracking-wider">Channels</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent-400">{memberCount}</div>
            <div className="text-xs text-[#80848E] uppercase tracking-wider">Members</div>
          </div>
        </div>

        {/* CTA */}
        <div className="px-8 pb-8">
          <button
            onClick={onClose}
            className="w-full py-3 bg-accent-500 hover:bg-accent-400 text-white font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Explore Server
          </button>
        </div>
      </div>
    </div>
  );
}
