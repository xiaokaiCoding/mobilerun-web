import { useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import type { ExecutionEvent } from '../types';

interface LogViewerProps {
  events: ExecutionEvent[];
}

const typeColors: Record<string, string> = {
  ToolExecutionEvent: '#1890ff',
  ScreenshotEvent: '#722ed1',
  ResultEvent: '#52c41a',
  ErrorEvent: '#ff4d4f',
  NavigationEvent: '#faad14',
  TapEvent: '#13c2c2',
  ScrollEvent: '#eb2f96',
  InputEvent: '#fa541c',
};

function getEventSummary(event: ExecutionEvent): string {
  const d = event.eventData || {};
  switch (event.eventType) {
    case 'ToolExecutionEvent':
      return `Tool: ${d.toolName ?? 'unknown'} | Args: ${JSON.stringify(d.args ?? {}).slice(0, 120)}`;
    case 'ScreenshotEvent':
      return `Screenshot captured${(d.base64 as string | undefined) ? ' (thumbnail available)' : ''}`;
    case 'ResultEvent':
      return `Result: ${d.summary ?? d.message ?? JSON.stringify(d).slice(0, 200)}`;
    case 'ErrorEvent':
      return `Error: ${d.message ?? d.error ?? 'unknown error'}`;
    default:
      return JSON.stringify(d).slice(0, 200);
  }
}

export default function LogViewer({ events }: LogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div
        ref={containerRef}
        style={{
          background: '#1e1e1e',
          borderRadius: 8,
          padding: 24,
          minHeight: 400,
          color: '#888',
          fontFamily: 'monospace',
          fontSize: 14,
        }}
      >
        等待事件...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        background: '#1e1e1e',
        borderRadius: 8,
        padding: '12px 16px',
        minHeight: 400,
        maxHeight: '60vh',
        overflowY: 'auto',
        fontFamily: 'monospace',
        fontSize: 13,
        lineHeight: 1.6,
      }}
    >
      {events.map((event) => {
        const color = typeColors[event.eventType] || '#888';
        const timestamp = dayjs(event.createdAt).format('HH:mm:ss.SSS');
        const summary = getEventSummary(event);

        return (
          <div
            key={event.id ?? `${event.seqNo}-${event.createdAt}`}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '2px 0',
              borderBottom: '1px solid #2a2a2a',
            }}
          >
            <span style={{ color: '#666', flexShrink: 0, minWidth: 90 }}>
              {timestamp}
            </span>
            <span
              style={{
                color,
                flexShrink: 0,
                minWidth: 140,
                fontWeight: 600,
              }}
            >
              [{event.eventType}]
            </span>
            <span
              style={{
                color: '#d4d4d4',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
              }}
            >
              {summary}
            </span>
          </div>
        );
      })}
    </div>
  );
}
