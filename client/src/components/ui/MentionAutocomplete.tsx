import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { User } from '../../types';
import type { Role } from '../../types';

type MentionOption =
  | { type: 'member'; user: User }
  | { type: 'everyone' }
  | { type: 'here' }
  | { type: 'role'; role: Role };

const MAX_VISIBLE_MEMBERS = 50;
const MAX_VISIBLE_ROLES = 15;
const PANEL_MAX_HEIGHT = 320;

function getMentionQuery(value: string, cursorPos: number): { query: string; start: number } | null {
  const textBefore = value.slice(0, cursorPos);
  const atIndex = textBefore.lastIndexOf('@');
  if (atIndex === -1) return null;
  const spaceAfter = textBefore.indexOf(' ', atIndex);
  if (spaceAfter !== -1 && spaceAfter < cursorPos) return null;
  const query = textBefore.slice(atIndex + 1);
  return { query: query.toLowerCase(), start: atIndex };
}

function statusColor(status?: string): string {
  switch (status) {
    case 'online': return 'bg-online';
    case 'idle': return 'bg-idle';
    case 'dnd': return 'bg-dnd';
    default: return 'bg-[#80848E]';
  }
}

interface Props {
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
  members: User[];
  roles: Role[];
  currentUserId: string;
  onClose?: () => void;
}

export default function MentionAutocomplete({
  inputRef,
  value,
  onChange,
  members,
  roles,
  currentUserId,
  onClose,
}: Props) {
  const [options, setOptions] = useState<MentionOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const updateOptions = useCallback(() => {
    const el = inputRef.current;
    if (!el) return null;
    const parsed = getMentionQuery(value, el.selectionStart ?? value.length);
    if (!parsed) return null;
    const { query, start } = parsed;
    const q = query.trim();

    const result: MentionOption[] = [];

    if (q.length === 0 || 'everyone'.startsWith(q)) {
      result.push({ type: 'everyone' });
    }
    if (q.length === 0 || 'here'.startsWith(q)) {
      result.push({ type: 'here' });
    }

    const filteredMembers = members
      .filter(
        (m) =>
          m._id !== currentUserId &&
          (m.displayName?.toLowerCase().includes(q) || m.username?.toLowerCase().includes(q))
      )
      .slice(0, MAX_VISIBLE_MEMBERS);
    filteredMembers.forEach((user) => result.push({ type: 'member', user }));

    const filteredRoles = roles
      .filter(
        (r) => !r.isSystemRole && (r.name?.toLowerCase().includes(q) || r.name?.toLowerCase().startsWith(q))
      )
      .slice(0, MAX_VISIBLE_ROLES);
    filteredRoles.forEach((role) => result.push({ type: 'role', role }));

    return { options: result, start };
  }, [value, members, roles, currentUserId, inputRef]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const result = updateOptions();
    if (!result || result.options.length === 0) {
      setPosition(null);
      setOptions([]);
      return;
    }

    setOptions(result.options);
    setSelectedIndex(0);
    itemRefs.current = [];

    const container = el.parentElement;
    const rect = container ? container.getBoundingClientRect() : el.getBoundingClientRect();
    setPosition({
      top: rect.top - 8,
      left: rect.left,
      width: rect.width,
    });
  }, [value, updateOptions, inputRef]);

  useEffect(() => {
    if (!position || options.length === 0) return;
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIndex, position, options.length]);

  const handleSelect = useCallback((opt: MentionOption) => {
    const el = inputRef.current;
    if (!el) return;
    const parsed = getMentionQuery(value, el.selectionStart ?? value.length);
    if (!parsed) return;

    let insert = '';
    if (opt.type === 'member') {
      insert = `@${opt.user.username}`;
    } else if (opt.type === 'everyone') {
      insert = '@everyone';
    } else if (opt.type === 'here') {
      insert = '@here';
    } else if (opt.type === 'role') {
      insert = `@${opt.role.name}`;
    }

    const before = value.slice(0, parsed.start);
    const after = value.slice(el.selectionStart ?? value.length);
    const newValue = before + insert + ' ' + after;
    onChange(newValue);
    setPosition(null);
    onClose?.();
    requestAnimationFrame(() => {
      el.focus();
      const pos = parsed.start + insert.length + 1;
      el.setSelectionRange(pos, pos);
    });
  }, [value, onChange, onClose, inputRef]);

  useEffect(() => {
    if (!position || options.length === 0) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % options.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + options.length) % options.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelect(options[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setPosition(null);
        onClose?.();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [position, options, selectedIndex, handleSelect]);

  if (!position || options.length === 0) return null;

  const el = inputRef.current;
  const parsed = el ? getMentionQuery(value, el.selectionStart ?? value.length) : null;
  const headerLabel = parsed?.query
    ? `MEMBERS MATCHING @${parsed.query.toUpperCase()}`
    : 'MEMBERS & ROLES';

  const content = (
    <div
      ref={listRef}
      className="fixed z-[100] bg-layer-2 rounded-lg overflow-hidden flex flex-col border border-layer-5"
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        transform: 'translateY(-100%)',
        maxHeight: PANEL_MAX_HEIGHT,
      }}
    >
      <div className="px-3 py-2 shrink-0 border-b border-layer-4">
        <p className="text-[#80848E] text-2xs font-bold uppercase tracking-wider truncate">
          {headerLabel}
        </p>
      </div>
      <div className="overflow-y-auto flex-1 min-h-0 py-1" style={{ maxHeight: PANEL_MAX_HEIGHT - 44 }}>
        {options.map((opt, i) => (
          <button
            key={
              opt.type === 'member'
                ? opt.user._id
                : opt.type === 'role'
                  ? opt.role._id
                  : opt.type
            }
            ref={(el) => { itemRefs.current[i] = el; }}
            type="button"
            onClick={() => handleSelect(opt)}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left cursor-pointer transition-colors ${i === selectedIndex ? 'bg-layer-4' : 'hover:bg-layer-3'
              }`}
          >
            {opt.type === 'member' ? (
              <>
                <div className="relative w-8 h-8 rounded-full bg-accent-600 flex items-center justify-center shrink-0 overflow-hidden">
                  {opt.user.avatar ? (
                    <img src={opt.user.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-xs font-bold">
                      {opt.user.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                    </span>
                  )}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-layer-0 ${statusColor(opt.user.status)}`}
                  />
                </div>
                <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                  <span className="text-white text-sm font-medium truncate">
                    {opt.user.displayName || opt.user.username}
                  </span>
                  <span className="text-[#80848E] text-xs truncate shrink-0">
                    @{opt.user.username}
                  </span>
                </div>
              </>
            ) : opt.type === 'everyone' ? (
              <>
                <div className="w-8 h-8 rounded-full bg-accent-600 flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold">@</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-accent-400 text-sm font-medium">@everyone</p>
                  <p className="text-[#80848E] text-xs">Notify everyone who can view this channel.</p>
                </div>
              </>
            ) : opt.type === 'here' ? (
              <>
                <div className="w-8 h-8 rounded-full bg-accent-600 flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold">@</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-accent-400 text-sm font-medium">@here</p>
                  <p className="text-[#80848E] text-xs">Notify online members who can view this channel.</p>
                </div>
              </>
            ) : (
              <>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: opt.role.color + '33' }}
                >
                  <span className="text-xs font-bold" style={{ color: opt.role.color }}>
                    @
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: opt.role.color }}>
                    @{opt.role.name}
                  </p>
                  <p className="text-[#80848E] text-xs">Notify users with this role.</p>
                </div>
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
