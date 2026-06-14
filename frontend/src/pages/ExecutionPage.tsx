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
  Input,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { getExecutions, createExecution, stopExecution, deleteExecution } from '../api/executions';
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
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const fetchExecutions = async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const result = await getExecutions({ page, page_size: pageSize });
      setExecutions(result.items);
      setPagination({ current: result.page, pageSize: result.page_size, total: result.total });
    } catch {
      message.error('获取执行列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const [d, tc, lc] = await Promise.all([
        getDevices({ page_size: 100 }),
        getTestCases({ page_size: 100 }),
        getLLMConfig().then(c => c ? [c] : []),
      ]);
      setDevices(d.items);
      setTestCases(tc.items);
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
      const execution = await createExecution({
        device_id: values.deviceId,
        test_case_id: values.testCaseId,
      });
      message.success('执行已创建');
      setModalOpen(false);
      navigate(`/executions/${execution.id}`);
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      message.error('创建执行失败');
    }
  };

  const getDeviceName = (deviceId: number) => {
    const d = devices.find(d => d.id === deviceId);
    return d ? `${d.name || ''} (${d.serial})`.trim() : deviceId;
  };

  const getTestCaseName = (testCaseId: number) => {
    const tc = testCases.find(t => t.id === testCaseId);
    return tc ? tc.name : testCaseId;
  };

  const columns: ColumnsType<Execution> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    {
      title: '设备',
      dataIndex: 'device_id',
      key: 'device_id',
      width: 180,
      ellipsis: true,
      render: (deviceId: number) => getDeviceName(deviceId),
    },
    {
      title: '用例',
      dataIndex: 'test_case_id',
      key: 'test_case_id',
      width: 180,
      ellipsis: true,
      render: (testCaseId: number) => getTestCaseName(testCaseId),
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
      dataIndex: 'steps_taken',
      key: 'steps_taken',
      width: 80,
    },
    {
      title: '开始时间',
      dataIndex: 'started_at',
      key: 'started_at',
      width: 180,
      render: (t?: string) =>
        t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => navigate(`/executions/${record.id}`)}>
            查看
          </Button>
          {record.status === 'running' && (
            <Popconfirm title="确认删除?" onConfirm={async () => {
              try {
                await stopExecution(String(record.id));
                message.success('已停止');
                await fetchExecutions(pagination.current, pagination.pageSize);
              } catch {
                message.error('停止失败');
              }
            }}>
              <Button size="small" danger>停止</Button>
            </Popconfirm>
          )}
          {record.status !== 'running' && (
            <Popconfirm title="确认删除?" onConfirm={async () => {
              try {
                await deleteExecution(String(record.id));
                message.success('删除成功');
                await fetchExecutions(pagination.current, pagination.pageSize);
              } catch {
                message.error('删除失败');
              }
            }}>
              <Button size="small" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
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
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => fetchExecutions(page, pageSize),
        }}
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
          <Form.Item label="LLM配置">
            <Input
              disabled
              value={llmConfigs.length > 0 ? `${llmConfigs[0].model} (${llmConfigs[0].provider})` : '暂无配置(请在模型配置页设置)'}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
