import { useEffect, useState } from 'react';
import { Button, Form, Input, InputNumber, Select, message, Card, Descriptions, Spin } from 'antd';
import { apiClient } from '../api/client';

const PROVIDER_OPTIONS = [
  { label: 'OpenAI', value: 'OpenAI' },
  { label: 'OpenAI Compatible', value: 'OpenAILike' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'Ollama', value: 'ollama' },
  { label: 'DeepSeek', value: 'deepseek' },
  { label: 'OpenRouter', value: 'openrouter' },
];

interface LLMConfigForm {
  provider: string;
  model: string;
  base_url: string;
  api_key: string;
  temperature: number;
  max_tokens: number;
}

export default function LLMConfigPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<LLMConfigForm>();

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<LLMConfigForm>('/llm-config').then(r => r.data);
      form.setFieldsValue(data);
    } catch {
      message.error('获取配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await apiClient.put('/llm-config', values);
      message.success('配置已保存并同步到 mobilerun');
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
  }

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>模型配置</h2>

      <Card title="当前 LLM 配置" style={{ marginBottom: 24 }}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="provider" label="提供商" rules={[{ required: true, message: '请选择提供商' }]}>
            <Select options={PROVIDER_OPTIONS} />
          </Form.Item>
          <Form.Item name="model" label="模型名称" rules={[{ required: true, message: '请输入模型名称' }]}>
            <Input placeholder="例如: deepseek-v4-pro / gpt-4o / claude-sonnet-4-20250514" />
          </Form.Item>
          <Form.Item name="base_url" label="Base URL" rules={[{ required: true, message: '请输入 Base URL' }]}>
            <Input placeholder="例如: https://api.deepseek.com" />
          </Form.Item>
          <Form.Item name="api_key" label="API Key" tooltip="修改时填写新 Key,留空则保持不变">
            <Input.Password placeholder="填写新的 API Key" />
          </Form.Item>
          <Form.Item name="temperature" label="Temperature" rules={[{ required: true }]}>
            <InputNumber min={0} max={2} step={0.1} style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="max_tokens" label="Max Tokens" rules={[{ required: true }]}>
            <InputNumber min={1} max={128000} style={{ width: 200 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={saving}>
              保存配置
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="说明">
        <p>此配置直接读写云服务器上的 <code>~/.config/droidrun/config.yaml</code> 文件。</p>
        <p>保存后会同步更新 config.yaml 中所有 LLM profile (manager / executor / fast_agent 等)。</p>
      </Card>
    </div>
  );
}
