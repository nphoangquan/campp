import { useState, useEffect } from 'react';
import { Plus, ChevronLeft } from 'lucide-react';
import { useServerStore } from '../../stores/useServerStore';
import { serverApi, type ServerTemplate } from '../../services/api/server.api';
import { getSocket } from '../../services/socket/socketService';
import { toast } from 'sonner';
import WelcomeScreen from './WelcomeScreen';
import { useServerSignals } from '../../hooks/useServerSignals';
import type { ServerData } from '../../types';

interface Props {
  onSelectServer: (serverId: string) => void;
  isHome?: boolean;
}

export default function ServerList({ onSelectServer, isHome }: Props) {
  const { servers, currentServer, addServer } = useServerStore();
  const [showModal, setShowModal] = useState(false);
  const [createStep, setCreateStep] = useState<'template' | 'name'>('template');
  const [templates, setTemplates] = useState<ServerTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ServerTemplate | null>(null);
  const [serverName, setServerName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [welcomeServer, setWelcomeServer] = useState<ServerData | null>(null);
  const signals = useServerSignals(currentServer?._id);

  useEffect(() => {
    if (showModal && createStep === 'template') {
      serverApi.getTemplates().then(({ templates: t }) => setTemplates(t)).catch(() => setTemplates([]));
    }
  }, [showModal, createStep]);

  const handleSelectTemplate = (t: ServerTemplate) => {
    setSelectedTemplate(t);
    setCreateStep('name');
  };

  const handleCreate = async () => {
    if (!serverName.trim()) return;
    setIsCreating(true);
    try {
      const { server } = await serverApi.createServer(serverName.trim(), selectedTemplate?.id);
      addServer(server);
      getSocket()?.emit('joinServer', server._id);
      onSelectServer(server._id);
      setShowModal(false);
      setServerName('');
      setSelectedTemplate(null);
      setCreateStep('template');
      toast.success('Server created');
    } catch {
      toast.error('Failed to create server');
    } finally {
      setIsCreating(false);
    }
  };

  const extractInviteCode = (input: string): string => {
    const trimmed = input.trim();
    // Match patterns like: https://domain/invite/CODE or http://domain/invite/CODE
    const urlMatch = trimmed.match(/\/invite\/([a-zA-Z0-9]+)\/?$/);
    if (urlMatch) return urlMatch[1];
    // Otherwise treat entire input as the code
    return trimmed;
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    const code = extractInviteCode(inviteCode);
    if (!code) { toast.error('Invalid invite code'); return; }
    setIsCreating(true);
    try {
      const { server, alreadyMember } = await serverApi.joinByInvite(code);
      if (alreadyMember) {
        onSelectServer(server._id);
        setShowModal(false);
        setInviteCode('');
        toast.info('You are already a member of this server');
        return;
      }
      addServer(server);
      getSocket()?.emit('joinServer', server._id);
      onSelectServer(server._id);
      setShowModal(false);
      setInviteCode('');
      setWelcomeServer(server);
      toast.success('Joined server');
    } catch {
      toast.error('Invalid invite code');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <nav
        aria-label="Servers"
        className="w-[72px] shrink-0 bg-rail border-r border-line flex flex-col items-center pt-3 pb-3 gap-1.5 overflow-y-auto"
      >
        <RailItem label="Direct messages" active={!!isHome} onClick={() => onSelectServer('')}>
          <span className="font-pixel text-[22px] leading-none">C</span>
        </RailItem>

        <span aria-hidden="true" className="block w-6 h-px bg-line-strong my-1.5" />

        {servers.map((server) => {
          const active = currentServer?._id === server._id;
          const sig = active ? undefined : signals[server._id];
          return (
            <RailItem
              key={server._id}
              label={server.name}
              active={active}
              unread={!!sig?.unread}
              mentions={sig?.mentions ?? 0}
              onClick={() => onSelectServer(server._id)}
            >
              {server.icon ? (
                <img src={server.icon} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[15px] font-semibold tracking-tight">{initials(server.name)}</span>
              )}
            </RailItem>
          );
        })}

        <RailItem label="Create or join a server" onClick={() => setShowModal(true)} dashed>
          <Plus className="w-5 h-5" strokeWidth={1.75} />
        </RailItem>
      </nav>

      {/* Create/Join Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => {
            setShowModal(false);
            setCreateStep('template');
            setSelectedTemplate(null);
            setServerName('');
          }}
        >
          <div className="bg-layer-1 rounded-[2px] p-6 w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {createStep === 'template' ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-fg">Create a Server</h2>
                </div>
                <p className="text-fg-3 text-sm mb-4">Choose a template to get started</p>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {templates.length === 0 ? (
                    <button
                      onClick={() => handleSelectTemplate({ id: 'default', name: 'Start from scratch', description: 'Basic server with general text and voice channels', categories: [{ name: 'Text Channels', channels: [{ name: 'general', type: 'text' }] }, { name: 'Voice Channels', channels: [{ name: 'General', type: 'voice' }] }] })}
                      className="text-left p-4 rounded-[2px] bg-layer-2 hover:bg-layer-4 border border-layer-4 transition-colors"
                    >
                      <div className="font-medium text-fg text-sm">Start from scratch</div>
                      <div className="text-fg-3 text-xs">Basic server with general channels</div>
                    </button>
                  ) : (
                    templates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleSelectTemplate(t)}
                        className="text-left p-4 rounded-[2px] bg-layer-2 hover:bg-layer-4 border border-layer-4 hover:border-layer-5 transition-colors"
                      >
                        <div className="font-medium text-fg text-sm mb-1">{t.name}</div>
                        <div className="text-fg-3 text-xs line-clamp-2">{t.description}</div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {t.categories.slice(0, 2).map((c) => (
                            <span key={c.name} className="text-fg-4 text-2xs">
                              {c.name}: {c.channels.map((ch) => `${ch.type === 'text' ? '#' : ''}${ch.name}`).join(', ')}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => setCreateStep('template')}
                  className="flex items-center gap-1 text-fg-3 hover:text-fg text-sm mb-4"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
                <h2 className="text-xl font-semibold text-fg mb-2">Name your server</h2>
                <p className="text-fg-3 text-sm mb-4">
                  {selectedTemplate ? `Creating from "${selectedTemplate.name}" template` : 'Create a new server'}
                </p>
                <div className="flex gap-2 mb-6">
                  <input
                    type="text"
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                    className="input flex-1"
                    placeholder="Server name"
                    maxLength={100}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  />
                  <button onClick={handleCreate} disabled={isCreating || !serverName.trim()} className="btn-primary">
                    {isCreating ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </>
            )}

            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-layer-4" />
              <span className="text-fg-3 text-xs uppercase">or</span>
              <div className="flex-1 h-px bg-layer-4" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-fg-2 uppercase tracking-wide mb-2">
                Join with invite code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="input flex-1"
                  placeholder="Enter invite code"
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                />
                <button onClick={handleJoin} disabled={isCreating || !inviteCode.trim()} className="btn-secondary">
                  Join
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                setShowModal(false);
                setCreateStep('template');
                setSelectedTemplate(null);
                setServerName('');
              }}
              className="btn-ghost w-full mt-4"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {welcomeServer && (
        <WelcomeScreen
          server={welcomeServer}
          onClose={() => setWelcomeServer(null)}
        />
      )}
    </>
  );
}

/** Up to two initials, so "Hội Bạn Thân" reads as "HB" rather than one letter. */
function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const pick = words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2);
  return pick.toUpperCase();
}

interface RailItemProps {
  label: string;
  active?: boolean;
  unread?: boolean;
  mentions?: number;
  dashed?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

/**
 * One server on the rail. The notch on the left carries state by shape:
 * a short notch for unread, a tall one for the open server. Mentions add a
 * red count chip.
 */
function RailItem({ label, active, unread, mentions = 0, dashed, onClick, children }: RailItemProps) {
  return (
    <div className="group relative w-full flex justify-center">
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] bg-fg transition-[height,opacity] duration-200 ease-out ${
          active ? 'h-7 opacity-100' : unread ? 'h-2 opacity-100 group-hover:h-4' : 'h-0 opacity-0 group-hover:h-4 group-hover:opacity-60'
        }`}
      />
      <button
        type="button"
        onClick={onClick}
        aria-label={label + (mentions ? `, ${mentions} mentions` : unread ? ', unread messages' : '')}
        aria-current={active ? 'page' : undefined}
        title={label}
        className={`relative w-11 h-11 flex items-center justify-center overflow-visible rounded-[2px] cursor-pointer transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-link focus-visible:ring-offset-2 focus-visible:ring-offset-rail ${
          active
            ? 'bg-primary text-on-primary'
            : dashed
              ? 'border border-dashed border-line-strong text-fg-3 hover:text-fg hover:border-fg-3'
              : 'bg-surface text-fg border border-line hover:border-line-strong hover:bg-surface-2'
        }`}
      >
        <span className="w-full h-full flex items-center justify-center overflow-hidden rounded-[2px]">{children}</span>
        {mentions > 0 && (
          <span className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-chip-red text-white text-[11px] font-semibold tabular-nums ring-2 ring-rail">
            {mentions > 99 ? '99+' : mentions}
          </span>
        )}
      </button>
    </div>
  );
}
