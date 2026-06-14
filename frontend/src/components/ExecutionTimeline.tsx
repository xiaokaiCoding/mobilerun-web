import { Timeline } from 'antd';
import {
  PlayCircleOutlined,
  ToolOutlined,
  CameraOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PauseCircleOutlined,
} from '@ant-design/icons';
import type { ExecutionEvent } from '../types';

interface ExecutionTimelineProps {
  events: ExecutionEvent[];
}

const IMPORTANT_TYPES = new Set([
  'ToolExecutionEvent',
  'ScreenshotEvent',
  'ResultEvent',
  'ErrorEvent',
  'NavigationEvent',
  'StartEvent',
  'EndEvent',
]);

function getEventIcon(eventType: string) {
  switch (eventType) {
    case 'StartEvent':
      return <PlayCircleOutlined style={{ color: '#1890ff' }} />;
    case 'EndEvent':
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    case 'ToolExecutionEvent':
      return <ToolOutlined style={{ color: '#1890ff' }} />;
    case 'ScreenshotEvent':
      return <CameraOutlined style={{ color: '#722ed1' }} />;
    case 'ResultEvent':
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    case 'ErrorEvent':
      return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    case 'NavigationEvent':
      return <PlayCircleOutlined style={{ color: '#faad14' }} />;
    default:
      return <PauseCircleOutlined style={{ color: '#888' }} />;
  }
}

function getEventLabel(event: ExecutionEvent): string {
  const d = event.eventData || {};
  switch (event.eventType) {
    case 'StartEvent':
      return '执行开始';
    case 'EndEvent':
      return `执行完成 - ${d.status ?? 'done'}`;
    case 'ToolExecutionEvent':
      return `调用工具: ${d.toolName ?? 'unknown'}`;
    case 'ScreenshotEvent':
      return '截图';
    case 'ResultEvent':
      return `结果: ${String(d.summary ?? d.message ?? '').slice(0, 80)}`;
    case 'ErrorEvent':
      return `错误: ${String(d.message ?? d.error ?? 'unknown').slice(0, 80)}`;
    case 'NavigationEvent':
      return `导航: ${d.url ?? d.target ?? ''}`;
    default:
      return event.eventType;
  }
}

export default function ExecutionTimeline({ events }: ExecutionTimelineProps) {
  const filtered = events
    .filter((e) => IMPORTANT_TYPES.has(e.eventType))
    .sort((a, b) => a.seqNo - b.seqNo);

  if (filtered.length === 0) {
    return null;
  }

  return (
    <Timeline
      style={{ marginTop: 16 }}
      items={filtered.map((event) => ({
        children: (
          <div>
            <strong>{getEventLabel(event)}</strong>
            <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
              {event.createdAt}
            </div>
          </div>
        ),
        dot: getEventIcon(event.eventType),
      }))}
    />
  );
}
