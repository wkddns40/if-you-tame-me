import { create } from "zustand";

interface CompanionState {
  companionId: string | null;
  companionName: string;
  userId: string | null;
  setCompanion: (id: string, name: string, userId: string) => void;
  clear: () => void;
}

export const useCompanionStore = create<CompanionState>((set) => ({
  companionId: null,
  companionName: "",
  userId: null,
  setCompanion: (id, name, userId) =>
    set({ companionId: id, companionName: name, userId }),
  clear: () => set({ companionId: null, companionName: "", userId: null }),
}));
