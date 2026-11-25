import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { serverApi, type ServerTemplate } from '../services/api/server.api';
import { useServerStore } from '../stores/useServerStore';
import { useAuthStore } from '../stores/useAuthStore';
import { getSocket } from '../services/socket/socketService';
import RailShell from '../components/firstrun/RailShell';
import { Field, PlateHeading, PrimaryButton, apiError } from '../components/firstrun/parts';

/* Used when the template list can't be loaded, so creating a server never dead-ends. */
const SCRATCH: ServerTemplate = {
  id: 'default',
  name: 'Start from scratch',
  description: 'Basic server with general text and voice channels',
  categories: [
    { name: 'Text Channels', channels: [{ name: 'general', type: 'text' }] },
    { name: 'Voice Channels', channels: [{ name: 'General', type: 'voice' }] },
  ],
};

function channelSummary(t: ServerTemplate) {
  const text = t.categories.flatMap((c) => c.channels.filter((ch) => ch.type === 'text').map((ch) => `#${ch.name}`));
  const voice = t.categories.flatMap((c) => c.channels.filter((ch) => ch.type === 'voice')).length;
  const shown = text.slice(0, 3).join('  ');
  const more = text.length > 3 ? `  +${text.length - 3}` : '';
  return `${shown}${more}${voice ? `  ·  ${voice} voice` : ''}`;
}

function extractInviteCode(input: string): string {
  const trimmed = input.trim();
  const m = trimmed.match(/\/invite\/([a-zA-Z0-9]+)\/?$/);
  return m ? m[1] : trimmed;
}

export default function WelcomePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const addServer = useServerStore((s) => s.addServer);

  const [templates, setTemplates] = useState<ServerTemplate[] | null>(null);
  const [templatesFailed, setTemplatesFailed] = useState(false);
  const [selected, setSelected] = useState<string>('default');
  const [name, setName] = useState(user?.displayName ? `${user.displayName}'s server` : '');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [invite, setInvite] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    serverApi
      .getTemplates()
      .then(({ templates: t }) => {
        setTemplates(t.length ? t : [SCRATCH]);
        if (t.length) setSelected(t[0].id);
      })
      .catch(() => {
        setTemplates([SCRATCH]);
        setTemplatesFailed(true);
      });
  }, []);

  const enter = (serverId: string) => {
    getSocket()?.emit('joinServer', serverId);
    navigate(`/channels/${serverId}`, { replace: true });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setCreateError('Give your server a name.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const { server } = await serverApi.createServer(name.trim(), selected);
      addServer(server);
      enter(server._id);
    } catch (err) {
      setCreateError(apiError(err, "We couldn't create the server. Try again."));
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = extractInviteCode(invite);
    if (!code) {
      setJoinError('Paste an invite link or code.');
      return;
    }
    setJoining(true);
    setJoinError(null);
    try {
      const { server } = await serverApi.joinByInvite(code);
      addServer(server);
      enter(server._id);
    } catch (err) {
      setJoinError(apiError(err, "That invite didn't work. It may have expired; ask for a new link."));
    } finally {
      setJoining(false);
    }
  };

  const onRadioKey = (e: React.KeyboardEvent, index: number) => {
    if (!templates) return;
    const delta = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + templates.length) % templates.length;
    setSelected(templates[next].id);
    (document.getElementById(`tpl-${templates[next].id}`) as HTMLButtonElement | null)?.focus();
  };

  return (
    <RailShell
      steps={[
        { label: 'Account', state: 'done' },
        { label: 'Email code', state: 'done' },
        { label: 'First server', state: 'current' },
      ]}
      aside={
        <Link to="/channels/@me" className="fr-link text-fg">
          Skip for now
        </Link>
      }
    >
      <PlateHeading
        title="Your first server"
        lede="Servers hold your channels and voice rooms. Start one from a template, or join a friend's."
      />

      <form onSubmit={handleCreate}>
        <p id="tpl-label" className="fr-label text-fg mb-3">
          Template
        </p>
        <div role="radiogroup" aria-labelledby="tpl-label" className="grid gap-2" aria-busy={!templates}>
          {!templates
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[66px] border-[1.5px] border-dashed border-line rounded-[2px]" aria-hidden="true" />
              ))
            : templates.map((t, i) => {
                const checked = selected === t.id;
                return (
                  <button
                    key={t.id}
                    id={`tpl-${t.id}`}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    tabIndex={checked ? 0 : -1}
                    onClick={() => setSelected(t.id)}
                    onKeyDown={(e) => onRadioKey(e, i)}
                    className="fr-option"
                  >
                    <span aria-hidden="true" className="flex h-8 items-stretch justify-center gap-[3px]">
                      <span className="block w-[3px] bg-fg" />
                      {checked && <span className="block w-[3px] bg-fg" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-fg">{t.name}</span>
                      <span className="block text-sm text-fg-3 truncate">{channelSummary(t)}</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`block w-4 h-4 rounded-full border-2 border-fg ${checked ? 'bg-fg' : ''}`}
                    />
                  </button>
                );
              })}
        </div>
        {templatesFailed && (
          <p className="mt-2 text-sm text-fg-3">Templates didn't load, so you can start from scratch for now.</p>
        )}

        <Field
          className="mt-6"
          label="Server name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setCreateError(null);
          }}
          placeholder="Hội bạn thân"
          maxLength={100}
          required
          error={createError}
        />
        <div className="mt-5">
          <PrimaryButton type="submit" disabled={creating || !templates} busy={creating} busyLabel="Creating server">
            Create server
          </PrimaryButton>
        </div>
      </form>

      <div className="my-8 flex items-center gap-4" aria-hidden="true">
        <span className="flex-1 border-t-[1.5px] border-dashed border-line" />
        <span className="fr-label text-fg-3">or</span>
        <span className="flex-1 border-t-[1.5px] border-dashed border-line" />
      </div>

      <form onSubmit={handleJoin} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
        <Field
          label="Join with an invite"
          value={invite}
          onChange={(e) => {
            setInvite(e.target.value);
            setJoinError(null);
          }}
          placeholder="Invite link or code"
          autoCapitalize="none"
          spellCheck={false}
          error={joinError}
        />
        <button type="submit" disabled={joining || !invite.trim()} className="fr-btn-ghost sm:w-auto sm:mt-[24px] sm:h-12">
          <span>{joining ? 'Joining' : 'Join'}</span>
        </button>
      </form>
    </RailShell>
  );
}
