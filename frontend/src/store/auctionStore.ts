import { create } from 'zustand';
import { AuctionState, NotificationItem } from '../types';
import { createAuctionSocket, api } from '../api/client';

interface AuctionStore {
  auctionState: AuctionState | null;
  socket: WebSocket | null;
  isConnected: boolean;
  bidError: string | null;
  activeToast: { message: string; type: 'success' | 'warning' | 'info' } | null;
  notifications: NotificationItem[];
  initWebSocket: (token?: string) => void;
  disconnectWebSocket: () => void;
  placeBid: (amount: number, teamId?: number) => void;
  fetchState: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  clearBidError: () => void;
  clearToast: () => void;
}

const getStoredToken = () => localStorage.getItem('access_token') || localStorage.getItem('token') || undefined;

export const useAuctionStore = create<AuctionStore>((set, get) => ({
  auctionState: null,
  socket: null,
  isConnected: false,
  bidError: null,
  activeToast: null,
  notifications: [],

  initWebSocket: (token?: string) => {
    const activeToken = token || getStoredToken();
    const existingSocket = get().socket;
    if (existingSocket && (existingSocket.readyState === WebSocket.OPEN || existingSocket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const ws = createAuctionSocket(activeToken);

    let pingInterval: any = null;

    ws.onopen = () => {
      set({ isConnected: true, socket: ws });
      // 15s PING keep-alive heartbeat to prevent proxy disconnections
      pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: 'PING' }));
        } else {
          clearInterval(pingInterval);
        }
      }, 15000);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { event: evtType, data, extra, message: errText } = message;

        // Lightweight tick handling without replacing entire auctionState structure
        if (evtType === 'TIMER_TICK') {
          const tSec = message.timer_seconds ?? extra?.timer_seconds;
          if (tSec !== undefined) {
            set((state) => ({
              auctionState: state.auctionState
                ? { ...state.auctionState, timer_seconds: tSec }
                : null
            }));
          }
          return;
        }

        if (evtType === 'INTERMISSION_TICK') {
          const iSec = message.intermission_seconds ?? extra?.intermission_seconds;
          if (iSec !== undefined) {
            set((state) => ({
              auctionState: state.auctionState
                ? { ...state.auctionState, timer_seconds: iSec, intermission_seconds: iSec }
                : null
            }));
          }
          return;
        }

        if (data) {
          set({ auctionState: data, bidError: null });
        }

        // Real-Time Notification Toasts for ALL connected Captains & Admins
        if (evtType === 'PLAYER_SOLD' && extra) {
          const msg = `🎉 SOLD! ${extra.player_name} sold to ${extra.team_name} for ₹${Number(extra.amount).toLocaleString()}!`;
          set({ activeToast: { message: msg, type: 'success' } });
          get().fetchNotifications();
        } else if (evtType === 'PLAYER_UNSOLD' && extra) {
          const msg = `⚠️ UNSOLD! ${extra.player_name} went unsold.`;
          set({ activeToast: { message: msg, type: 'warning' } });
          get().fetchNotifications();
        } else if (evtType === 'AUCTION_STARTED') {
          set({ activeToast: { message: '🚨 Live Auction Started!', type: 'info' } });
          get().fetchNotifications();
        } else if (evtType === 'AUCTION_PAUSED') {
          set({ activeToast: { message: '⏸️ Auction Paused by Admin', type: 'warning' } });
          get().fetchNotifications();
        } else if (evtType === 'PLAYER_ALLOCATED') {
          set({ activeToast: { message: '⚡ Player Direct Allocation Updated!', type: 'success' } });
          get().fetchNotifications();
          get().fetchState();
        } else if (evtType === 'PLAYER_REVOKED') {
          set({ activeToast: { message: '🔄 Player Revoked & Returned to Auction Pool by Admin.', type: 'warning' } });
          get().fetchNotifications();
          get().fetchState();
        } else if (evtType === 'BID_ERROR') {
          set({ bidError: errText || 'Failed to place bid.' });
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      if (pingInterval) clearInterval(pingInterval);
      set({ isConnected: false, socket: null });
      // Seamless auto-reconnect with valid JWT token
      setTimeout(() => {
        const storedToken = getStoredToken();
        if (storedToken) {
          get().initWebSocket(storedToken);
        }
      }, 2000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket connection error:', err);
      if (pingInterval) clearInterval(pingInterval);
      set({ isConnected: false });
    };
  },

  disconnectWebSocket: () => {
    const ws = get().socket;
    if (ws) {
      ws.close();
      set({ socket: null, isConnected: false });
    }
  },

  placeBid: (amount: number, teamId?: number) => {
    const ws = get().socket;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      const storedToken = getStoredToken();
      if (storedToken) {
        get().initWebSocket(storedToken);
      }
      set({ bidError: 'Re-connecting to auction live server... Please try again in 1 second.' });
      return;
    }
    set({ bidError: null });
    ws.send(JSON.stringify({
      action: 'PLACE_BID',
      amount,
      team_id: teamId
    }));
  },

  fetchState: async () => {
    try {
      const res = await api.get<AuctionState>('/auction/state');
      set({ auctionState: res.data });
    } catch (err) {
      console.error('Failed to fetch auction state:', err);
    }
  },

  fetchNotifications: async () => {
    try {
      const res = await api.get<NotificationItem[]>('/notifications');
      set({ notifications: res.data });
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  },

  clearBidError: () => set({ bidError: null }),
  clearToast: () => set({ activeToast: null })
}));
