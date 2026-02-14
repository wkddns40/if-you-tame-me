import { create } from "zustand";

interface CompanionState {
  companionId: string | null;
  companionName: string;
  userId: string | null;
  backgroundImage: string | null;
  userName: string;
  setCompanion: (id: string, name: string, userId: string) => void;
  setCompanionName: (name: string) => void;
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
  setCompanionName: (name) => set({ companionName: name }),
  setBackgroundImage: (url) => set({ backgroundImage: url }),
  setUserName: (name) => set({ userName: name }),
  clear: () =>
    set({ companionId: null, companionName: "", userId: null, backgroundImage: null, userName: "" }),
}));
