import { useEffect, useRef, useState } from 'react';
import { getAdminAuthToken, getPlayerAuthToken } from '../utils/api.ts';

export function useWebSocketChannel<T>(
  channel: 'admin' | 'team' | 'display',
  enabled: boolean,
  onEvent?: (eventName: string, state: T) => void
) {
  const [state, setState] = useState<T | null>(null);
  const [connected, setConnected] = useState(false);
  const [sessionResetFlag, setSessionResetFlag] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const token =
        channel === 'admin'
          ? getAdminAuthToken()
          : channel === 'team'
          ? getPlayerAuthToken()
          : '';
      const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : '';
      const url = `${proto}//${window.location.host}/ws?channel=${channel}${tokenQuery}`;
      ws = new WebSocket(url);

      ws.onopen = () => {
        if (disposed) return;
        setConnected(true);
        setSessionResetFlag(false);
        pingTimer = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 15000);
      };

      ws.onmessage = (ev) => {
        if (disposed) return;
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'init' && msg.state) {
            setState(msg.state as T);
          } else if (msg.type === 'event' && msg.state) {
            setState(msg.state as T);
            if (onEventRef.current && msg.event) {
              onEventRef.current(msg.event, msg.state as T);
            }
          } else if (msg.type === 'session_reset') {
            setSessionResetFlag(true);
          }
        } catch {
          // ignore invalid frames
        }
      };

      ws.onclose = () => {
        if (disposed) return;
        setConnected(false);
        if (pingTimer) clearInterval(pingTimer);
        reconnectTimer = setTimeout(connect, 1500);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      ws?.close();
    };
  }, [channel, enabled]);

  return { state, setState, connected, sessionResetFlag };
}
