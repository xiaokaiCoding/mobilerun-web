import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Tag,
  Space,
  message,
  Popconfirm,
  Drawer,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  getTestCases,
  createTestCase,
  updateTestCase,
  deleteTestCase,
  getTestCaseHistory,
} from '../api/testCases';
import type { TestCase, Execution } from '../types';

const statusMap: Record<TestCase['status'], { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  active: { color: 'green', text: '启用' },
  archived: { color: 'orange', text: '归档' },
};

export default function TestCasePage() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<Execution[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const fetchCases = async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const result = await getTestCases({ page, page_size: pageSize });
      setCases(result.items);
      setPagination({ current: result.page, pageSize: result.page_size, total: result.total });
    } catch {
      message.error('获取用例列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const handleOpenModal = (record?: TestCase) => {
    if (record) {
      setEditingId(record.id);
      form.setFieldsValue({
        name: record.name,
        description: record.description,
        goal: record.goal,
        maxSteps: record.maxSteps ?? 30,
      });
    } else {
      setEditingId(null);
      form.resetFields();
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingId) {
        await updateTestCase(editingId, values);
        message.success('更新成功');
      } else {
        await createTestCase(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      await fetchCases();
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      message.error(editingId ? '更新失败' : '创建失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTestCase(id);
      message.success('删除成功');
      await fetchCases(pagination.current, pagination.pageSize);
    } catch {
      message.error('删除失败');
    }
  };

  const handleViewHistory = async (id: number) => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const list = await getTestCaseHistory(id);
      setHistoryData(list);
    } catch {
      message.error('获取执行历史失败');
    } finally {
      setHistoryLoading(false);
    }
  };

  const columns: ColumnsType<TestCase> = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 200 },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '目标',
      dataIndex: 'goal',
      key: 'goal',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: TestCase['status']) => {
        const s = statusMap[status];
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '最大步数',
      dataIndex: 'maxSteps',
      key: 'maxSteps',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      render: (_, record) => (
        <Space>
          <Button size="small" type="primary" onClick={() => {
            navigate('/executions');
            setTimeout(() => {
              (document.querySelector('[data-testid="new-execution"]') as HTMLElement)?.click();
            }, 100);
          }}>
            执行
          </Button>
          <Button size="small" onClick={() => handleOpenModal(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button size="small" danger>
              删除
            </Button>
          </Popconfirm>
          <Button size="small" onClick={() => handleViewHistory(record.id)}>
            执行历史
          </Button>
        </Space>
      ),
    },
  ];

  const historyColumns: ColumnsType<Execution> = [
    { title: '执行ID', dataIndex: 'id', key: 'id', width: 120 },
    { title: '设备ID', dataIndex: 'deviceId', key: 'deviceId', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: Execution['status']) => <Tag>{s}</Tag>,
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
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>用例配置</h2>
        <Button type="primary" onClick={() => handleOpenModal()}>
          新增用例
        </Button>
      </div>

      <Table<TestCase>
        rowKey="id"
        columns={columns}
        dataSource={cases}
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => fetchCases(page, pageSize),
        }}
      />

      <Modal
        title={editingId ? '编辑用例' : '新增用例'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="goal" label="目标" rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="maxSteps" label="最大步数" initialValue={30}>
            <InputNumber min={1} max={200} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="执行历史"
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        width={800}
      >
        <Table<Execution>
          rowKey="id"
          columns={historyColumns}
          dataSource={historyData}
          loading={historyLoading}
          size="small"
        />
      </Drawer>
    </div>
  );
}
