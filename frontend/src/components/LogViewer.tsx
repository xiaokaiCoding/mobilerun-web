import { useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import type { ExecutionEvent } from '../types';

interface LogViewerProps {
  events: ExecutionEvent[];
}

const typeColors: Record<string, string> = {
  StartEvent: '#52c41a',
  FastAgentInputEvent: '#1890ff',
  FastAgentExecuteEvent: '#13c2c2',
  FastAgentResponseEvent: '#722ed1',
  FastAgentToolCallEvent: '#faad14',
  FastAgentOutputEvent: '#fa8c16',
  FastAgentEndEvent: '#52c41a',
  RecordUIStateEvent: '#888',
  ScreenshotEvent: '#722ed1',
  ResultEvent: '#52c41a',
  ErrorEvent: '#ff4d4f',
};

function getEventSummary(event: ExecutionEvent): string {
  const d = event.eventData || {};
  switch (event.eventType) {
    case 'FastAgentToolCallEvent':
    case 'ToolExecutionEvent': {
      const toolName = d.tool_name ?? d.toolName ?? 'unknown';
      const args = d.tool_args ?? d.toolArgs ?? d.args ?? d;
      return `Tool: ${toolName} | ${JSON.stringify(args).slice(0, 150)}`;
    }
    case 'FastAgentResponseEvent':
      return `Thought: ${d.thought ?? d.response ?? ''}`.slice(0, 200);
    case 'FastAgentOutputEvent':
      return `Output: ${JSON.stringify(d.output ?? d).slice(0, 200)}`;
    case 'FastAgentInputEvent':
      return `Input received`;
    case 'FastAgentExecuteEvent':
      return `Executing: ${d.instruction ?? d.command ?? ''}`.slice(0, 200);
    case 'FastAgentEndEvent':
      return `Agent finished: ${d.success ? 'success' : (d.reason ?? 'unknown')}`;
    case 'ScreenshotEvent': {
      const hasImage = d.screenshot_base64 || d.screenshot;
      return `Screenshot captured${hasImage ? ' (image)' : ''}`;
    }
    case 'RecordUIStateEvent': {
      const uiState = d.ui_state;
      const count = Array.isArray(uiState) ? uiState.length : 0;
      return `UI state recorded (${count} elements)`;
    }
    case 'ResultEvent':
      return `Result: ${d.summary ?? d.message ?? d.reason ?? JSON.stringify(d).slice(0, 200)}`;
    case 'ErrorEvent':
      return `Error: ${d.message ?? d.error ?? 'unknown error'}`;
    case 'StartEvent':
      return `Execution started`;
    default: {
      const keys = Object.keys(d);
      if (keys.length === 0) return `(no data)`;
      return JSON.stringify(d).slice(0, 200);
    }
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
        暂无执行日志
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
        const timestamp = dayjs(event.createdAt).format('HH:mm:ss');
        const summary = getEventSummary(event);

        return (
          <div
            key={event.id ?? `${event.seqNo}-${event.eventType}`}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '2px 0',
              borderBottom: '1px solid #2a2a2a',
            }}
          >
            <span style={{ color: '#666', flexShrink: 0, minWidth: 70 }}>
              {timestamp}
            </span>
            <span
              style={{
                color,
                flexShrink: 0,
                minWidth: 160,
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
