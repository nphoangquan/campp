import { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, User as UserIcon, Smile, Lock, ImagePlus, Bell, Shield, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useServerStore } from '../../stores/useServerStore';
import { useNotifications, setDesktopNotificationsEnabled } from '../../hooks/useNotifications';
import { userApi } from '../../services/api/user.api';
import { messageApi } from '../../services/api/message.api';
import { authApi } from '../../services/api/auth.api';
import { toast } from 'sonner';
import type { User, FriendRequestLevel } from '../../types';

type Page = 'my-account' | 'profile' | 'notifications' | 'privacy';

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
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded text-sm cursor-pointer transition-colors ${
        active ? 'bg-layer-4 text-white' : 'text-[#80848E] hover:text-[#B5BAC1] hover:bg-layer-3'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

interface Props {
  onClose: () => void;
}

export default function UserSettings({ onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [page, setPage] = useState<Page>('my-account');

  if (!user) return null;

  return (
    <div className="fixed inset-0 bg-layer-0 z-50 flex">
      <div className="w-56 bg-layer-1 flex flex-col shrink-0">
        <div className="flex-1 overflow-y-auto pt-6 pb-4 px-2">
          <div className="px-3 mb-6">
            <h2 className="text-white font-bold text-base truncate">{user.displayName}</h2>
            <p className="text-[#80848E] text-xs mt-0.5">User Settings</p>
          </div>

          <NavSection title="">
            <NavItem icon={<UserIcon className="w-4 h-4" />} label="My Account" active={page === 'my-account'} onClick={() => setPage('my-account')} />
            <NavItem icon={<Smile className="w-4 h-4" />} label="Profile" active={page === 'profile'} onClick={() => setPage('profile')} />
            <NavItem icon={<Bell className="w-4 h-4" />} label="Notifications" active={page === 'notifications'} onClick={() => setPage('notifications')} />
            <NavItem icon={<Shield className="w-4 h-4" />} label="Privacy" active={page === 'privacy'} onClick={() => setPage('privacy')} />
          </NavSection>
        </div>

        <div className="px-2 pb-4">
          <div className="h-px bg-layer-4 mx-2 mb-3" />
          <button onClick={onClose} className="w-full flex items-center gap-2 px-3 py-2 rounded text-[#80848E] hover:text-[#B5BAC1] hover:bg-layer-3 transition-colors cursor-pointer text-sm">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden bg-layer-2 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full border-2 border-[#80848E] flex items-center justify-center text-[#80848E] hover:border-white hover:text-white transition-colors cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {page === 'my-account' ? (
          <MyAccountPage user={user} onUpdate={setUser} />
        ) : page === 'profile' ? (
          <ProfilePage user={user} onUpdate={setUser} />
        ) : page === 'notifications' ? (
          <NotificationsPage user={user} onUpdate={setUser} />
        ) : (
          <PrivacyPage user={user} onUpdate={setUser} />
        )}
      </div>
    </div>
  );
}

function MyAccountPage({ user, onUpdate }: { user: User; onUpdate: (u: User) => void }) {
  const updateMemberProfile = useServerStore((s) => s.updateMemberProfile);
  const [username, setUsername] = useState(user.username);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setUsername(user.username);
    setDisplayName(user.displayName);
    setAvatar(user.avatar || '');
  }, [user]);

  const hasProfileChanges = username !== user.username || displayName !== user.displayName || avatar !== (user.avatar || '');

  const handleSaveProfile = async () => {
    if (!hasProfileChanges) return;
    setSaving(true);
    try {
      const payload: { username?: string; displayName?: string; avatar?: string } = {};
      if (username !== user.username) payload.username = username;
      if (displayName !== user.displayName) payload.displayName = displayName;
      if (avatar !== (user.avatar || '')) payload.avatar = avatar;
      const { user: updated } = await userApi.updateProfile(payload);
      onUpdate(updated);
      updateMemberProfile(updated._id, { avatar: updated.avatar, displayName: updated.displayName });
      toast.success('Profile updated');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    const files = fileList ? Array.from(fileList) : [];
    e.target.value = '';
    if (!files.length) return;
    setUploadingAvatar(true);
    try {
      const { attachments } = await messageApi.uploadFiles(files);
      const img = attachments.find((a) => a.type === 'image');
      if (img) {
        setAvatar(img.url);
      } else {
        toast.error('Please upload an image');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Upload failed';
      toast.error(msg);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setSavingPassword(true);
    try {
      await userApi.updatePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update password';
      toast.error(msg);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl px-8 py-6">
        <h2 className="text-white font-bold text-xl mb-1">My Account</h2>
        <p className="text-[#B5BAC1] text-sm mb-6">
          Manage your account settings.
        </p>

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide mb-2">Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input w-full max-w-md"
              placeholder="Display name"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input w-full max-w-md"
              placeholder="Username"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide mb-2">Avatar</label>
            <p className="text-[#80848E] text-xs mb-2">We recommend an image of at least 128x128</p>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-layer-4 flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-layer-5">
                {avatar ? (
                  <img src={avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-accent-400">{displayName.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="flex gap-2">
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="btn-primary py-2 px-4 text-sm"
                >
                  {uploadingAvatar ? 'Uploading...' : 'Change Avatar'}
                </button>
                {avatar && (
                  <button
                    onClick={() => setAvatar('')}
                    className="btn-secondary py-2 px-4 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {hasProfileChanges && (
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="btn-primary py-2 px-6 text-sm"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>

        <div className="mt-10 pt-8 border-t border-layer-4">
          <h3 className="text-white font-bold text-lg mb-1 flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Change Password
          </h3>
          <p className="text-[#B5BAC1] text-sm mb-4">
            Enter your current password and choose a new one.
          </p>
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input w-full"
                placeholder="Current password"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input w-full"
                placeholder="New password"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input w-full"
                placeholder="Confirm new password"
              />
            </div>
            <button
              onClick={handleChangePassword}
              disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="btn-primary py-2 px-6 text-sm"
            >
              {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </div>

        <DeleteAccountSection />
      </div>
    </div>
  );
}

function DeleteAccountSection() {
  const logout = useAuthStore((s) => s.logout);
  const [step, setStep] = useState<'idle' | 'confirm' | 'otp'>('idle');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestDelete = async () => {
    setLoading(true);
    try {
      await authApi.requestDeleteAccount();
      toast.success('Verification code sent to your email');
      setStep('otp');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to send code';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (otpCode.length !== 6) { toast.error('Please enter 6-digit code'); return; }
    setLoading(true);
    try {
      await authApi.confirmDeleteAccount(otpCode);
      toast.success('Account deleted');
      logout();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to delete account';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-10 pt-8 border-t border-danger-500/30">
      <h3 className="text-danger-400 font-bold text-lg mb-1 flex items-center gap-2">
        <Trash2 className="w-4 h-4" />
        Delete Account
      </h3>
      <p className="text-[#B5BAC1] text-sm mb-4">
        Permanently delete your account and all associated data. This action cannot be undone.
      </p>

      {step === 'idle' && (
        <button
          onClick={() => setStep('confirm')}
          className="px-4 py-2 rounded text-sm font-medium bg-danger-500/10 text-danger-400 border border-danger-500/30 hover:bg-danger-500/20 cursor-pointer transition-colors"
        >
          Delete Account
        </button>
      )}

      {step === 'confirm' && (
        <div className="bg-danger-500/5 border border-danger-500/20 rounded-lg p-4 max-w-md">
          <p className="text-[#B5BAC1] text-sm mb-3">
            Are you sure? This will permanently delete your account, messages, and remove you from all servers.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleRequestDelete}
              disabled={loading}
              className="px-4 py-2 rounded text-sm font-medium bg-danger-500 text-white hover:bg-danger-400 cursor-pointer transition-colors"
            >
              {loading ? 'Sending code...' : 'Yes, send verification code'}
            </button>
            <button
              onClick={() => setStep('idle')}
              className="px-4 py-2 rounded text-sm font-medium text-[#B5BAC1] hover:text-white hover:bg-layer-4 cursor-pointer transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === 'otp' && (
        <div className="bg-danger-500/5 border border-danger-500/20 rounded-lg p-4 max-w-md">
          <p className="text-[#B5BAC1] text-sm mb-3">
            Enter the 6-digit verification code sent to your email to confirm deletion.
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="input w-full max-w-[200px] text-center text-lg font-semibold tracking-widest mb-3"
            placeholder="000000"
          />
          <div className="flex gap-2">
            <button
              onClick={handleConfirmDelete}
              disabled={loading || otpCode.length !== 6}
              className="px-4 py-2 rounded text-sm font-medium bg-danger-500 text-white hover:bg-danger-400 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {loading ? 'Deleting...' : 'Confirm Delete'}
            </button>
            <button
              onClick={() => { setStep('idle'); setOtpCode(''); }}
              className="px-4 py-2 rounded text-sm font-medium text-[#B5BAC1] hover:text-white hover:bg-layer-4 cursor-pointer transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const PROFILE_BANNER_COLORS = [
  '#1a1a21', '#121217', '#0c0c10', '#2a2a33', '#33333d',
  '#4F46E5', '#4348CA', '#6366F1', '#818CF8',
  '#3BA55D', '#FAA61A', '#ED4245',
  '#22B8CF', '#20C997', '#495057',
];

function ProfilePage({ user, onUpdate }: { user: User; onUpdate: (u: User) => void }) {
  const updateMemberProfile = useServerStore((s) => s.updateMemberProfile);
  const [activityStatus, setActivityStatus] = useState(user.activityStatus || '');
  const [banner, setBanner] = useState(user.banner || '');
  const [saving, setSaving] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setActivityStatus(user.activityStatus || '');
    setBanner(user.banner || '');
  }, [user]);

  const hasChanges = activityStatus !== (user.activityStatus || '') || banner !== (user.banner || '');

  const handleSave = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      const payload: { activityStatus?: string; banner?: string } = {};
      if (activityStatus !== (user.activityStatus || '')) payload.activityStatus = activityStatus;
      if (banner !== (user.banner || '')) payload.banner = banner;
      const { user: updated } = await userApi.updateProfile(payload);
      onUpdate(updated);
      updateMemberProfile(updated._id, { activityStatus: updated.activityStatus, banner: updated.banner });
      toast.success('Profile updated');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update';
      toast.error(msg);
    } finally {
      setSaving(false);
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

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl px-8 py-6">
        <h2 className="text-white font-bold text-xl mb-1">Profile</h2>
        <p className="text-[#B5BAC1] text-sm mb-6">
          Customize your profile with a banner and custom status.
        </p>

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide mb-2">Profile Banner</label>
            <p className="text-[#80848E] text-xs mb-2">Shown in your profile. Choose a color or upload an image.</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {PROFILE_BANNER_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setBanner(c)}
                  className={`w-8 h-8 rounded border-2 transition-all ${
                    banner === c ? 'border-white scale-110' : 'border-layer-5 hover:border-layer-6'
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
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide mb-2">Custom Status</label>
            <input
              type="text"
              value={activityStatus}
              onChange={(e) => setActivityStatus(e.target.value.slice(0, 128))}
              className="input w-full max-w-md"
              placeholder="What's on your mind?"
              maxLength={128}
            />
            <p className="text-[#80848E] text-xs mt-1">{activityStatus.length}/128</p>
          </div>

          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary py-2 px-6 text-sm"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PrivacyPage({ user, onUpdate }: { user: User; onUpdate: (u: User) => void }) {
  const allowDMs = user.allowDMs ?? true;
  const allowFriendRequests = user.allowFriendRequests ?? 'everyone';
  const [saving, setSaving] = useState(false);

  const handleSave = async (updates: { allowDMs?: boolean; allowFriendRequests?: 'everyone' | 'friends_of_friends' | 'none' }) => {
    setSaving(true);
    try {
      const { allowDMs: ad, allowFriendRequests: afr } = await userApi.updatePrivacySettings(updates);
      onUpdate({ ...user, allowDMs: ad, allowFriendRequests: afr as FriendRequestLevel });
      toast.success('Privacy settings updated');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <h2 className="text-white font-bold text-xl mb-1">Privacy</h2>
      <p className="text-[#B5BAC1] text-sm mb-8">
        Control who can message you and send you friend requests.
      </p>

      <div className="space-y-8 max-w-2xl">
        <div>
          <h3 className="text-white font-semibold text-base mb-2">Direct Messages</h3>
          <p className="text-[#B5BAC1] text-sm mb-3">
            Allow server members to send you direct messages.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSave({ allowDMs: true })}
              disabled={saving}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${allowDMs ? 'bg-accent-500 text-white' : 'bg-layer-3 text-[#B5BAC1] hover:bg-layer-4'}`}
            >
              On
            </button>
            <button
              onClick={() => handleSave({ allowDMs: false })}
              disabled={saving}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${!allowDMs ? 'bg-accent-500 text-white' : 'bg-layer-3 text-[#B5BAC1] hover:bg-layer-4'}`}
            >
              Off
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-white font-semibold text-base mb-2">Friend Requests</h3>
          <p className="text-[#B5BAC1] text-sm mb-4">
            Who can send you friend requests.
          </p>
          <div className="space-y-2 max-w-sm">
            {([
              { value: 'everyone', label: 'Everyone', desc: 'Anyone can send you a friend request' },
              { value: 'friends_of_friends', label: 'Friends of friends', desc: 'Only mutual connections' },
              { value: 'none', label: 'No one', desc: 'Block all incoming friend requests' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSave({ allowFriendRequests: opt.value })}
                disabled={saving}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left cursor-pointer ${
                  allowFriendRequests === opt.value
                    ? 'border-accent-500 bg-accent-500/10'
                    : 'border-layer-5 bg-layer-2 hover:bg-layer-3 hover:border-layer-6'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                  allowFriendRequests === opt.value ? 'border-accent-500' : 'border-[#80848E]'
                }`}>
                  {allowFriendRequests === opt.value && <div className="w-2 h-2 rounded-full bg-accent-500" />}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${allowFriendRequests === opt.value ? 'text-white' : 'text-[#B5BAC1]'}`}>
                    {opt.label}
                  </p>
                  <p className="text-2xs text-[#80848E]">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationsPage({ user, onUpdate }: { user: User; onUpdate: (u: User) => void }) {
  const { requestPermission, disableNotifications } = useNotifications();
  const servers = useServerStore((s) => s.servers);

  useEffect(() => {
    if (user.desktopNotifications === false) {
      setDesktopNotificationsEnabled(false);
    }
  }, [user.desktopNotifications]);
  const mutedIds = user.mutedServers ?? [];
  const mutedServers = servers.filter((s) => mutedIds.includes(s._id));
  const [savingNotif, setSavingNotif] = useState(false);
  const [savingSound, setSavingSound] = useState(false);

  const desktopEnabled = user.desktopNotifications ?? true;
  const notificationSound = user.notificationSound ?? true;
  const isActive = typeof window !== 'undefined' && 'Notification' in window
    ? Notification.permission === 'granted' && desktopEnabled
    : false;
  const isDenied = typeof window !== 'undefined' && 'Notification' in window
    ? Notification.permission === 'denied'
    : false;

  const handleToggleMute = async (serverId: string) => {
    try {
      const { mutedServers: next } = await userApi.toggleMuteServer(serverId);
      onUpdate({ ...user, mutedServers: next });
      toast.success(next.includes(serverId) ? 'Server muted' : 'Server unmuted');
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleEnableNotifications = async () => {
    const ok = await requestPermission();
    if (!ok) {
      toast.error('Could not enable notifications');
      return;
    }
    setSavingNotif(true);
    try {
      await userApi.updateNotificationSettings({ desktopNotifications: true });
      setDesktopNotificationsEnabled(true);
      onUpdate({ ...user, desktopNotifications: true });
      toast.success('Notifications enabled');
    } catch {
      toast.error('Failed to update');
    } finally {
      setSavingNotif(false);
    }
  };

  const handleDisableNotifications = async () => {
    setSavingNotif(true);
    try {
      await userApi.updateNotificationSettings({ desktopNotifications: false });
      setDesktopNotificationsEnabled(false);
      disableNotifications();
      onUpdate({ ...user, desktopNotifications: false });
      toast.success('Notifications disabled');
    } catch {
      toast.error('Failed to update');
    } finally {
      setSavingNotif(false);
    }
  };

  const handleSetNotificationSound = async (value: boolean) => {
    if (notificationSound === value) return;
    setSavingSound(true);
    try {
      await userApi.updateNotificationSettings({ notificationSound: value });
      onUpdate({ ...user, notificationSound: value });
      toast.success(value ? 'Notification sound enabled' : 'Notification sound disabled');
    } catch {
      toast.error('Failed to update');
    } finally {
      setSavingSound(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <h2 className="text-white font-bold text-xl mb-1">Notifications</h2>
      <p className="text-[#B5BAC1] text-sm mb-8">
        Control how you receive notifications for @mentions and @everyone.
      </p>

      <div className="space-y-8 max-w-2xl">
        <div>
          <h3 className="text-white font-semibold text-base mb-2">Notification Sound</h3>
          <p className="text-[#B5BAC1] text-sm mb-3">
            Play a sound when you receive a mention or @everyone while the app is in focus.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSetNotificationSound(true)}
              disabled={savingSound}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${notificationSound ? 'bg-accent-500 text-white' : 'bg-layer-3 text-[#B5BAC1] hover:bg-layer-4'}`}
            >
              On
            </button>
            <button
              onClick={() => handleSetNotificationSound(false)}
              disabled={savingSound}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${!notificationSound ? 'bg-accent-500 text-white' : 'bg-layer-3 text-[#B5BAC1] hover:bg-layer-4'}`}
            >
              Off
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-white font-semibold text-base mb-2">Desktop Notifications</h3>
          <p className="text-[#B5BAC1] text-sm mb-3">
            Get notified when you are mentioned or when someone uses @everyone, even when the app is in the background.
          </p>
          {isDenied ? (
            <p className="text-[#80848E] text-sm">
              Notifications are blocked by your browser. Enable them in your browser settings to use this feature.
            </p>
          ) : isActive ? (
            <button
              onClick={handleDisableNotifications}
              disabled={savingNotif}
              className="btn-secondary py-2 px-6 text-sm"
            >
              Disable Notifications
            </button>
          ) : (
            <button
              onClick={handleEnableNotifications}
              disabled={savingNotif}
              className="btn-primary py-2 px-6 text-sm"
            >
              Enable Notifications
            </button>
          )}
        </div>

        <div>
          <h3 className="text-white font-semibold text-base mb-2">Muted Servers</h3>
          <p className="text-[#B5BAC1] text-sm mb-4">
            Muted servers will not send you notifications for @mentions or @everyone.
          </p>
          {mutedServers.length === 0 ? (
            <p className="text-[#80848E] text-sm">No servers muted.</p>
          ) : (
            <div className="space-y-2">
              {mutedServers.map((s) => (
                <div
                  key={s._id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-layer-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-layer-4 flex items-center justify-center overflow-hidden">
                      {s.icon ? (
                        <img src={s.icon} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-sm font-bold">{s.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <span className="text-white font-medium">{s.name}</span>
                  </div>
                  <button
                    onClick={() => handleToggleMute(s._id)}
                    className="text-accent-400 hover:text-accent-300 text-sm font-medium"
                  >
                    Unmute
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
