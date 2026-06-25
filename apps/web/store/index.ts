import { configureStore } from "@reduxjs/toolkit";
import { skulpulseApi } from "./api/skulpulseApi";
import authReducer from "./slices/authSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [skulpulseApi.reducerPath]: skulpulseApi.reducer,
  },
  middleware: (getDefault) => getDefault().concat(skulpulseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
