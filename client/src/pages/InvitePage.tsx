import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { serverApi } from '../services/api/server.api';
import { useServerStore } from '../stores/useServerStore';
import { toast } from 'sonner';

interface InvitePreview {
  name: string;
  description?: string;
  icon: string;
  banner: string;
  memberCount: number;
  onlineCount: number;
}

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { addServer, setServers } = useServerStore();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('app-loading', loading || joining);
    return () => document.documentElement.classList.remove('app-loading');
  }, [loading, joining]);

  useEffect(() => {
    if (!code) {
      navigate('/channels', { replace: true });
      return;
    }

    serverApi
      .getInvitePreview(code)
      .then(setPreview)
      .catch((err) => {
        const msg = err?.response?.data?.error || 'Invalid invite link';
        setError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, [code, navigate]);

  const handleJoin = async () => {
    if (!code || joining) return;
    setJoining(true);
    try {
      const { server, alreadyMember } = await serverApi.joinByInvite(code);
      addServer(server);
      const { servers } = await serverApi.getMyServers();
      setServers(servers);
      if (alreadyMember) {
        toast.info('You are already a member');
      } else {
        toast.success(`Joined ${server.name}`);
      }
      navigate(`/channels/${server._id}`, { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to join';
      toast.error(msg);
    } finally {
      setJoining(false);
    }
  };

  const handleCancel = () => {
    navigate('/channels', { replace: true });
  };

  const getBgStyle = (p: InvitePreview | null) => {
    if (!p?.banner) return {};
    const isImg = p.banner.startsWith('http://') || p.banner.startsWith('https://');
    return isImg ? { backgroundImage: `url(${p.banner})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { backgroundColor: p.banner };
  };

  if (!code) return null;

  if (joining) {
    return (
      <div className="fixed inset-0 h-full min-h-dvh w-full overflow-hidden flex items-center justify-center bg-layer-1" style={getBgStyle(preview)}>
        <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
        <div className="relative z-10 bg-[#2b2d31]/95 backdrop-blur-sm rounded-2xl px-12 py-10 flex flex-col items-center gap-6 shadow-2xl border border-white/5">
          <div className="w-14 h-14 rounded-2xl bg-accent-500 flex items-center justify-center shadow-lg shadow-accent-500/20">
            <span className="text-white text-2xl font-bold">C</span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin" />
            <p className="text-white font-medium">Joining server...</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="fixed inset-0 h-full min-h-dvh w-full overflow-hidden flex items-center justify-center bg-layer-0">
        <div className="flex flex-col items-center gap-6">
          <div className="w-14 h-14 rounded-2xl bg-accent-500 flex items-center justify-center shadow-lg shadow-accent-500/20">
            <span className="text-white text-2xl font-bold">C</span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin" />
            <p className="text-[#80848E] text-sm">Loading invite...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-layer-1">
        <div className="bg-[#2b2d31]/90 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full mx-4 text-center shadow-2xl border border-white/5">
          <div className="w-16 h-16 rounded-full bg-layer-4 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl text-[#80848E]">!</span>
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Invalid Invite</h1>
          <p className="text-[#B5BAC1] text-sm mb-6">
            {error || 'This invite link may have expired or been revoked.'}
          </p>
          <button onClick={handleCancel} className="btn-secondary w-full py-2.5">
            Back to Camp
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-layer-1" style={getBgStyle(preview)}>
      {preview.banner && (
        <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      )}
      <div className="relative z-10 bg-[#2b2d31]/90 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-white/5">
        <p className="text-[#B5BAC1] text-sm text-center mb-6">You have been invited to join</p>

        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-full bg-layer-4 flex items-center justify-center overflow-hidden mb-4 ring-4 ring-layer-5">
            {preview.icon ? (
              <img src={preview.icon} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-accent-400">
                {preview.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <h1 className="text-xl font-semibold text-white text-center">{preview.name}</h1>
          {preview.description && (
            <p className="text-[#B5BAC1] text-sm text-center mt-2 max-w-xs">{preview.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-sm text-[#B5BAC1]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-online" aria-hidden="true" />
              {preview.onlineCount.toLocaleString()} Online
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#80848E]" aria-hidden="true" />
              {preview.memberCount.toLocaleString()} Members
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full py-3 rounded-md font-medium text-white bg-accent-500 hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {joining ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Accepting Invite...
              </span>
            ) : (
              'Accept Invite'
            )}
          </button>
          <button
            onClick={handleCancel}
            disabled={joining}
            className="w-full py-2.5 text-sm text-[#B5BAC1] hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
