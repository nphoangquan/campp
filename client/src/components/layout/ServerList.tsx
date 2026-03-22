import { useState, useEffect } from 'react';
import { Plus, ChevronLeft } from 'lucide-react';
import { useServerStore } from '../../stores/useServerStore';
import { serverApi, type ServerTemplate } from '../../services/api/server.api';
import { getSocket } from '../../services/socket/socketService';
import { toast } from 'sonner';
import WelcomeScreen from './WelcomeScreen';
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
      <div className="w-[72px] shrink-0 bg-layer-0 flex flex-col items-center py-3 gap-2 overflow-y-auto">
        {/* Home / DMs */}
        <div className="relative group">
          {isHome && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-1 h-8 bg-white rounded-r" />
          )}
          <button
            onClick={() => onSelectServer('')}
            className={`w-12 h-12 flex items-center justify-center overflow-hidden cursor-pointer transition-all duration-200 mb-1 rounded-full ${isHome ? 'bg-accent-500' : 'bg-layer-3 hover:bg-accent-500'
              }`}
          >
            <span className="text-white font-bold text-lg">C</span>
          </button>
        </div>

        <div className="w-8 h-px bg-layer-4 my-1" />

        {/* Server icons */}
        {servers.map((server) => (
          <div key={server._id} className="relative group">
            {currentServer?._id === server._id && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-1 h-8 bg-white rounded-r" />
            )}
            <button
              onClick={() => onSelectServer(server._id)}
              className={`w-12 h-12 flex items-center justify-center overflow-hidden cursor-pointer transition-all duration-200 rounded-full ${currentServer?._id === server._id ? 'bg-accent-500' : 'bg-layer-3 hover:bg-accent-500'
                }`}
              title={server.name}
            >
              {server.icon ? (
                <img src={server.icon} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-sm font-semibold">
                  {server.name.charAt(0).toUpperCase()}
                </span>
              )}
            </button>
          </div>
        ))}

        {/* Add server */}
        <button
          onClick={() => setShowModal(true)}
          className="w-12 h-12 bg-layer-3 rounded-full flex items-center justify-center cursor-pointer hover:bg-accent-500 transition-all duration-200 group"
        >
          <Plus className="w-5 h-5 text-accent-400 group-hover:text-white" />
        </button>
      </div>

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
          <div className="bg-layer-1 rounded-lg p-6 w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {createStep === 'template' ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white">Create a Server</h2>
                </div>
                <p className="text-[#80848E] text-sm mb-4">Choose a template to get started</p>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {templates.length === 0 ? (
                    <button
                      onClick={() => handleSelectTemplate({ id: 'default', name: 'Start from scratch', description: 'Basic server with general text and voice channels', categories: [{ name: 'Text Channels', channels: [{ name: 'general', type: 'text' }] }, { name: 'Voice Channels', channels: [{ name: 'General', type: 'voice' }] }] })}
                      className="text-left p-4 rounded-lg bg-layer-2 hover:bg-layer-4 border border-layer-4 transition-colors"
                    >
                      <div className="font-medium text-white text-sm">Start from scratch</div>
                      <div className="text-[#80848E] text-xs">Basic server with general channels</div>
                    </button>
                  ) : (
                    templates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleSelectTemplate(t)}
                        className="text-left p-4 rounded-lg bg-layer-2 hover:bg-layer-4 border border-layer-4 hover:border-layer-5 transition-colors"
                      >
                        <div className="font-medium text-white text-sm mb-1">{t.name}</div>
                        <div className="text-[#80848E] text-xs line-clamp-2">{t.description}</div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {t.categories.slice(0, 2).map((c) => (
                            <span key={c.name} className="text-[#5C5F66] text-2xs">
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
                  className="flex items-center gap-1 text-[#80848E] hover:text-white text-sm mb-4"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
                <h2 className="text-xl font-semibold text-white mb-2">Name your server</h2>
                <p className="text-[#80848E] text-sm mb-4">
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
              <span className="text-[#80848E] text-xs uppercase">or</span>
              <div className="flex-1 h-px bg-layer-4" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide mb-2">
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
