import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { Me } from "@/lib/types";

interface AuthState {
  accessToken: string | null;
  user: Me | null;
  // 'unknown' until bootstrap completes (refresh attempt on load).
  status: "unknown" | "authenticated" | "anonymous";
}

const initialState: AuthState = {
  accessToken: null,
  user: null,
  status: "unknown",
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAccessToken(state, action: PayloadAction<string>) {
      state.accessToken = action.payload;
      state.status = "authenticated";
    },
    setUser(state, action: PayloadAction<Me>) {
      state.user = action.payload;
    },
    setAnonymous(state) {
      state.accessToken = null;
      state.user = null;
      state.status = "anonymous";
    },
    clearAuth(state) {
      state.accessToken = null;
      state.user = null;
      state.status = "anonymous";
    },
  },
});

export const { setAccessToken, setUser, setAnonymous, clearAuth } = authSlice.actions;
export default authSlice.reducer;
