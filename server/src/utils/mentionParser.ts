/**
 * Parse @username, @everyone, @here, @role from message content.
 */
export function parseMentions(content: string): {
  usernames: string[];
  roleNames: string[];
  hasEveryone: boolean;
  hasHere: boolean;
} {
  const usernames: string[] = [];
  const roleNames: string[] = [];
  const seenUser = new Set<string>();
  const seenRole = new Set<string>();

  const mentionRegex = /@([a-zA-Z0-9_][a-zA-Z0-9_\s]*?)(?=\s|$|@|,|\.|!|\?|\)|])/g;
  let m: RegExpExecArray | null;
  while ((m = mentionRegex.exec(content)) !== null) {
    const raw = m[1].trim();
    const lower = raw.toLowerCase();
    if (lower === 'everyone' || lower === 'here') continue;
    if (/^[a-zA-Z0-9_]+$/.test(raw) && raw.length <= 32) {
      if (!seenUser.has(lower)) {
        seenUser.add(lower);
        usernames.push(raw);
      }
    } else if (raw.length > 0 && raw.length <= 100) {
      if (!seenRole.has(lower)) {
        seenRole.add(lower);
        roleNames.push(raw);
      }
    }
  }

  const hasEveryone = /\@everyone\b/i.test(content);
  const hasHere = /\@here\b/i.test(content);
  return { usernames, roleNames, hasEveryone, hasHere };
}
