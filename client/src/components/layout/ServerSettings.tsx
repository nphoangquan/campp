import { useState, useEffect, useRef } from 'react';
import {
  X, Plus, Trash2, Shield, ChevronLeft, Users, Lock,
  Paintbrush, Gavel, ScrollText, UserX, Image, ImagePlus, Link2, Copy,
  UserPlus, Search,
} from 'lucide-react';
import { useServerStore } from '../../stores/useServerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { roleApi, moderationApi } from '../../services/api/moderation.api';
import { serverApi } from '../../services/api/server.api';
import { messageApi } from '../../services/api/message.api';
import { toast } from 'sonner';
import type { Role, BanEntry, AuditLogEntry, ServerMember } from '../../types';
import { Permissions, PERMISSION_LABELS } from '../../types';

type Page = 'overview' | 'invites' | 'roles' | 'bans' | 'audit-log';
type RoleTab = 'display' | 'permissions' | 'members';

const PRESET_COLORS = [
  '#99AAB5', '#1ABC9C', '#2ECC71', '#3498DB', '#9B59B6', '#E91E63',
  '#F1C40F', '#E67E22', '#E74C3C', '#95A5A6', '#607D8B', '#11806A',
  '#1F8B4C', '#206694', '#71368A', '#AD1457', '#C27C0E', '#A84300',
  '#992D22', '#546E7A',
];

const BANNER_COLORS = [
  '#FFFFFF', '#FAA2C1', '#F06595', '#FA5252', '#FD7E14', '#FCC419',
  '#9775FA', '#339AF0', '#22B8CF', '#20C997', '#495057', '#212529',
];

const PERMISSION_DESCRIPTIONS: Record<number, string> = {
  [Permissions.ADMINISTRATOR]: 'Full access to all server settings and actions.',
  [Permissions.MANAGE_SERVER]: 'Edit server name, icon and other settings.',
  [Permissions.MANAGE_CHANNELS]: 'Create, edit, and delete channels.',
  [Permissions.MANAGE_ROLES]: 'Create, edit, and delete roles below this one.',
  [Permissions.KICK_MEMBERS]: 'Remove members from the server.',
  [Permissions.BAN_MEMBERS]: 'Permanently ban members from the server.',
  [Permissions.MANAGE_MESSAGES]: 'Delete or pin messages from other members.',
  [Permissions.SEND_MESSAGES]: 'Send messages in text channels.',
  [Permissions.READ_MESSAGES]: 'View messages in text channels.',
  [Permissions.ATTACH_FILES]: 'Upload files and media in messages.',
  [Permissions.ADD_REACTIONS]: 'Add emoji reactions to messages.',
  [Permissions.MUTE_MEMBERS]: 'Temporarily mute members in the server.',
};

interface Props {
  onClose: () => void;
}

