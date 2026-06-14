import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Modal,
  Form,
  Select,
  Tag,
  Space,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { getExecutions, createExecution } from '../api/executions';
import { getDevices } from '../api/devices';
import { getTestCases } from '../api/testCases';
import { getLLMConfig, type LLMConfigData } from '../api/llmConfig';
import type { Execution, Device, TestCase, LLMConfig } from '../types';

const statusMap: Record<Execution['status'], { color: string; text: string }> = {
  pending: { color: 'blue', text: '等待中' },
  running: { color: 'orange', text: '执行中' },
  success: { color: 'green', text: '成功' },
  failed: { color: 'red', text: '失败' },
  stopped: { color: 'red', text: '已停止' },
};

export default function ExecutionPage() {
  const navigate = useNavigate();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [devices, setDevices] = useState<Device[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [llmConfigs, setLlmConfigs] = useState<LLMConfigData[]>([]);

  const fetchExecutions = async () => {
    setLoading(true);
    try {
      const list = await getExecutions();
      setExecutions(list);
    } catch {
      message.error('获取执行列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const [d, tc, lc] = await Promise.all([
        getDevices(),
        getTestCases(),
        getLLMConfig().then(c => c ? [c] : []),
      ]);
      setDevices(d);
      setTestCases(tc);
      setLlmConfigs(lc);
    } catch {
      // Options load silently; user will see empty selects
    }
  };

  useEffect(() => {
    fetchExecutions();
    fetchOptions();
  }, []);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const execution = await createExecution(values);
      message.success('执行已创建');
      setModalOpen(false);
      navigate(`/executions/${execution.id}`);
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      message.error('创建执行失败');
    }
  };

  const columns: ColumnsType<Execution> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 120 },
    {
      title: '设备',
      dataIndex: 'deviceId',
      key: 'deviceId',
      width: 160,
      ellipsis: true,
    },
    {
      title: '用例',
      dataIndex: 'testCaseId',
      key: 'testCaseId',
      width: 160,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: Execution['status']) => {
        const s = statusMap[status];
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '步骤数',
      dataIndex: 'stepsTaken',
      key: 'stepsTaken',
      width: 80,
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 180,
      render: (t?: string) =>
        t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button size="small" onClick={() => navigate(`/executions/${record.id}`)}>
          查看
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>任务执行</h2>
        <Button
          type="primary"
          onClick={() => {
            form.resetFields();
            setModalOpen(true);
          }}
        >
          新建执行
        </Button>
      </div>

      <Table<Execution>
        rowKey="id"
        columns={columns}
        dataSource={executions}
        loading={loading}
      />

      <Modal
        title="新建执行"
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="deviceId"
            label="设备"
            rules={[{ required: true, message: '请选择设备' }]}
          >
            <Select
              options={devices.map((d) => ({
                label: `${d.name} (${d.serial})`,
                value: d.id,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="testCaseId"
            label="测试用例"
            rules={[{ required: true, message: '请选择用例' }]}
          >
            <Select
              options={testCases.map((tc) => ({
                label: tc.name,
                value: tc.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="llmConfigId" label="LLM配置 (可选)">
            <Select
              allowClear
              placeholder={llmConfigs.length > 0 ? `当前: ${llmConfigs[0].model} (${llmConfigs[0].provider})` : '暂无配置'}
              disabled={llmConfigs.length === 0}
              value={null}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
