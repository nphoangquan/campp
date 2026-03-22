import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Paperclip, X, FileText, Menu, Check, CheckCheck } from 'lucide-react';
import InboxButton from '../ui/InboxButton';
import { useDMStore } from '../../stores/useDMStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { dmApi } from '../../services/api/dm.api';
import { messageApi } from '../../services/api/message.api';
import { getSocket } from '../../services/socket/socketService';
import { formatDistanceToNowStrict } from 'date-fns';
import { toast } from 'sonner';
import type { DirectMessage, Attachment } from '../../types';
import MarkdownContent from '../ui/MarkdownContent';
import LinkPreview from '../ui/LinkPreview';
import { extractUrls } from '../../utils/extractUrls';

interface Props {
  conversationId: string;
  onOpenDMSidebar?: () => void;
  showMenuButton?: boolean;
}

export default function DMChat({ conversationId, onOpenDMSidebar, showMenuButton }: Props) {
  const { messages, setMessages, addMessage, setHasMore, setLoading, clearMessages, currentConversation, updateConversationLastMessage } = useDMStore();
  const user = useAuthStore((s) => s.user);
  const [input, setInput] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const otherUser = currentConversation?.participants.find((p) => p._id !== user?._id);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    clearMessages();
    try {
      const { messages: msgs } = await dmApi.getMessages(conversationId);
      setMessages(msgs);
      setHasMore(msgs.length >= 50);
    } catch (error) {
      console.error('Failed to load DMs:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, setMessages, setHasMore, setLoading, clearMessages]);

  useEffect(() => {
    loadMessages();
    const socket = getSocket();
    if (socket) {
      socket.emit('joinDM', conversationId);
      // Mark messages as read when entering the conversation
      socket.emit('markDMRead', conversationId);
    }
    return () => {
      if (socket) socket.emit('leaveDM', conversationId);
    };
  }, [conversationId, loadMessages]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleDM = (message: DirectMessage) => {
      if (message.conversationId === conversationId) {
        addMessage(message);
        updateConversationLastMessage(conversationId, message);
        // Auto-mark as read if the message is from the other user
        if (message.authorId._id !== user?._id) {
          socket.emit('markDMRead', conversationId);
        }
      }
    };

    const handleDMRead = (data: { conversationId: string; userId: string }) => {
      if (data.conversationId === conversationId) {
        // Update readBy in local messages 
        useDMStore.setState((s) => ({
          messages: s.messages.map((m) => {
            if (m.authorId._id === user?._id && !(m.readBy || []).includes(data.userId)) {
              return { ...m, readBy: [...(m.readBy || []), data.userId] };
            }
            return m;
          }),
        }));
      }
    };

    socket.on('dmReceived', handleDM);
    socket.on('dmRead', handleDMRead);
    return () => {
      socket.off('dmReceived', handleDM);
      socket.off('dmRead', handleDMRead);
    };
  }, [conversationId, addMessage, updateConversationLastMessage, user?._id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content && pendingAttachments.length === 0) return;

    const socket = getSocket();
    if (socket) {
      socket.emit('sendDM', {
        conversationId,
        content: content || '',
        attachments: pendingAttachments.length > 0 ? pendingAttachments : undefined,
      }, (res: { success?: boolean; error?: string }) => {
        if (!res?.success && res?.error) toast.error(res.error);
      });
    }

    setInput('');
    setPendingAttachments([]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const { attachments } = await messageApi.uploadFiles(Array.from(files));
      setPendingAttachments((prev) => [...prev, ...attachments]);
    } catch {
      console.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePendingAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const shouldShowHeader = (msg: DirectMessage, i: number) => {
    if (i === 0) return true;
    const prev = messages[i - 1];
    if (prev.authorId._id !== msg.authorId._id) return true;
    return new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60 * 1000;
  };

  return (
    <div className="flex-1 flex flex-col bg-layer-2 overflow-hidden">
      {/* Header */}
      <div className="h-12 px-4 flex items-center gap-3 border-b border-layer-4 shrink-0">
        {showMenuButton && onOpenDMSidebar && (
          <button
            onClick={onOpenDMSidebar}
            className="p-1.5 rounded text-[#80848E] hover:text-white hover:bg-layer-4 transition-colors -ml-1"
            aria-label="Open direct messages"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <span className="text-[#80848E]">@</span>
        <span className="text-white font-semibold text-sm truncate flex-1 min-w-0">{otherUser?.displayName || 'Direct Message'}</span>
        {otherUser && (
          <span className={`w-2 h-2 rounded-full shrink-0 ${otherUser.status === 'online' ? 'bg-online' : otherUser.status === 'idle' ? 'bg-idle' : otherUser.status === 'dnd' ? 'bg-dnd' : 'bg-[#80848E]'}`} />
        )}
        <InboxButton />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Conversation start */}
        {otherUser && (
          <div className="mb-6 pb-4 border-b border-layer-4">
            <div className="w-16 h-16 rounded-full bg-accent-600 flex items-center justify-center mb-3 overflow-hidden">
              {otherUser.avatar ? (
                <img src={otherUser.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-2xl font-bold">{otherUser.displayName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <h2 className="text-white font-bold text-xl">{otherUser.displayName}</h2>
            <p className="text-[#80848E] text-sm">This is the beginning of your direct message history with <strong className="text-white">{otherUser.displayName}</strong>.</p>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.deleted) return null;
          const isMe = msg.authorId._id === user?._id;
          const showHeader = shouldShowHeader(msg, i);
          const isRead = isMe && (msg.readBy || []).length > 0;
          const isUnread = !isMe && !(msg.readBy || []).includes(user?._id || '');

          // Show "NEW MESSAGES" divider before first unread message from the other user
          const isFirstUnread = isUnread && !messages.slice(0, i).some(
            (m) => !m.deleted && m.authorId._id !== user?._id && !(m.readBy || []).includes(user?._id || '')
          );

          return (
            <div key={msg._id}>
              {isFirstUnread && (
                <div className="flex items-center gap-2 my-3">
                  <div className="flex-1 h-px bg-danger-500" />
                  <span className="text-danger-500 text-xs font-bold uppercase shrink-0">New Messages</span>
                  <div className="flex-1 h-px bg-danger-500" />
                </div>
              )}
              <div
                className={`group/msg relative ${showHeader ? 'mt-4 pt-0.5' : 'mt-px'} flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                  {showHeader ? (
                    <div className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <div className="w-10 h-10 rounded-full bg-accent-600 flex items-center justify-center shrink-0 mt-0.5 overflow-hidden">
                        {msg.authorId.avatar ? (
                          <img src={msg.authorId.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white text-sm font-bold">{msg.authorId.displayName.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className={`flex-1 min-w-0 ${isMe ? 'text-right' : 'text-left'}`}>
                        <div className={`flex items-baseline gap-2 ${isMe ? 'justify-end' : ''}`}>
                          <span className="text-white font-medium text-sm hover:underline cursor-pointer">{msg.authorId.displayName}</span>
                          <span className="text-[#80848E] text-xs">{formatDistanceToNowStrict(new Date(msg.createdAt), { addSuffix: true })}</span>
                        </div>
                        {msg.content && (
                          <>
                            <div className={`inline-block rounded-2xl px-3.5 py-2 mt-1 ${isMe ? 'bg-accent-500 text-white' : 'bg-layer-3 text-[#DBDEE1]'} ${isUnread ? 'font-bold ring-1 ring-accent-400/40' : ''}`}>
                              <div className="text-sm leading-relaxed break-words">
                                <MarkdownContent content={msg.content} className={isMe ? 'text-white' : 'text-[#DBDEE1]'} />
                              </div>
                            </div>
                            {extractUrls(msg.content).slice(0, 3).map((url) => (
                              <LinkPreview key={url} url={url} />
                            ))}
                          </>
                        )}
                        {msg.attachments?.length > 0 && <AttachmentList attachments={msg.attachments} onClickImage={setLightboxUrl} />}
                        {/* Read receipt indicator for sent messages */}
                        {isMe && (
                          <div className={`flex items-center gap-1 mt-0.5 ${isMe ? 'justify-end' : ''}`}>
                            {isRead ? (
                              <CheckCheck className="w-3.5 h-3.5 text-accent-400" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-[#5C5F66]" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className={`${isMe ? 'text-right' : 'pl-[52px] text-left'}`}>
                      {msg.content && (
                        <>
                          <div className={`inline-block rounded-2xl px-3.5 py-2 ${isMe ? 'bg-accent-500 text-white' : 'bg-layer-3 text-[#DBDEE1]'} ${isUnread ? 'font-bold ring-1 ring-accent-400/40' : ''}`}>
                            <div className="text-sm leading-relaxed break-words">
                              <MarkdownContent content={msg.content} className={isMe ? 'text-white' : 'text-[#DBDEE1]'} />
                            </div>
                          </div>
                          {extractUrls(msg.content).slice(0, 3).map((url) => (
                            <LinkPreview key={url} url={url} />
                          ))}
                        </>
                      )}
                      {msg.attachments?.length > 0 && <AttachmentList attachments={msg.attachments} onClickImage={setLightboxUrl} />}
                      {isMe && (
                        <div className="flex items-center gap-1 mt-0.5 justify-end">
                          {isRead ? (
                            <CheckCheck className="w-3.5 h-3.5 text-accent-400" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-[#5C5F66]" />
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Pending attachments */}
      {
        pendingAttachments.length > 0 && (
          <div className="px-4 pt-2 flex flex-wrap gap-3 bg-layer-2">
            {pendingAttachments.map((att, i) => (
              <div key={i} className="relative bg-layer-3 rounded-lg p-2 border border-layer-5">
                {att.type === 'image' ? (
                  <img src={att.url} alt={att.name} onClick={() => setLightboxUrl(att.url)} className="max-w-[200px] max-h-[150px] object-cover rounded cursor-pointer hover:brightness-110 transition-all" />
                ) : (
                  <div className="w-[150px] h-[60px] flex items-center gap-2 px-2">
                    <FileText className="w-6 h-6 text-accent-400 shrink-0" />
                    <span className="text-[#B5BAC1] text-xs truncate">{att.name}</span>
                  </div>
                )}
                <button onClick={() => removePendingAttachment(i)} className="absolute -top-2 -right-2 w-5 h-5 bg-danger-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-danger-400">
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        )
      }

      {/* Input */}
      <div className="px-4 pb-4 pt-2">
        <div className="flex items-center gap-2 bg-layer-3 rounded-lg px-4 py-2.5">
          <button onClick={() => fileInputRef.current?.click()} className="text-[#80848E] hover:text-[#B5BAC1] cursor-pointer transition-colors" disabled={uploading}>
            <Paperclip className="w-5 h-5" />
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} accept="image/*,video/*,.pdf,.txt,.zip,.rar" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            className="flex-1 bg-transparent text-[#DBDEE1] placeholder-[#5C5F66] text-sm outline-none"
            placeholder={`Message @${otherUser?.displayName || '...'}`}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() && pendingAttachments.length === 0}
            className="text-accent-400 hover:text-accent-300 disabled:text-[#5C5F66] cursor-pointer disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Lightbox */}
      {
        lightboxUrl && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 cursor-pointer" onClick={() => setLightboxUrl(null)}>
            <button className="absolute top-4 right-4 text-white/70 hover:text-white cursor-pointer" onClick={() => setLightboxUrl(null)}>
              <X className="w-8 h-8" />
            </button>
            <img src={lightboxUrl} alt="Preview" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          </div>
        )
      }
    </div>
  );
}

function AttachmentList({ attachments, onClickImage }: { attachments: Attachment[]; onClickImage: (url: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {attachments.map((att, i) => {
        if (att.type === 'image') {
          return (
            <img key={i} src={att.url} alt={att.name} onClick={() => onClickImage(att.url)} className="max-w-[400px] max-h-[300px] object-cover rounded-lg cursor-pointer hover:brightness-110 transition-all" />
          );
        }
        if (att.type === 'video') {
          return <video key={i} src={att.url} controls className="max-w-[400px] max-h-[300px] rounded-lg" />;
        }
        return (
          <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-layer-3 border border-layer-5 rounded-lg px-3 py-2 hover:bg-layer-4 transition-colors">
            <FileText className="w-5 h-5 text-accent-400" />
            <span className="text-accent-400 text-sm hover:underline">{att.name}</span>
          </a>
        );
      })}
    </div>
  );
}