export default function ServerSettings({ onClose }: Props) {
  const { currentServer, members, updateServer } = useServerStore();
  const user = useAuthStore((s) => s.user);
  const [page, setPage] = useState<Page>('overview');

  const [roles, setRoles] = useState<Role[]>([]);
  const [bans, setBans] = useState<BanEntry[]>([]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleTab, setRoleTab] = useState<RoleTab>('display');

  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#99AAB5');
  const [editPerms, setEditPerms] = useState(0);
  const [showCustomColor, setShowCustomColor] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const colorInputRef = useRef<HTMLInputElement>(null);

  const isOwner = currentServer?.ownerId === user?._id;
  // Check if user is a moderator (or admin) in the server
  const getUserServerRole = () => {
    if (!currentServer || !user) return 'member';
    const sm = currentServer.members.find((m) => m.userId === user._id);
    return sm?.role || 'member';
  };
  const userServerRole = getUserServerRole();
  const isModerator = userServerRole === 'moderator' || userServerRole === 'admin';
  const canAccessSettings = isOwner || isModerator;

  useEffect(() => {
    if (!currentServer) return;
    loadPageData();
  }, [currentServer?._id, page]);

  useEffect(() => {
    if (selectedRole) {
      setEditName(selectedRole.name);
      setEditColor(selectedRole.color);
      setEditPerms(selectedRole.permissions);
      setHasChanges(false);
    }
  }, [selectedRole]);

  const loadPageData = async () => {
    if (!currentServer) return;
    setLoading(true);
    try {
      if (page === 'overview' || page === 'invites') {
        setLoading(false);
        return;
      }
      if (page === 'roles') {
        const [{ roles: r }, { server }] = await Promise.all([
          roleApi.getRoles(currentServer._id),
          serverApi.getServer(currentServer._id),
        ]);
        updateServer(server);
        setRoles(r);
        if (!selectedRole && r.length > 0) setSelectedRole(r[0]);
      } else if (page === 'bans') {
        const { bans: b } = await moderationApi.getBans(currentServer._id);
        setBans(b);
      } else {
        const { logs: l } = await moderationApi.getAuditLog(currentServer._id);
        setLogs(l);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to load data';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async (data?: { name: string; color: string }) => {
    if (!currentServer) return;
    const name = (data?.name?.trim() || 'new role').slice(0, 100);
    const color = data?.color || '#99AAB5';
    try {
      const { role } = await roleApi.createRole(currentServer._id, { name, color });
      setRoles((prev) => [...prev, role]);
      setSelectedRole(role);
      setRoleTab('display');
      toast.success('Role created');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create role';
      toast.error(msg);
      throw err;
    }
  };

  const handleSaveRole = async () => {
    if (!selectedRole) return;
    try {
      const { role } = await roleApi.updateRole(selectedRole._id, {
        name: editName,
        color: editColor,
        permissions: editPerms,
      });
      setRoles((prev) => prev.map((r) => (r._id === role._id ? role : r)));
      setSelectedRole(role);
      setHasChanges(false);
      toast.success('Role saved');
    } catch {
      toast.error('Failed to save role');
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole || selectedRole.isSystemRole) return;
    try {
      await roleApi.deleteRole(selectedRole._id);
      const updated = roles.filter((r) => r._id !== selectedRole._id);
      setRoles(updated);
      setSelectedRole(updated[0] || null);
      toast.success('Role deleted');
    } catch {
      toast.error('Failed to delete role');
    }
  };

  const handleResetChanges = () => {
    if (!selectedRole) return;
    setEditName(selectedRole.name);
    setEditColor(selectedRole.color);
    setEditPerms(selectedRole.permissions);
    setHasChanges(false);
  };

  const markChanged = () => setHasChanges(true);

  const handleUnban = async (memberId: string) => {
    if (!currentServer) return;
    try {
      await moderationApi.unban(currentServer._id, memberId);
      setBans((prev) => prev.filter((b) => b.userId._id !== memberId));
      toast.success('Member unbanned');
    } catch {
      toast.error('Failed to unban');
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const actionLabels: Record<string, string> = {
    MEMBER_KICK: 'kicked', MEMBER_BAN: 'banned', MEMBER_UNBAN: 'unbanned',
    MEMBER_MUTE: 'muted', MEMBER_UNMUTE: 'unmuted',
    ROLE_CREATE: 'created role', ROLE_UPDATE: 'updated role', ROLE_DELETE: 'deleted role',
    ROLE_ASSIGN: 'assigned role to', ROLE_REMOVE: 'removed role from',
  };

  const actionIcons: Record<string, string> = {
    MEMBER_KICK: '👢', MEMBER_BAN: '🔨', MEMBER_UNBAN: '🔓',
    MEMBER_MUTE: '🔇', MEMBER_UNMUTE: '🔊',
    ROLE_CREATE: '✨', ROLE_UPDATE: '✏️', ROLE_DELETE: '🗑️',
    ROLE_ASSIGN: '🏷️', ROLE_REMOVE: '🏷️',
  };

  if (!currentServer || !canAccessSettings) return null;

  return (
    <div className="fixed inset-0 bg-layer-0 z-50 flex">
      {/* === Left Navigation === */}
      <div className="w-56 bg-layer-1 flex flex-col shrink-0">
        <div className="flex-1 overflow-y-auto pt-6 pb-4 px-2">
          <div className="px-3 mb-6">
            <h2 className="text-white font-bold text-base truncate">{currentServer.name}</h2>
            <p className="text-[#80848E] text-xs mt-0.5">Server Settings</p>
          </div>

          <NavSection title="">
            <NavItem icon={<Image className="w-4 h-4" />} label="Overview" active={page === 'overview'} onClick={() => setPage('overview')} />
            <NavItem icon={<Link2 className="w-4 h-4" />} label="Invites" active={page === 'invites'} onClick={() => setPage('invites')} />
            <NavItem icon={<Shield className="w-4 h-4" />} label="Roles" active={page === 'roles'} onClick={() => setPage('roles')} />
          </NavSection>

          <NavSection title="Moderation">
            <NavItem icon={<UserX className="w-4 h-4" />} label="Bans" active={page === 'bans'} onClick={() => setPage('bans')} />
            <NavItem icon={<ScrollText className="w-4 h-4" />} label="Audit Log" active={page === 'audit-log'} onClick={() => setPage('audit-log')} />
          </NavSection>
        </div>

        <div className="px-2 pb-4">
          <div className="h-px bg-layer-4 mx-2 mb-3" />
          <button onClick={onClose} className="w-full flex items-center gap-2 px-3 py-2 rounded text-[#80848E] hover:text-[#B5BAC1] hover:bg-layer-3 transition-colors cursor-pointer text-sm">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        </div>
      </div>

      {/* === Main Content === */}
      <div className="flex-1 flex flex-col overflow-hidden bg-layer-2">
        {/* Close button (top right) */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full border-2 border-[#80848E] flex items-center justify-center text-[#80848E] hover:border-white hover:text-white transition-colors cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : page === 'overview' ? (
          <OverviewPage currentServer={currentServer} />
        ) : page === 'invites' ? (
          <InvitesPage currentServer={currentServer} />
        ) : page === 'roles' ? (
          <RolesPage
            roles={roles}
            selectedRole={selectedRole}
            setSelectedRole={setSelectedRole}
            roleTab={roleTab}
            setRoleTab={setRoleTab}
            editName={editName}
            setEditName={(v) => { setEditName(v); markChanged(); }}
            editColor={editColor}
            setEditColor={(v) => { setEditColor(v); markChanged(); }}
            editPerms={editPerms}
            setEditPerms={(v) => { setEditPerms(v); markChanged(); }}
            showCustomColor={showCustomColor}
            setShowCustomColor={setShowCustomColor}
            colorInputRef={colorInputRef}
            hasChanges={hasChanges}
            onSave={handleSaveRole}
            onReset={handleResetChanges}
            onDelete={handleDeleteRole}
            onCreate={handleCreateRole}
            canCreateRole={isOwner || isModerator}
            members={members}
            currentServer={currentServer}
            isOwner={isOwner}
            isModerator={isModerator}
            onRefreshServer={async () => {
              if (!currentServer) return;
              const { server } = await serverApi.getServer(currentServer._id);
              updateServer(server);
            }}
          />
        ) : page === 'bans' ? (
          <BansPage bans={bans} onUnban={handleUnban} />
        ) : (
          <AuditLogPage logs={logs} actionLabels={actionLabels} actionIcons={actionIcons} formatDate={formatDate} />
        )}
      </div>
    </div>
  );
}

/* ===== Overview Page ===== */
function OverviewPage({ currentServer }: { currentServer: { _id: string; name: string; description?: string; icon?: string; banner?: string } }) {
  const { updateServer } = useServerStore();
  const [name, setName] = useState(currentServer.name);
  const [description, setDescription] = useState(currentServer.description || '');
  const [icon, setIcon] = useState(currentServer.icon || '');
  const [banner, setBanner] = useState(currentServer.banner || '');
  const [saving, setSaving] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const hasChanges =
    name !== currentServer.name ||
    description !== (currentServer.description || '') ||
    icon !== (currentServer.icon || '') ||
    banner !== (currentServer.banner || '');

  const handleSave = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      const { server } = await serverApi.updateServer(currentServer._id, {
        name,
        description: description || undefined,
        icon: icon || undefined,
        banner: banner || undefined,
      });
      updateServer(server);
      toast.success('Server updated');
    } catch {
      toast.error('Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    const files = fileList ? Array.from(fileList) : [];
    e.target.value = '';
    if (!files.length) return;
    setUploadingIcon(true);
    try {
      const { attachments } = await messageApi.uploadFiles(files);
      const img = attachments.find((a) => a.type === 'image');
      if (img) {
        setIcon(img.url);
      } else {
        toast.error('Please upload an image');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Upload failed';
      toast.error(msg);
    } finally {
      setUploadingIcon(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    const files = fileList ? Array.from(fileList) : [];
    e.target.value = '';
    if (!files.length) return;
    setUploadingBanner(true);
    try {
      const { attachments } = await messageApi.uploadFiles(files);
      const img = attachments.find((a) => a.type === 'image');
      if (img) {
        setBanner(img.url);
      } else {
        toast.error('Please upload an image');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Upload failed';
      toast.error(msg);
    } finally {
      setUploadingBanner(false);
    }
  };

  const isBannerImage = banner && (banner.startsWith('http://') || banner.startsWith('https://'));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl px-8 py-6">
        <h2 className="text-white font-bold text-xl mb-1">Overview</h2>
        <p className="text-[#B5BAC1] text-sm mb-6">
          Customize how your server appears in invite links and in the channel sidebar.
        </p>

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide mb-2">Server Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full max-w-md"
              placeholder="Server name"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide mb-2">Server Description</label>
            <p className="text-[#80848E] text-xs mb-2">A short description of your server. Shown on the invite page.</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              className="input w-full max-w-md min-h-[80px] resize-y"
              placeholder="What's your server about?"
              maxLength={500}
            />
            <p className="text-[#80848E] text-xs mt-1">{description.length}/500</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide mb-2">Icon</label>
            <p className="text-[#80848E] text-xs mb-2">We recommend an image of at least 512x512</p>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-layer-4 flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-layer-5">
                {icon ? (
                  <img src={icon} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-accent-400">{name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="flex gap-2">
                <input ref={iconInputRef} type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
                <button
                  onClick={() => iconInputRef.current?.click()}
                  disabled={uploadingIcon}
                  className="btn-primary py-2 px-4 text-sm"
                >
                  {uploadingIcon ? 'Uploading...' : 'Change Server Icon'}
                </button>
                {icon && (
                  <button
                    onClick={() => setIcon('')}
                    className="text-danger-400 hover:text-danger-300 text-sm font-medium"
                  >
                    Remove Icon
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide mb-2">Banner</label>
            <p className="text-[#80848E] text-xs mb-2">Shown in the channel sidebar and on invite links. Choose a color or upload an image.</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {BANNER_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setBanner(c)}
                  className={`w-8 h-8 rounded border-2 transition-all ${banner === c ? 'border-white scale-110' : 'border-layer-5 hover:border-layer-6'
                    }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
              <button
                onClick={() => bannerInputRef.current?.click()}
                disabled={uploadingBanner}
                className="btn-secondary py-2 px-4 text-sm flex items-center gap-1.5"
              >
                <ImagePlus className="w-4 h-4" />
                {uploadingBanner ? 'Uploading...' : 'Upload Banner Image'}
              </button>
              {banner && (
                <button
                  onClick={() => setBanner('')}
                  className="text-danger-400 hover:text-danger-300 text-sm font-medium"
                >
                  Remove Banner
                </button>
              )}
            </div>
            {banner && (
              <div className="mt-3 w-full max-w-md h-40 rounded-lg overflow-hidden border border-layer-5">
                {isBannerImage ? (
                  <img src={banner} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full" style={{ backgroundColor: banner }} />
                )}
              </div>
            )}
          </div>

          {hasChanges && (
            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary py-2 px-4">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== Invites Page ===== */
function InvitesPage({ currentServer }: { currentServer: { _id: string; name: string; inviteCode: string } }) {
  const { updateServer } = useServerStore();
  const [regenerating, setRegenerating] = useState(false);

  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/invite/${currentServer.inviteCode}`
    : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success('Invite link copied');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const { server } = await serverApi.regenerateInvite(currentServer._id);
      updateServer(server);
      toast.success('New invite link created');

      const newUrl = `${window.location.origin}/invite/${server.inviteCode}`;
      await navigator.clipboard.writeText(newUrl);
      toast.success('New link copied to clipboard');
    } catch {
      toast.error('Failed to create new link');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl px-8 py-6">
        <h2 className="text-white font-bold text-xl mb-1">Invite People</h2>
        <p className="text-[#B5BAC1] text-sm mb-6">
          Share invite links to let people join your server. Anyone with the link can join.
        </p>

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide mb-2">Invite Link</label>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-between gap-3 px-4 py-3 bg-layer-3 rounded-lg border border-layer-5 hover:bg-layer-4 transition-colors cursor-pointer text-left"
              >
                <span className="text-[#B5BAC1] text-sm truncate">{inviteUrl}</span>
                <Copy className="w-4 h-4 text-[#80848E] shrink-0" />
              </button>
              <button
                onClick={handleCopy}
                className="btn-primary py-2 px-4 text-sm shrink-0"
              >
                Copy
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide mb-2">Create New Link</label>
            <p className="text-[#80848E] text-sm mb-3">
              Generate a new invite link. The previous link will stop working.
            </p>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="btn-secondary py-2 px-4 text-sm flex items-center gap-2"
            >
              {regenerating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4" />
                  Create New Link
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Sub-components ===== */

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      {title && (
        <p className="text-[#80848E] text-2xs font-bold uppercase tracking-wider px-3 mb-1">{title}</p>
      )}
      {children}
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded text-sm cursor-pointer transition-colors ${active ? 'bg-layer-4 text-white' : 'text-[#80848E] hover:text-[#B5BAC1] hover:bg-layer-3'
        }`}
    >
      {icon}
      {label}
    </button>
  );
}

/* ===== Roles Page ===== */
function RolesPage({
  roles, selectedRole, setSelectedRole, roleTab, setRoleTab,
  editName, setEditName, editColor, setEditColor, editPerms, setEditPerms,
  showCustomColor, setShowCustomColor, colorInputRef,
  hasChanges, onSave, onReset, onDelete, onCreate,
  canCreateRole,
  members, currentServer, isOwner, isModerator, onRefreshServer,
}: {
  roles: Role[];
  selectedRole: Role | null;
  setSelectedRole: (r: Role) => void;
  roleTab: RoleTab;
  setRoleTab: (t: RoleTab) => void;
  editName: string;
  setEditName: (v: string) => void;
  editColor: string;
  setEditColor: (v: string) => void;
  editPerms: number;
  setEditPerms: (v: number) => void;
  showCustomColor: boolean;
  setShowCustomColor: (v: boolean) => void;
  colorInputRef: React.RefObject<HTMLInputElement | null>;
  hasChanges: boolean;
  onSave: () => void;
  onReset: () => void;
  onDelete: () => void;
  onCreate: (data?: { name: string; color: string }) => void;
  canCreateRole: boolean;
  members: { _id: string; displayName: string; avatar: string; status: string }[];
  currentServer: { _id: string; members: ServerMember[] };
  isOwner: boolean;
  isModerator: boolean;
  onRefreshServer?: () => Promise<void>;
}) {
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#99AAB5');
  const [creating, setCreating] = useState(false);

  const openCreateModal = () => {
    setNewRoleName('');
    setNewRoleColor('#99AAB5');
    setShowCreateRoleModal(true);
  };

  const submitCreateRole = async () => {
    setCreating(true);
    try {
      await Promise.resolve(onCreate({ name: newRoleName.trim() || 'new role', color: newRoleColor }));
      setShowCreateRoleModal(false);
    } catch {
      // Parent already shows toast; keep modal open
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Create Role modal */}
      {showCreateRoleModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60" onClick={() => !creating && setShowCreateRoleModal(false)}>
          <div className="bg-layer-2 rounded-lg shadow-xl border border-layer-4 w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-bold text-lg mb-4">Create Role</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wider mb-2">Role name</label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value.slice(0, 100))}
                  placeholder="new role"
                  className="input w-full"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wider mb-2">Color</label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewRoleColor(c)}
                      className={`w-8 h-8 rounded-md transition-all ${newRoleColor === c ? 'ring-2 ring-white scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => !creating && setShowCreateRoleModal(false)} className="btn-secondary py-2 px-4" disabled={creating}>Cancel</button>
              <button type="button" onClick={submitCreateRole} className="btn-primary py-2 px-4" disabled={creating}>
                {creating ? 'Creating...' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role list panel */}
      <div className="w-52 border-r border-layer-4 flex flex-col shrink-0">
        <div className="p-3 flex items-center justify-between border-b border-layer-4">
          <span className="text-[#80848E] text-xs font-bold uppercase tracking-wider">Roles — {roles.length}</span>
          {canCreateRole && (
            <button onClick={openCreateModal} className="w-6 h-6 rounded bg-accent-500 hover:bg-accent-400 flex items-center justify-center cursor-pointer transition-colors" title="Create Role">
              <Plus className="w-3.5 h-3.5 text-white" />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {roles.map((role) => {
            // System roles: Admin/Moderator count by server role; Member = everyone. Custom roles: count by customRoleIds.
            const memberCount = role.isSystemRole
              ? (role.type === 'member'
                ? currentServer.members.length
                : currentServer.members.filter((m) => m.role === role.type).length)
              : currentServer.members.filter((m) => (m.customRoleIds ?? []).includes(role._id)).length;
            return (
              <button
                key={role._id}
                onClick={() => { setSelectedRole(role); setRoleTab('display' as RoleTab); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer transition-colors ${selectedRole?._id === role._id
                  ? 'bg-layer-4'
                  : 'hover:bg-layer-3'
                  }`}
              >
                <div className="w-3 h-3 rounded-full shrink-0 ring-2 ring-transparent" style={{ backgroundColor: role.color }} />
                <span className={`text-sm truncate flex-1 min-w-0 ${selectedRole?._id === role._id ? 'text-white font-medium' : 'text-[#B5BAC1]'}`}>
                  {role.name}
                </span>
                <span className="text-[#5C5F66] text-2xs shrink-0">{memberCount}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Edit panel */}
      {selectedRole ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header with role name + tabs */}
          <div className="px-8 pt-6 pb-0">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-white font-bold text-lg">Edit Role</h2>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: selectedRole.color + '22', color: selectedRole.color }}>
                {selectedRole.name}
              </span>
            </div>
            {/* Tabs */}
            <div className="flex gap-0 mt-4 border-b border-layer-4">
              {([
                { key: 'display', icon: <Paintbrush className="w-3.5 h-3.5" />, label: 'Display' },
                { key: 'permissions', icon: <Lock className="w-3.5 h-3.5" />, label: 'Permissions' },
                {
                  key: 'members',
                  icon: <Users className="w-3.5 h-3.5" />,
                  label: `Manage Members (${selectedRole.isSystemRole ? (selectedRole.type === 'member' ? currentServer.members.length : currentServer.members.filter((m) => m.role === selectedRole.type).length) : currentServer.members.filter((m) => (m.customRoleIds ?? []).includes(selectedRole._id)).length})`,
                },
              ] as { key: RoleTab; icon: React.ReactNode; label: string }[]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setRoleTab(t.key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium cursor-pointer transition-colors relative ${roleTab === t.key
                    ? 'text-white'
                    : 'text-[#80848E] hover:text-[#B5BAC1]'
                    }`}
                >
                  {t.icon}
                  {t.label}
                  {roleTab === t.key && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-500 rounded-t" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            {roleTab === 'display' && (
              <DisplayTab
                editName={editName}
                setEditName={setEditName}
                editColor={editColor}
                setEditColor={setEditColor}
                showCustomColor={showCustomColor}
                setShowCustomColor={setShowCustomColor}
                colorInputRef={colorInputRef}
                isDefault={selectedRole.isSystemRole}
              />
            )}
            {roleTab === 'permissions' && (
              <PermissionsTab
                editPerms={editPerms}
                togglePerm={(p) => setEditPerms(editPerms ^ p)}
                isOwner={isOwner}
                isModerator={isModerator}
              />
            )}
            {roleTab === 'members' && (
              <MembersTab
                role={selectedRole}
                members={members}
                serverMembers={currentServer.members}
                serverId={currentServer._id}
                onRefreshServer={onRefreshServer}
              />
            )}
          </div>

          {/* Save bar */}
          {hasChanges && (
            <div className="px-8 py-3 bg-layer-0 border-t border-layer-4 flex items-center justify-between animate-in slide-in-from-bottom-2">
              <span className="text-[#B5BAC1] text-sm">Careful — you have unsaved changes!</span>
              <div className="flex gap-2">
                <button onClick={onReset} className="text-sm text-[#B5BAC1] hover:text-white hover:underline cursor-pointer px-3 py-1.5 transition-colors">Reset</button>
                <button onClick={onSave} className="bg-online hover:brightness-110 text-white text-sm font-medium px-4 py-1.5 rounded cursor-pointer transition-all">Save Changes</button>
              </div>
            </div>
          )}

          {/* Delete zone */}
          {!selectedRole.isSystemRole && roleTab === 'display' && (
            <div className="px-8 pb-6">
              <div className="border-t border-layer-4 pt-4">
                <button onClick={onDelete} className="flex items-center gap-2 text-danger-400 hover:text-danger-400 hover:bg-danger-500/10 px-3 py-2 rounded text-sm cursor-pointer transition-colors">
                  <Trash2 className="w-4 h-4" /> Delete Role
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-[#80848E]">
          Select a role to edit
        </div>
      )}
    </div>
  );
}

/* ===== Display Tab ===== */
function DisplayTab({
  editName, setEditName, editColor, setEditColor,
  showCustomColor, setShowCustomColor, colorInputRef, isDefault,
}: {
  editName: string;
  setEditName: (v: string) => void;
  editColor: string;
  setEditColor: (v: string) => void;
  showCustomColor: boolean;
  setShowCustomColor: (v: boolean) => void;
  colorInputRef: React.RefObject<HTMLInputElement | null>;
  isDefault: boolean;
}) {
  return (
    <div className="space-y-6 max-w-lg">
      {/* Role name */}
      <div>
        <label className="block text-xs font-bold text-[#B5BAC1] uppercase tracking-wider mb-2">
          Role Name {!isDefault && <span className="text-danger-400">*</span>}
        </label>
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="input text-sm"
          placeholder="Role name"
          disabled={isDefault}
        />
      </div>

      {/* Role color */}
      <div>
        <label className="block text-xs font-bold text-[#B5BAC1] uppercase tracking-wider mb-2">
          Role Color
        </label>
        <p className="text-[#80848E] text-xs mb-3">
          Members use the color of the highest role they have on the roles list.
        </p>

        {/* Color swatches */}
        <div className="flex flex-wrap gap-1.5">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => { setEditColor(color); setShowCustomColor(false); }}
              className={`w-8 h-8 rounded-md cursor-pointer transition-all hover:scale-110 hover:ring-2 hover:ring-white/30 ${editColor === color && !showCustomColor ? 'ring-2 ring-white scale-110' : ''
                }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
          {/* Custom color button */}
          <button
            onClick={() => {
              setShowCustomColor(true);
              setTimeout(() => colorInputRef.current?.click(), 50);
            }}
            className={`w-8 h-8 rounded-md cursor-pointer border-2 border-dashed transition-all hover:scale-110 flex items-center justify-center ${showCustomColor ? 'border-white ring-2 ring-white/30 scale-110' : 'border-[#80848E] hover:border-[#B5BAC1]'
              }`}
            style={showCustomColor ? { backgroundColor: editColor } : undefined}
            title="Custom color"
          >
            {!showCustomColor && <Paintbrush className="w-3.5 h-3.5 text-[#80848E]" />}
          </button>
        </div>

        {/* Custom color picker */}
        {showCustomColor && (
          <div className="mt-3 flex items-center gap-3">
            <input
              ref={colorInputRef as React.RefObject<HTMLInputElement>}
              type="color"
              value={editColor}
              onChange={(e) => setEditColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-2 [&::-webkit-color-swatch]:border-layer-5"
            />
            <div className="flex items-center bg-layer-0 border border-layer-5 rounded px-3 py-1.5 gap-1">
              <span className="text-[#80848E] text-sm">#</span>
              <input
                type="text"
                value={editColor.replace('#', '')}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                  if (v.length <= 6) setEditColor('#' + v);
                }}
                className="bg-transparent text-[#B5BAC1] text-sm w-20 outline-none font-mono"
                maxLength={6}
              />
            </div>
          </div>
        )}

        {/* Preview */}
        <div className="mt-4 bg-layer-0 rounded-lg p-3">
          <p className="text-[#80848E] text-2xs uppercase tracking-wider font-bold mb-2">Preview</p>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-accent-600 flex items-center justify-center text-white text-xs font-bold">C</div>
            <div>
              <span className="text-sm font-medium" style={{ color: editColor }}>{editName || 'Role'}</span>
              <span className="text-[#80848E] text-xs ml-1.5">Today at 12:00 PM</span>
            </div>
          </div>
          <p className="text-[#B5BAC1] text-sm mt-1 ml-10">This is a preview message.</p>
        </div>
      </div>
    </div>
  );
}

/* ===== Permissions Tab ===== */
function PermissionsTab({ editPerms, togglePerm, isOwner }: { editPerms: number; togglePerm: (p: number) => void; isOwner: boolean; isModerator?: boolean }) {
  // Owner: sees and can toggle all permissions. Moderator: only moderation and below (no Administrator / Manage Server / Manage Channels / Manage Roles).
  const ADMIN_ONLY_PERMS = new Set([
    Permissions.ADMINISTRATOR, Permissions.MANAGE_SERVER,
    Permissions.MANAGE_CHANNELS, Permissions.MANAGE_ROLES,
  ]);
  const canSeeAdminPerms = isOwner;
  const canToggleAdminPerm = isOwner;

  return (
    <div className="space-y-1 max-w-lg">
      {Object.entries(Permissions)
        .filter(([, value]) => canSeeAdminPerms || !ADMIN_ONLY_PERMS.has(value))
        .map(([key, value]) => {
          const isEnabled = (editPerms & value) !== 0;
          const isAdmin = value === Permissions.ADMINISTRATOR;
          const isDisabledForMod = (isAdmin || ADMIN_ONLY_PERMS.has(value)) && !canToggleAdminPerm;
          return (
            <div
              key={key}
              className={`rounded-lg p-3 transition-colors ${isAdmin && isEnabled ? 'bg-danger-500/10 border border-danger-500/30' : 'hover:bg-layer-3'} ${isDisabledForMod ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 mr-4">
                  <p className="text-[#B5BAC1] text-sm font-medium">{PERMISSION_LABELS[value]}</p>
                  <p className="text-[#80848E] text-xs mt-0.5">{PERMISSION_DESCRIPTIONS[value]}</p>
                  {isDisabledForMod && (
                    <p className="text-warning-400 text-xs mt-0.5 italic">Only the server owner can toggle this permission.</p>
                  )}
                </div>
                {/* Toggle switch */}
                <button
                  onClick={() => togglePerm(value)}
                  disabled={isDisabledForMod}
                  className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${isEnabled ? 'bg-online' : 'bg-layer-5'
                    } ${isDisabledForMod ? 'cursor-not-allowed' : ''}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${isEnabled ? 'left-5.5' : 'left-0.5'
                    }`} />
                </button>
              </div>
            </div>
          );
        })}
    </div>
  );
}

/* ===== Members Tab ===== */
function MembersTab({
  role, members, serverMembers, serverId, onRefreshServer,
}: {
  role: Role;
  members: { _id: string; displayName: string; avatar: string; status: string; username?: string }[];
  serverMembers: ServerMember[];
  serverId: string;
  onRefreshServer?: () => Promise<void>;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [assigning, setAssigning] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [searchResultsToAdd, setSearchResultsToAdd] = useState<typeof members>([]);
  const [searchingToAdd, setSearchingToAdd] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // System roles: members with this server role. Custom roles: members whose customRoleIds include this role.
  const membersWithRole = role.isSystemRole
    ? serverMembers
        .filter((sm) => sm.role === role.type || (role.type === 'member'))
        .map((sm) => members.find((m) => m._id === sm.userId))
        .filter(Boolean) as typeof members
    : serverMembers
        .filter((sm) => (sm.customRoleIds ?? []).includes(role._id))
        .map((sm) => members.find((m) => m._id === sm.userId))
        .filter(Boolean) as typeof members;

  const membersWithoutRole = role.isSystemRole
    ? serverMembers
        .filter((sm) => sm.role !== role.type)
        .map((sm) => members.find((m) => m._id === sm.userId))
        .filter(Boolean) as typeof members
    : serverMembers
        .filter((sm) => !(sm.customRoleIds ?? []).includes(role._id))
        .map((sm) => members.find((m) => m._id === sm.userId))
        .filter(Boolean) as typeof members;

  useEffect(() => {
    if (!showAddModal) return;
    if (!searchQuery.trim()) {
      setSearchResultsToAdd([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => {
      setSearchingToAdd(true);
      serverApi
        .getMembers(serverId, { search: searchQuery.trim(), limit: 100 })
        .then(({ members: m }) => {
          if (role.isSystemRole) {
            const withoutRole = m.filter((u) => !serverMembers.find((sm) => sm.userId === u._id) || serverMembers.find((sm) => sm.userId === u._id)?.role !== role.type);
            setSearchResultsToAdd(withoutRole);
          } else {
            const withoutCustomRole = m.filter((u) => !(serverMembers.find((sm) => sm.userId === u._id)?.customRoleIds ?? []).includes(role._id));
            setSearchResultsToAdd(withoutCustomRole);
          }
        })
        .catch(() => setSearchResultsToAdd([]))
        .finally(() => setSearchingToAdd(false));
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [showAddModal, searchQuery, serverId, role._id, role.isSystemRole, serverMembers]);

  const filteredToAdd = searchQuery.trim()
    ? searchResultsToAdd
    : membersWithoutRole;
  const DISPLAY_LIMIT = 100;
  const toDisplay = filteredToAdd.slice(0, DISPLAY_LIMIT);
  const hasMoreToAdd = filteredToAdd.length > DISPLAY_LIMIT;

  const handleAssign = async (memberId: string) => {
    if (!onRefreshServer) return;
    setAssigning(memberId);
    try {
      if (role.isSystemRole) {
        await roleApi.assignRole(serverId, memberId, role.type);
      } else {
        await roleApi.addCustomRoleToMember(serverId, memberId, role._id);
      }
      await onRefreshServer();
      setShowAddModal(false);
      toast.success('Member added to role');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to add member';
      toast.error(msg);
    } finally {
      setAssigning(null);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!onRefreshServer) return;
    if (role.isSystemRole && role.type === 'member') return;
    setRemoving(memberId);
    try {
      if (role.isSystemRole) {
        await roleApi.assignRole(serverId, memberId, 'member');
      } else {
        await roleApi.removeCustomRoleFromMember(serverId, memberId, role._id);
      }
      await onRefreshServer();
      toast.success('Member removed from role');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to remove member';
      toast.error(msg);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[#80848E] text-xs">
          {membersWithRole.length} member{membersWithRole.length !== 1 ? 's' : ''} with this role
        </p>
        {onRefreshServer && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary py-1.5 px-3 text-sm flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add Members
            </button>
          )}
      </div>

      <div className="space-y-0.5">
        {membersWithRole.map((m) => (
          <div
            key={m._id}
            className="flex items-center gap-3 px-3 py-2 rounded hover:bg-layer-3 transition-colors group"
          >
            <div className="w-8 h-8 rounded-full bg-accent-600 flex items-center justify-center shrink-0 overflow-hidden">
              {m.avatar ? (
                <img src={m.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-xs font-bold">{m.displayName?.charAt(0)?.toUpperCase() ?? '?'}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[#B5BAC1] text-sm block truncate">{m.displayName || m.username}</span>
              {m.username && <span className="text-[#5C5F66] text-2xs">@{m.username}</span>}
            </div>
            {onRefreshServer && ((role.isSystemRole && role.type !== 'member') || !role.isSystemRole) && (
              <button
                onClick={() => handleRemove(m._id)}
                disabled={removing === m._id}
                className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded flex items-center justify-center text-[#80848E] hover:text-danger-400 hover:bg-danger-500/10 transition-all cursor-pointer"
                title={role.isSystemRole ? 'Remove from role (set to Member)' : 'Remove this role from member'}
              >
                {removing === m._id ? (
                  <div className="w-3.5 h-3.5 border-2 border-danger-400/30 border-t-danger-400 rounded-full animate-spin" />
                ) : (
                  <X className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        ))}
        {membersWithRole.length === 0 && (
          <p className="text-[#5C5F66] text-sm text-center py-8">No members with this role</p>
        )}
      </div>

      {/* Add Members Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-layer-1 rounded-xl w-full max-w-md max-h-[70vh] flex flex-col overflow-hidden border border-layer-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-layer-4 shrink-0">
              <h3 className="text-white font-semibold">Add Members to {role.name}</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#80848E] hover:text-white cursor-pointer p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 border-b border-layer-4 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#80848E]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search members"
                  className="input w-full pl-9 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 min-h-0">
              {searchingToAdd ? (
                <p className="text-[#80848E] text-sm text-center py-8 flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-layer-5 border-t-[#80848E] rounded-full animate-spin" />
                  Searching...
                </p>
              ) : filteredToAdd.length === 0 ? (
                <p className="text-[#5C5F66] text-sm text-center py-8">
                  {searchQuery ? 'No members found' : 'All members already have this role'}
                </p>
              ) : (
                <div className="space-y-0.5">
                  {toDisplay.map((m) => (
                    <div
                      key={m._id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded hover:bg-layer-3 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-accent-600 flex items-center justify-center shrink-0 overflow-hidden">
                          {m.avatar ? (
                            <img src={m.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-white text-xs font-bold">{m.displayName?.charAt(0)?.toUpperCase() ?? '?'}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="text-[#B5BAC1] text-sm block truncate">{m.displayName || m.username}</span>
                          {m.username && <span className="text-[#5C5F66] text-2xs">@{m.username}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleAssign(m._id)}
                        disabled={assigning === m._id}
                        className="btn-primary py-1.5 px-3 text-sm shrink-0"
                      >
                        {assigning === m._id ? (
                          <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Adding...
                          </span>
                        ) : (
                          'Add'
                        )}
                      </button>
                    </div>
                  ))}
                  {hasMoreToAdd && (
                    <p className="text-[#80848E] text-xs text-center py-3">
                      +{filteredToAdd.length - DISPLAY_LIMIT} more — refine search to find
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== Bans Page ===== */
function BansPage({ bans, onUnban }: { bans: BanEntry[]; onUnban: (id: string) => void }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Gavel className="w-6 h-6 text-[#80848E]" />
          <div>
            <h2 className="text-white font-bold text-lg">Server Bans</h2>
            <p className="text-[#80848E] text-xs">{bans.length} banned user{bans.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {bans.length === 0 ? (
          <div className="text-center py-16">
            <Gavel className="w-12 h-12 text-[#5C5F66] mx-auto mb-3" />
            <p className="text-[#80848E] text-sm">No bans yet. Let's keep it that way!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {bans.map((ban) => (
              <div key={ban._id} className="flex items-center gap-3 bg-layer-1 rounded-lg p-4 hover:bg-layer-3 transition-colors group">
                <div className="w-10 h-10 rounded-full bg-danger-500/20 flex items-center justify-center shrink-0">
                  <span className="text-danger-400 font-bold text-sm">{ban.userId.displayName.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium text-sm">{ban.userId.displayName}</span>
                    <span className="text-[#5C5F66] text-xs">@{ban.userId.username}</span>
                  </div>
                  {ban.reason && <p className="text-[#80848E] text-xs mt-0.5 truncate">Reason: {ban.reason}</p>}
                </div>
                <button
                  onClick={() => onUnban(ban.userId._id)}
                  className="opacity-0 group-hover:opacity-100 bg-layer-4 hover:bg-layer-5 text-[#B5BAC1] text-xs font-medium px-3 py-1.5 rounded cursor-pointer transition-all"
                >
                  Revoke Ban
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== Audit Log Page ===== */
function AuditLogPage({
  logs, actionLabels, actionIcons, formatDate,
}: {
  logs: AuditLogEntry[];
  actionLabels: Record<string, string>;
  actionIcons: Record<string, string>;
  formatDate: (d: string) => string;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <ScrollText className="w-6 h-6 text-[#80848E]" />
          <div>
            <h2 className="text-white font-bold text-lg">Audit Log</h2>
            <p className="text-[#80848E] text-xs">A record of all moderation actions</p>
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-16">
            <ScrollText className="w-12 h-12 text-[#5C5F66] mx-auto mb-3" />
            <p className="text-[#80848E] text-sm">No audit logs yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => (
              <div key={log._id} className="bg-layer-1 rounded-lg p-4 hover:bg-layer-3 transition-colors">
                <div className="flex items-start gap-3">
                  <span className="text-lg mt-0.5">{actionIcons[log.action] || '📋'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="text-white font-medium">{log.moderatorId.displayName}</span>
                      <span className="text-[#80848E]"> {actionLabels[log.action] || log.action} </span>
                      <span className="text-white font-medium">{log.targetId.displayName}</span>
                    </p>
                    {log.reason && (
                      <p className="text-[#80848E] text-xs mt-1 bg-layer-0 inline-block px-2 py-0.5 rounded">
                        {log.reason}
                      </p>
                    )}
                    <p className="text-[#5C5F66] text-xs mt-1">{formatDate(log.createdAt)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
