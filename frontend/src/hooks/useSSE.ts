import { useEffect, useRef, useState } from 'react';

interface UseSSEOptions {
  autoReconnect?: boolean;
}

export function useSSE(
  url: string | null,
  onEvent: (data: unknown) => void,
  options?: UseSSEOptions,
) {
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = () => {
    if (!url) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
    };

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onEventRef.current(parsed);
      } catch {
        onEventRef.current(event.data);
      }
    };

    es.addEventListener('message', (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onEventRef.current(parsed);
      } catch {
        onEventRef.current(event.data);
      }
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
      eventSourceRef.current = null;

      if (options?.autoReconnect) {
        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, 3000);
      }
    };
  };

  useEffect(() => {
    if (url) {
      connect();
    }

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [url]);

  return { connected };
}
