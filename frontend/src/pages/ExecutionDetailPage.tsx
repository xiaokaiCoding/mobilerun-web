import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Descriptions,
  Button,
  Tag,
  Space,
  message,
  Spin,
  Result,
  Card,
  Collapse,
} from 'antd';
import { ArrowLeftOutlined, StopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getExecution, stopExecution, getExecutionEvents } from '../api/executions';
import { useSSE } from '../hooks/useSSE';
import LogViewer from '../components/LogViewer';
import type { Execution, ExecutionEvent } from '../types';

const statusMap: Record<Execution['status'], { color: string; text: string }> = {
  pending: { color: 'blue', text: '等待中' },
  running: { color: 'processing', text: '执行中' },
  success: { color: 'success', text: '成功' },
  failed: { color: 'error', text: '失败' },
  stopped: { color: 'default', text: '已停止' },
};

export default function ExecutionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [execution, setExecution] = useState<Execution | null>(null);
  const [loading, setLoading] = useState(true);
  const [stopping, setStopping] = useState(false);
  const [reportExpanded, setReportExpanded] = useState(false);
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const eventsRef = useRef<ExecutionEvent[]>([]);
  const [sseUrl, setSseUrl] = useState<string | null>(null);

  const fetchExecution = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getExecution(id);
      setExecution(data);
      if (data.status === 'running') {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
        setSseUrl(`${baseUrl}/executions/${id}/stream`);
      } else if (data.status !== 'pending' && eventsRef.current.length === 0) {
        // Load persisted events from DB for completed executions
        try {
          const dbEvents = await getExecutionEvents(id);
          const mapped: ExecutionEvent[] = dbEvents.map((e) => ({
            id: String(e.id ?? ''),
            executionId: String(e.executionId ?? ''),
            eventType: e.eventType,
            eventData: e.eventData ?? {},
            seqNo: e.seqNo ?? 0,
            createdAt: e.createdAt ?? new Date().toISOString(),
          }));
          eventsRef.current = mapped;
          setEvents(mapped);
        } catch {
          // Ignore
        }
      }
    } catch {
      message.error('获取执行详情失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchExecution();
    const timer = setInterval(fetchExecution, 5000);
    return () => clearInterval(timer);
  }, [fetchExecution]);

  const handleSSEEvent = useCallback((data: unknown) => {
    try {
      const raw = typeof data === 'string' ? JSON.parse(data) : data;
      const event: ExecutionEvent = {
        id: raw.seq,
        executionId: Number(id || 0),
        eventType: raw.type || 'Unknown',
        eventData: raw.data || {},
        seqNo: raw.seq || 0,
        createdAt: new Date().toISOString(),
      };
      eventsRef.current = [...eventsRef.current, event];
      setEvents([...eventsRef.current]);
    } catch {
      // Ignore parse errors
    }
  }, [id]);

  const { connected } = useSSE(sseUrl, handleSSEEvent, {
    autoReconnect: true,
  });

  const handleStop = async () => {
    if (!id) return;
    setStopping(true);
    try {
      await stopExecution(id);
      message.success('已发送停止指令');
      setSseUrl(null);
      await fetchExecution();
    } catch {
      message.error('停止执行失败');
    } finally {
      setStopping(false);
    }
  };

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '40px auto' }} />;
  }

  if (!execution) {
    return (
      <Result
        status="404"
        title="执行不存在"
        extra={
          <Button type="primary" onClick={() => navigate('/executions')}>
            返回列表
          </Button>
        }
      />
    );
  }

  const s = statusMap[execution.status];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/executions')}>
          返回列表
        </Button>
      </div>

      <Descriptions
        title={
          <Space>
            执行详情
            <Tag color={s.color}>{s.text}</Tag>
            {connected && <Tag color="green">实时日志</Tag>}
          </Space>
        }
        bordered
        column={{ xs: 1, sm: 2, md: 3 }}
        style={{ marginBottom: 16 }}
      >
        <Descriptions.Item label="执行ID">{execution.id}</Descriptions.Item>
        <Descriptions.Item label="设备ID">{execution.device_id}</Descriptions.Item>
        <Descriptions.Item label="用例ID">{execution.test_case_id}</Descriptions.Item>
        <Descriptions.Item label="步骤数">{execution.steps_taken}</Descriptions.Item>
        <Descriptions.Item label="开始时间">
          {execution.started_at
            ? dayjs(execution.started_at).format('YYYY-MM-DD HH:mm:ss')
            : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="结束时间">
          {execution.finished_at
            ? dayjs(execution.finished_at).format('YYYY-MM-DD HH:mm:ss')
            : '-'}
        </Descriptions.Item>
        {execution.result && (
          <Descriptions.Item label="结果" span={3}>
            {execution.result}
          </Descriptions.Item>
        )}
      </Descriptions>

      {execution.status === 'running' && (
        <div style={{ marginBottom: 16 }}>
          <Button
            danger
            icon={<StopOutlined />}
            onClick={handleStop}
            loading={stopping}
          >
            停止执行
          </Button>
        </div>
      )}

      {execution.trajectory_path && (execution.status === 'success' || execution.status === 'failed' || execution.status === 'stopped') && (
        <Card title="执行报告" size="small" style={{ marginBottom: 16 }}>
          <Collapse
            activeKey={reportExpanded ? ['1'] : []}
            onChange={(keys) => setReportExpanded(Array.isArray(keys) && keys.includes('1'))}
            items={[{
              key: '1',
              label: '执行过程动画 (点击展开)',
              children: (
                <div style={{ textAlign: 'center' }}>
                  <img
                    src={`${execution.trajectory_path!.replace(/\/$/, '')}/screenshots/trajectory.gif`.replace('/root/mobilerun-web/trajectories', '/trajectories')}
                    alt="执行过程动画"
                    style={{ maxWidth: 400, maxHeight: '60vh', borderRadius: 8, objectFit: 'contain' }}
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.onerror = null;
                      img.src = `${execution.trajectory_path!.replace(/\/$/, '')}/screenshots/0000.png`.replace('/root/mobilerun-web/trajectories', '/trajectories');
                    }}
                  />
                </div>
              ),
            }]}
          />
        </Card>
      )}

      {execution.screenshot && (execution.status === 'success' || execution.status === 'failed' || execution.status === 'stopped') && (
        <Card title="执行完成后设备截图" size="small" style={{ marginBottom: 16 }}>
          <img
            src={`data:image/png;base64,${execution.screenshot}`}
            alt="device screenshot"
            style={{ maxWidth: '100%', borderRadius: 8 }}
          />
        </Card>
      )}

      <LogViewer events={events} />
    </div>
  );
}
