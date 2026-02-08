import { create } from "zustand";

interface CompanionState {
  companionId: string | null;
  companionName: string;
  userId: string | null;
  backgroundImage: string | null;
  userName: string;
  setCompanion: (id: string, name: string, userId: string) => void;
  setBackgroundImage: (url: string | null) => void;
  setUserName: (name: string) => void;
  clear: () => void;
}

export const useCompanionStore = create<CompanionState>((set) => ({
  companionId: null,
  companionName: "",
  userId: null,
  backgroundImage: null,
  userName: "",
  setCompanion: (id, name, userId) =>
    set({ companionId: id, companionName: name, userId }),
  setBackgroundImage: (url) => set({ backgroundImage: url }),
  setUserName: (name) => set({ userName: name }),
  clear: () =>
    set({ companionId: null, companionName: "", userId: null, backgroundImage: null, userName: "" }),
}));
