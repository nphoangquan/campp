import { create } from 'zustand';

interface UIState {
  showUserSettings: boolean;
  setShowUserSettings: (show: boolean) => void;
  showInbox: boolean;
  setShowInbox: (show: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  showUserSettings: false,
  setShowUserSettings: (show) => set({ showUserSettings: show }),
  showInbox: false,
  setShowInbox: (show) => set({ showInbox: show }),
}));
