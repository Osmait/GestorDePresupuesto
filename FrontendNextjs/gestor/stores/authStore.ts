import { User } from "@/types/user";
import { create } from "zustand";

interface AuthState {
  user: User | null;
  setUser: (u: User) => void;
}

export const AuthStore = create<AuthState>()((set) => ({
  user: null,
  setUser: (u: User) => set((state) => ({ user: u })),
}));
