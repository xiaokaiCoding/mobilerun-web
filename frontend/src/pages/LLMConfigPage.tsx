import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Select,
  Input,
  InputNumber,
  Descriptions,
  Tag,
  Space,
  message,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  getLLMConfigs,
  getActiveLLMConfig,
  createLLMConfig,
  updateLLMConfig,
  activateLLMConfig,
  deleteLLMConfig,
} from '../api/llmConfig';
import type { LLMConfig } from '../types';

const PROVIDER_OPTIONS = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'Azure', value: 'azure' },
  { label: 'Ollama', value: 'ollama' },
  { label: 'DeepSeek', value: 'deepseek' },
];

export default function LLMConfigPage() {
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [activeConfig, setActiveConfig] = useState<LLMConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [list, active] = await Promise.all([
        getLLMConfigs(),
        getActiveLLMConfig().catch(() => null),
      ]);
      setConfigs(list);
      setActiveConfig(active);
    } catch {
      message.error('获取配置列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleOpenModal = (record?: LLMConfig) => {
    if (record) {
      setEditingId(record.id);
      form.setFieldsValue({
        name: record.name,
        provider: record.provider,
        modelName: record.modelName,
        baseUrl: record.baseUrl,
        apiKey: '',
        temperature: record.temperature,
        maxTokens: record.maxTokens,
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
        await updateLLMConfig(editingId, values);
        message.success('更新成功');
      } else {
        await createLLMConfig(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      await fetchAll();
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      message.error(editingId ? '更新失败' : '创建失败');
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await activateLLMConfig(id);
      message.success('已设为活跃配置');
      await fetchAll();
    } catch {
      message.error('设置活跃配置失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLLMConfig(id);
      message.success('删除成功');
      await fetchAll();
    } catch {
      message.error('删除失败');
    }
  };

  const columns: ColumnsType<LLMConfig> = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 120 },
    { title: '提供商', dataIndex: 'provider', key: 'provider', width: 100 },
    { title: '模型', dataIndex: 'modelName', key: 'modelName', width: 150 },
    {
      title: 'Base URL',
      dataIndex: 'baseUrl',
      key: 'baseUrl',
      ellipsis: true,
    },
    { title: '温度', dataIndex: 'temperature', key: 'temperature', width: 80 },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (isActive: boolean) =>
        isActive ? <Tag color="green">活跃</Tag> : <Tag>普通</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_, record) => (
        <Space>
          {!record.isActive && (
            <Button size="small" onClick={() => handleActivate(record.id)}>
              设为活跃
            </Button>
          )}
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
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>模型配置</h2>

      {activeConfig && (
        <Descriptions
          title="当前活跃配置"
          bordered
          column={{ xs: 1, sm: 2, md: 3, lg: 4 }}
          style={{ marginBottom: 24 }}
        >
          <Descriptions.Item label="提供商">{activeConfig.provider}</Descriptions.Item>
          <Descriptions.Item label="模型">{activeConfig.modelName}</Descriptions.Item>
          <Descriptions.Item label="Base URL">{activeConfig.baseUrl}</Descriptions.Item>
          <Descriptions.Item label="温度">{activeConfig.temperature}</Descriptions.Item>
          <Descriptions.Item label="Max Tokens">{activeConfig.maxTokens}</Descriptions.Item>
        </Descriptions>
      )}

      <div style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={() => handleOpenModal()}>
          新增配置
        </Button>
      </div>

      <Table<LLMConfig>
        rowKey="id"
        columns={columns}
        dataSource={configs}
        loading={loading}
      />

      <Modal
        title={editingId ? '编辑配置' : '新增配置'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="例如: GPT-4" />
          </Form.Item>
          <Form.Item name="provider" label="提供商" rules={[{ required: true }]}>
            <Select options={PROVIDER_OPTIONS} />
          </Form.Item>
          <Form.Item name="modelName" label="模型名称" rules={[{ required: true }]}>
            <Input placeholder="例如: gpt-4o" />
          </Form.Item>
          <Form.Item name="baseUrl" label="Base URL" rules={[{ required: true }]}>
            <Input placeholder="例如: https://api.openai.com/v1" />
          </Form.Item>
          <Form.Item name="apiKey" label="API Key">
            <Input.Password placeholder={editingId ? '留空则不修改' : ''} />
          </Form.Item>
          <Form.Item
            name="temperature"
            label="温度"
            rules={[{ required: true }]}
            initialValue={1}
          >
            <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="maxTokens"
            label="Max Tokens"
            rules={[{ required: true }]}
            initialValue={4096}
          >
            <InputNumber min={1} max={128000} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
