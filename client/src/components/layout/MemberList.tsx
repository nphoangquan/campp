import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { VariableSizeList as List } from 'react-window';
import { MoreVertical, X, Crown, Search, Shield } from 'lucide-react';
import UserProfilePopup from '../ui/UserProfilePopup';
import { useServerStore } from '../../stores/useServerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { roleApi, moderationApi } from '../../services/api/moderation.api';
import { serverApi } from '../../services/api/server.api';
import { toast } from 'sonner';
import type { Role, User } from '../../types';

interface Props {
  onOpenDM?: (conversationId: string) => void;
  onClose?: () => void;
  showCloseButton?: boolean;
}

export default function MemberList({ onOpenDM, onClose, showCloseButton }: Props) {
  const { members, currentServer } = useServerStore();
  const user = useAuthStore((s) => s.user);
  const [menuMemberId, setMenuMemberId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [showReasonModal, setShowReasonModal] = useState<{ action: string; memberId: string; memberName: string } | null>(null);
  const [reason, setReason] = useState('');
  const [muteDuration, setMuteDuration] = useState(5);
  const [roles, setRoles] = useState<Role[]>([]);
  const [profilePopup, setProfilePopup] = useState<{ user: User; position: { x: number; y: number }; isServerOwner?: boolean } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const menuRef = useRef<HTMLDivElement>(null);
  const [showRoleSubmenu, setShowRoleSubmenu] = useState(false);
  const [assigningRole, setAssigningRole] = useState<string | null>(null);

  const isOwner = currentServer?.ownerId === user?._id;

  // Check if user has moderator-level access
  const getUserRole = () => {
    if (!currentServer || !user) return 'member';
    const sm = currentServer.members.find((m) => m.userId === user._id);
    return sm?.role || 'member';
  };
  const userRole = getUserRole();
  const canManageMembers = isOwner || userRole === 'admin' || userRole === 'moderator';

  useEffect(() => {
    if (!currentServer || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => {
      setSearching(true);
      serverApi
        .getMembers(currentServer._id, { search: searchQuery.trim(), limit: 100 })
        .then(({ members }) => setSearchResults(members))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [currentServer?._id, searchQuery]);

  useEffect(() => {
    if (!currentServer) return;
    roleApi.getRoles(currentServer._id).then(({ roles: r }) => setRoles(r)).catch(() => { });
  }, [currentServer?._id]);

  // Refetch roles when opening member menu so custom roles (created by admin/moderator) are included
  useEffect(() => {
    if (!menuMemberId || !currentServer) return;
    roleApi.getRoles(currentServer._id).then(({ roles: r }) => setRoles(r)).catch(() => {});
  }, [menuMemberId, currentServer?._id]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuMemberId(null);
        setShowRoleSubmenu(false);
      }
    };
    if (menuMemberId) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuMemberId]);

  const statusColor: Record<string, string> = {
    online: 'bg-online',
    idle: 'bg-idle',
    dnd: 'bg-dnd',
    offline: 'bg-[#80848E]',
    invisible: 'bg-[#80848E]',
  };

  const getMemberHighestRole = (memberId: string): Role | null => {
    if (!currentServer) return null;
    const serverMember = currentServer.members.find((m) => m.userId === memberId);
    if (!serverMember) return null;
    const memberRole = roles.find((r) => r.type === serverMember.role);
    return memberRole || null;
  };

  const getMemberCurrentRole = (memberId: string): string => {
    if (!currentServer) return 'member';
    const serverMember = currentServer.members.find((m) => m.userId === memberId);
    return serverMember?.role || 'member';
  };

  const groupMembersByRole = () => {
    const online = members.filter((m) => m.status !== 'offline');
    const offline = members.filter((m) => m.status === 'offline');

    const roleGroups: { role: Role | null; label: string; members: typeof members }[] = [];
    const assignedOnline = new Set<string>();

    const sortedRoles = [...roles].filter((r) => r.type !== 'member').sort((a, b) => b.position - a.position);

    for (const role of sortedRoles) {
      const roleMembers = online.filter((m) => {
        if (assignedOnline.has(m._id)) return false;
        const highest = getMemberHighestRole(m._id);
        return highest?._id === role._id;
      });
      if (roleMembers.length > 0) {
        roleMembers.forEach((m) => assignedOnline.add(m._id));
        roleGroups.push({ role, label: role.name, members: roleMembers });
      }
    }

    const unassignedOnline = online.filter((m) => !assignedOnline.has(m._id));
    if (unassignedOnline.length > 0) {
      roleGroups.push({ role: null, label: 'Online', members: unassignedOnline });
    }

    if (offline.length > 0) {
      roleGroups.push({ role: null, label: 'Offline', members: offline });
    }

    return roleGroups;
  };

  const handleAction = async () => {
    if (!showReasonModal || !currentServer) return;
    const { action, memberId } = showReasonModal;
    try {
      if (action === 'kick') {
        await moderationApi.kick(currentServer._id, memberId, reason);
        toast.success('Member kicked');
      } else if (action === 'ban') {
        await moderationApi.ban(currentServer._id, memberId, reason);
        toast.success('Member banned');
      } else if (action === 'mute') {
        await moderationApi.mute(currentServer._id, memberId, muteDuration, reason);
        toast.success('Member muted');
      }
    } catch {
      toast.error(`Failed to ${action} member`);
    }
    setShowReasonModal(null);
    setReason('');
    setMenuMemberId(null);
  };

  const handleUnmute = async (memberId: string) => {
    if (!currentServer) return;
    try {
      await moderationApi.unmute(currentServer._id, memberId);
      toast.success('Member unmuted');
    } catch {
      toast.error('Failed to unmute');
    }
    setMenuMemberId(null);
  };

  const handleAssignRole = async (memberId: string, role: Role) => {
    if (!currentServer) return;
    setAssigningRole(role._id);
    try {
      await roleApi.assignRole(currentServer._id, memberId, role.type);
      const { server } = await serverApi.getServer(currentServer._id);
      useServerStore.getState().updateServer(server);
      toast.success(`Role "${role.name}" assigned`);
    } catch {
      toast.error('Failed to assign role');
    } finally {
      setAssigningRole(null);
      setShowRoleSubmenu(false);
      setMenuMemberId(null);
    }
  };

  const handleToggleCustomRole = async (memberId: string, role: Role) => {
    if (!currentServer) return;
    const serverMember = currentServer.members.find((m) => m.userId === memberId);
    const hasRole = (serverMember?.customRoleIds ?? []).includes(role._id);
    setAssigningRole(role._id);
    try {
      if (hasRole) {
        await roleApi.removeCustomRoleFromMember(currentServer._id, memberId, role._id);
        toast.success(`"${role.name}" removed`);
      } else {
        await roleApi.addCustomRoleToMember(currentServer._id, memberId, role._id);
        toast.success(`"${role.name}" assigned`);
      }
      const { server } = await serverApi.getServer(currentServer._id);
      useServerStore.getState().updateServer(server);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update role';
      toast.error(msg);
    } finally {
      setAssigningRole(null);
    }
  };

  const groups = groupMembersByRole();

  type FlatItem = { type: 'header'; label: string; count: number } | { type: 'member'; member: User };
  const flatItems: FlatItem[] = searchQuery.trim()
    ? searchResults.map((m) => ({ type: 'member' as const, member: m }))
    : groups.flatMap((g) => [
      { type: 'header' as const, label: g.label, count: g.members.length },
      ...g.members.map((m) => ({ type: 'member' as const, member: m })),
    ]);
  const useVirtualList = flatItems.length > 50;
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(400);
  useEffect(() => {
    const el = listContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setListHeight(el.clientHeight));
    ro.observe(el);
    setListHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);
  const HEADER_HEIGHT = 32;
  const MEMBER_HEIGHT = 44;

  const getItemSize = useCallback(
    (index: number) => (flatItems[index].type === 'header' ? HEADER_HEIGHT : MEMBER_HEIGHT),
    [flatItems]
  );

  const renderMember = (member: typeof members[0]) => {
    const isSelf = member._id === user?._id;
    const effectiveMember = isSelf && user ? { ...member, avatar: user.avatar, banner: user.banner, displayName: user.displayName, activityStatus: user.activityStatus } : member;
    const isServerOwner = member._id === currentServer?.ownerId;
    const highestRole = getMemberHighestRole(member._id);
    const nameColor = highestRole?.color || (member.status === 'offline' ? '#5C5F66' : '#B5BAC1');

    return (
      <div
        key={member._id}
        className="flex items-center gap-2.5 px-2 py-1.5 mx-1 rounded hover:bg-layer-3/50 transition-colors group/member relative cursor-default"
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setProfilePopup({ user: effectiveMember, position: { x: e.clientX, y: e.clientY }, isServerOwner: isServerOwner });
          }}
          className="relative shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <div className="w-8 h-8 rounded-full bg-accent-600 flex items-center justify-center overflow-hidden">
            {effectiveMember.avatar ? (
              <img src={effectiveMember.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-xs font-semibold">
                {effectiveMember.displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${statusColor[member.status] || statusColor.offline} border-[2.5px] border-layer-1 rounded-full`} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setProfilePopup({ user: effectiveMember, position: { x: e.clientX, y: e.clientY }, isServerOwner: isServerOwner });
              }}
              className="text-sm truncate font-medium text-left hover:underline cursor-pointer"
              style={{ color: nameColor }}
            >
              {effectiveMember.displayName}
            </button>
            {isServerOwner && <Crown className="w-3.5 h-3.5 text-idle shrink-0" />}
          </div>
          {effectiveMember.activityStatus && (
            <p className="text-[#80848E] text-2xs truncate">{effectiveMember.activityStatus}</p>
          )}
        </div>

        {canManageMembers && !isSelf && !isServerOwner && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              if (menuMemberId === member._id) {
                setMenuMemberId(null);
                setMenuPosition(null);
                setShowRoleSubmenu(false);
              } else {
                setMenuMemberId(member._id);
                setMenuPosition({ x: rect.right, y: rect.top });
                setShowRoleSubmenu(false);
              }
            }}
            className="opacity-0 group-hover/member:opacity-100 text-[#80848E] hover:text-white cursor-pointer transition-all p-0.5 rounded hover:bg-layer-4"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  };

  // Render the member action menu via Portal so it's not clipped
  const renderMemberMenu = () => {
    if (!menuMemberId || !menuPosition) return null;
    const member = members.find((m) => m._id === menuMemberId);
    if (!member) return null;
    const memberCurrentRole = getMemberCurrentRole(menuMemberId);

    // Server roles (Admin, Moderator) assignable here; Member is default.
    const assignableServerRoles = roles.filter((r) => {
      if (!r.isSystemRole) return false;
      if (r.type === 'member') return false;
      if (!isOwner && r.type === 'admin') return false;
      return true;
    });
    // Custom roles (created by admin/moderator) — show so they can be assigned
    const customRoles = roles.filter((r) => !r.isSystemRole);
    const serverMember = currentServer?.members.find((m) => String(m.userId) === String(menuMemberId));
    const memberCustomRoleIds = serverMember?.customRoleIds ?? [];

    return createPortal(
      <div
        ref={menuRef}
        className="fixed z-[100] bg-layer-1 rounded-lg shadow-2xl py-1.5 w-48 animate-in fade-in slide-in-from-top-1 duration-100 border border-layer-5"
        style={{
          left: Math.min(menuPosition.x + 4, window.innerWidth - 200),
          top: Math.min(menuPosition.y, window.innerHeight - 320),
        }}
      >
        <div className="px-3 py-1.5 border-b border-layer-5 mb-1">
          <p className="text-white text-xs font-semibold truncate">{member.displayName}</p>
          <p className="text-[#5C5F66] text-2xs capitalize">Current role: {memberCurrentRole}</p>
        </div>

        {/* Manage Roles submenu — opens below so it stays on screen (member list is on the right) */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowRoleSubmenu(!showRoleSubmenu);
            }}
            className="w-full text-left px-3 py-1.5 text-sm text-[#B5BAC1] hover:bg-accent-500 hover:text-white cursor-pointer transition-colors rounded-sm flex items-center gap-2"
          >
            <Shield className="w-3.5 h-3.5" />
            Manage Roles
          </button>
          {showRoleSubmenu && (
            <div className="absolute left-0 top-full mt-0.5 bg-layer-1 rounded-lg shadow-2xl py-1.5 w-52 border border-layer-5 z-[101] max-h-64 overflow-y-auto">
              <p className="px-3 py-1 text-[#80848E] text-2xs font-bold uppercase">Assign server role</p>
              {assignableServerRoles.length === 0 ? (
                <p className="px-3 py-2 text-[#5C5F66] text-2xs">No server roles to assign</p>
              ) : (
                assignableServerRoles.map((role) => {
                  const isCurrentRole = memberCurrentRole === role.type;
                  return (
                    <button
                      key={role._id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAssignRole(menuMemberId, role);
                      }}
                      disabled={assigningRole === role._id || isCurrentRole}
                      className={`w-full text-left px-3 py-1.5 text-sm cursor-pointer transition-colors rounded-sm flex items-center gap-2 ${isCurrentRole ? 'text-accent-400 bg-accent-500/10' : 'text-[#B5BAC1] hover:bg-accent-500 hover:text-white'} disabled:opacity-50`}
                    >
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: role.color }} />
                      {role.name}
                      {isCurrentRole && <span className="text-2xs ml-auto">✓</span>}
                    </button>
                  );
                })
              )}
              {customRoles.length > 0 && (
                <>
                  <p className="px-3 py-1.5 pt-2 text-[#80848E] text-2xs font-bold uppercase border-t border-layer-5 mt-1">Custom roles</p>
                  {customRoles.map((role) => {
                    const hasCustomRole = memberCustomRoleIds.includes(role._id);
                    return (
                      <button
                        key={role._id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleCustomRole(menuMemberId, role);
                        }}
                        disabled={assigningRole === role._id}
                        className={`w-full text-left px-3 py-1.5 text-sm cursor-pointer transition-colors rounded-sm flex items-center gap-2 ${hasCustomRole ? 'text-accent-400 bg-accent-500/10' : 'text-[#B5BAC1] hover:bg-accent-500 hover:text-white'} disabled:opacity-50`}
                      >
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: role.color }} />
                        {role.name}
                        {hasCustomRole && <span className="text-2xs ml-auto">✓</span>}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => { setShowReasonModal({ action: 'mute', memberId: member._id, memberName: member.displayName }); }}
          className="w-full text-left px-3 py-1.5 text-sm text-[#B5BAC1] hover:bg-accent-500 hover:text-white cursor-pointer transition-colors rounded-sm mx-0"
        >
          Mute
        </button>
        <button
          onClick={() => handleUnmute(member._id)}
          className="w-full text-left px-3 py-1.5 text-sm text-[#B5BAC1] hover:bg-accent-500 hover:text-white cursor-pointer transition-colors rounded-sm"
        >
          Unmute
        </button>
        <div className="h-px bg-layer-5 my-1 mx-2" />
        <button
          onClick={() => { setShowReasonModal({ action: 'kick', memberId: member._id, memberName: member.displayName }); }}
          className="w-full text-left px-3 py-1.5 text-sm text-danger-400 hover:bg-danger-500 hover:text-white cursor-pointer transition-colors rounded-sm"
        >
          Kick
        </button>
        <button
          onClick={() => { setShowReasonModal({ action: 'ban', memberId: member._id, memberName: member.displayName }); }}
          className="w-full text-left px-3 py-1.5 text-sm text-danger-400 hover:bg-danger-500 hover:text-white cursor-pointer transition-colors rounded-sm"
        >
          Ban
        </button>
      </div>,
      document.body
    );
  };

  const Row = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const item = flatItems[index];
      if (!item) return null;
      if (item.type === 'header') {
        return (
          <div style={style} className="px-3 pt-1 pb-0.5">
            <h3 className="text-[#80848E] text-2xs font-bold uppercase tracking-wider">
              {item.label} &mdash; {item.count}
            </h3>
          </div>
        );
      }
      return (
        <div style={style} className="px-1">
          {renderMember(item.member)}
        </div>
      );
    },
    [flatItems, renderMember]
  );

  return (
    <>
      <div className="w-60 shrink-0 bg-layer-1 flex flex-col h-full">
        {showCloseButton && onClose && (
          <div className="h-12 px-2 flex items-center border-b border-layer-3 shrink-0">
            <button
              onClick={onClose}
              className="p-2 rounded text-[#80848E] hover:text-white hover:bg-layer-4 transition-colors"
              aria-label="Close member list"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="text-white font-semibold text-sm">Members</span>
          </div>
        )}
        <div className="px-2 pt-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#80848E]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members"
              className="w-full bg-layer-0 text-[#B5BAC1] text-sm pl-8 pr-2 py-1.5 rounded border border-layer-5 focus:outline-none focus:border-accent-500 placeholder-[#5C5F66]"
            />
          </div>
        </div>
        <div ref={listContainerRef} className="flex-1 overflow-hidden min-h-0">
          {searchQuery.trim() ? (
            searching ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin" />
              </div>
            ) : useVirtualList ? (
              <List
                height={Math.max(listHeight, 200)}
                itemCount={flatItems.length}
                itemSize={getItemSize}
                width="100%"
                overscanCount={10}
              >
                {Row}
              </List>
            ) : (
              <div className="overflow-y-auto py-1">
                {flatItems.length === 0 ? (
                  <p className="text-[#5C5F66] text-sm text-center py-6">No members found</p>
                ) : (
                  flatItems.map((item, i) =>
                    item.type === 'header' ? (
                      <div key={`h-${i}`} className="pt-4 px-1">
                        <h3 className="text-[#80848E] text-2xs font-bold uppercase tracking-wider px-3 mb-1">
                          {item.label} &mdash; {item.count}
                        </h3>
                      </div>
                    ) : (
                      <div key={item.member._id} className="px-1">
                        {renderMember(item.member)}
                      </div>
                    )
                  )
                )}
              </div>
            )
          ) : useVirtualList ? (
            <List
              height={Math.max(listHeight, 200)}
              itemCount={flatItems.length}
              itemSize={getItemSize}
              width="100%"
              overscanCount={10}
            >
              {Row}
            </List>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {groups.map((group, gi) => (
                <div key={gi} className="pt-4 px-1">
                  <h3 className="text-[#80848E] text-2xs font-bold uppercase tracking-wider px-3 mb-1">
                    {group.label} &mdash; {group.members.length}
                  </h3>
                  {group.members.map(renderMember)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Member action menu - rendered via Portal */}
      {renderMemberMenu()}

      {/* User profile popup */}
      {profilePopup && (
        <UserProfilePopup
          user={profilePopup.user}
          position={profilePopup.position}
          onClose={() => setProfilePopup(null)}
          onOpenDM={onOpenDM}
          isServerOwner={profilePopup.isServerOwner}
        />
      )}

      {/* Moderation modal */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowReasonModal(null)}>
          <div className="bg-layer-1 rounded-xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-white font-bold text-lg capitalize">{showReasonModal.action} Member</h3>
                <button onClick={() => setShowReasonModal(null)} className="text-[#80848E] hover:text-white cursor-pointer p-1 rounded hover:bg-layer-4 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-[#80848E] text-sm mb-5">
                {showReasonModal.action === 'kick'
                  ? `${showReasonModal.memberName} will be removed from the server but can rejoin with an invite.`
                  : showReasonModal.action === 'ban'
                    ? `${showReasonModal.memberName} will be permanently removed and cannot rejoin.`
                    : `${showReasonModal.memberName} will be temporarily unable to send messages.`}
              </p>

              {showReasonModal.action === 'mute' && (
                <div className="mb-4">
                  <label className="block text-xs font-bold text-[#B5BAC1] uppercase tracking-wider mb-2">Duration</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 1, label: '1 min' },
                      { value: 5, label: '5 min' },
                      { value: 10, label: '10 min' },
                      { value: 60, label: '1 hour' },
                      { value: 1440, label: '1 day' },
                      { value: 10080, label: '1 week' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setMuteDuration(opt.value)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${muteDuration === opt.value
                          ? 'bg-accent-500 text-white'
                          : 'bg-layer-3 text-[#B5BAC1] hover:bg-layer-4'
                          }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-2">
                <label className="block text-xs font-bold text-[#B5BAC1] uppercase tracking-wider mb-2">Reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="input text-sm resize-none h-20"
                  placeholder="Enter a reason (optional)..."
                />
              </div>
            </div>

            <div className="bg-layer-0 px-6 py-4 flex gap-3 justify-end">
              <button onClick={() => setShowReasonModal(null)} className="text-sm text-[#B5BAC1] hover:text-white hover:underline cursor-pointer px-4 py-2 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleAction}
                className={`text-sm font-medium px-6 py-2 rounded cursor-pointer transition-colors ${showReasonModal.action === 'ban'
                  ? 'bg-danger-500 text-white hover:bg-danger-400'
                  : showReasonModal.action === 'kick'
                    ? 'bg-warning-500 text-white hover:brightness-110'
                    : 'bg-accent-500 text-white hover:bg-accent-400'
                  }`}
              >
                {showReasonModal.action === 'kick' ? 'Kick' : showReasonModal.action === 'ban' ? 'Ban' : 'Mute'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
