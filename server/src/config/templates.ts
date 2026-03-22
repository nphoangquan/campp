export interface TemplateChannel {
  name: string;
  type: 'text' | 'voice';
}

export interface TemplateCategory {
  name: string;
  channels: TemplateChannel[];
}

export interface ServerTemplate {
  id: string;
  name: string;
  description: string;
  categories: TemplateCategory[];
}

export const SERVER_TEMPLATES: ServerTemplate[] = [
  {
    id: 'default',
    name: 'Start from scratch',
    description: 'Basic server with general text and voice channels',
    categories: [
      {
        name: 'Text Channels',
        channels: [{ name: 'general', type: 'text' }],
      },
      {
        name: 'Voice Channels',
        channels: [{ name: 'General', type: 'voice' }],
      },
    ],
  },
  {
    id: 'gaming',
    name: 'Gaming',
    description: 'For gaming communities and clans',
    categories: [
      {
        name: 'Text Channels',
        channels: [
          { name: 'general', type: 'text' },
          { name: 'announcements', type: 'text' },
          { name: 'lfg', type: 'text' },
          { name: 'memes', type: 'text' },
        ],
      },
      {
        name: 'Voice Channels',
        channels: [
          { name: 'General', type: 'voice' },
          { name: 'Gaming', type: 'voice' },
          { name: 'AFK', type: 'voice' },
        ],
      },
    ],
  },
  {
    id: 'study',
    name: 'Study Group',
    description: 'For study groups and classes',
    categories: [
      {
        name: 'Text Channels',
        channels: [
          { name: 'general', type: 'text' },
          { name: 'homework', type: 'text' },
          { name: 'resources', type: 'text' },
          { name: 'questions', type: 'text' },
        ],
      },
      {
        name: 'Voice Channels',
        channels: [
          { name: 'Study Room', type: 'voice' },
          { name: 'Break Room', type: 'voice' },
        ],
      },
    ],
  },
  {
    id: 'community',
    name: 'Community',
    description: 'For communities and fan clubs',
    categories: [
      {
        name: 'Text Channels',
        channels: [
          { name: 'general', type: 'text' },
          { name: 'announcements', type: 'text' },
          { name: 'rules', type: 'text' },
          { name: 'introductions', type: 'text' },
          { name: 'off-topic', type: 'text' },
        ],
      },
      {
        name: 'Voice Channels',
        channels: [
          { name: 'General', type: 'voice' },
          { name: 'Events', type: 'voice' },
        ],
      },
    ],
  },
  {
    id: 'work',
    name: 'Work / Project',
    description: 'For teams and project collaboration',
    categories: [
      {
        name: 'Text Channels',
        channels: [
          { name: 'general', type: 'text' },
          { name: 'announcements', type: 'text' },
          { name: 'project-discussion', type: 'text' },
          { name: 'resources', type: 'text' },
        ],
      },
      {
        name: 'Voice Channels',
        channels: [
          { name: 'Meeting Room', type: 'voice' },
          { name: 'Focus Time', type: 'voice' },
        ],
      },
    ],
  },
];
