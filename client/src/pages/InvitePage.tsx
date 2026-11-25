import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { serverApi } from '../services/api/server.api';
import { useServerStore } from '../stores/useServerStore';
import { toast } from 'sonner';
import RailShell from '../components/firstrun/RailShell';
import { ErrorLine, PlateHeading, PrimaryButton } from '../components/firstrun/parts';

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
  const [joinError, setJoinError] = useState<string | null>(null);

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
      })
      .finally(() => setLoading(false));
  }, [code, navigate]);

  const handleJoin = async () => {
    if (!code || joining) return;
    setJoining(true);
    setJoinError(null);
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
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "We couldn't join this server. Try again.";
      setJoinError(msg);
    } finally {
      setJoining(false);
    }
  };

  const handleCancel = () => {
    navigate('/channels', { replace: true });
  };

  if (!code) return null;

  const steps = [
    { label: 'Invite', state: 'current' as const },
    { label: 'In the server', state: 'pending' as const },
  ];
  const aside = (
    <Link to="/channels" className="fr-link text-fg">
      Back to Camp
    </Link>
  );

  if (loading) {
    return (
      <RailShell steps={steps} aside={aside} plateKey="loading">
        <div role="status" aria-label="Loading invite" className="space-y-4">
          <span className="block h-12 w-3/4 border-[1.5px] border-dashed border-line" />
          <span className="block h-5 w-1/2 border-[1.5px] border-dashed border-line" />
          <span className="block h-[52px] w-full mt-8 border-[1.5px] border-dashed border-line" />
        </div>
      </RailShell>
    );
  }

  if (error || !preview) {
    return (
      <RailShell steps={steps} aside={aside} plateKey="error">
        <PlateHeading title="This invite doesn't work" />
        <ErrorLine>{error || 'The link may have expired or been revoked.'}</ErrorLine>
        <p className="mt-4 text-fg-3">Ask whoever sent it for a fresh link, or start your own server.</p>
        <div className="mt-8 grid gap-3">
          <Link to="/welcome" className="fr-btn no-underline">
            <span>Start my own server</span>
          </Link>
          <button type="button" onClick={handleCancel} className="fr-btn-ghost">
            <span>Back to Camp</span>
          </button>
        </div>
      </RailShell>
    );
  }

  return (
    <RailShell steps={steps} aside={aside} plateKey="invite">
      <div className="flex items-center gap-5 mb-6">
        <div className="w-16 h-16 shrink-0 bg-primary text-on-primary flex items-center justify-center overflow-hidden rounded-[2px]">
          {preview.icon ? (
            <img src={preview.icon} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="font-semibold text-2xl">{preview.name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <h1 className="fr-display min-w-0 break-words">{preview.name}</h1>
      </div>
      <p className="text-fg-3 mb-6 max-w-[48ch]">
        {preview.description || 'You were invited to join this server.'}
      </p>
      <dl className="flex gap-8 border-y-[1.5px] border-fg py-4 mb-8">
        <div>
          <dt className="fr-label text-fg-3">Online now</dt>
          <dd className="mt-1 flex items-center gap-2 font-pixel text-[30px] leading-none">
            <span aria-hidden="true" className="block w-3 h-3 rounded-full bg-online ring-1 ring-fg" />
            {preview.onlineCount.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="fr-label text-fg-3">Members</dt>
          <dd className="mt-1 font-pixel text-[30px] leading-none">{preview.memberCount.toLocaleString()}</dd>
        </div>
      </dl>
      {joinError && <div className="mb-4"><ErrorLine>{joinError}</ErrorLine></div>}
      <PrimaryButton onClick={handleJoin} disabled={joining} busy={joining} busyLabel="Joining">
        Accept invite
      </PrimaryButton>
      <button type="button" onClick={handleCancel} disabled={joining} className="mt-4 fr-link text-fg">
        Not now
      </button>
    </RailShell>
  );
}
