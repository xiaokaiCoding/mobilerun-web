import { useEffect, useState } from 'react';
import { Table, Tag, Button, Drawer, Descriptions, message, Space, Modal, Form, Input, Select, Alert, Card } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { getDevices, scanDevices, registerDevice } from '../api/devices';
import type { Device } from '../types';

const statusMap: Record<Device['status'], { color: string; text: string }> = {
  online: { color: 'green', text: '在线' },
  offline: { color: 'default', text: '离线' },
  busy: { color: 'orange', text: '忙碌' },
};

export default function DevicePage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const list = await getDevices();
      setDevices(list);
    } catch {
      message.error('获取设备列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    const timer = setInterval(fetchDevices, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      await scanDevices();
      message.success('扫描完成');
      await fetchDevices();
    } catch {
      message.error('扫描设备失败');
    } finally {
      setScanning(false);
    }
  };

  const handleRegister = async () => {
    try {
      const values = await form.validateFields();
      await registerDevice(values);
      message.success('设备注册成功');
      setRegisterModalOpen(false);
      form.resetFields();
      await fetchDevices();
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      message.error('注册设备失败');
    }
  };

  const columns: ColumnsType<Device> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: '序列号',
      dataIndex: 'serial',
      key: 'serial',
      width: 200,
    },
    {
      title: '型号',
      dataIndex: 'model',
      key: 'model',
      width: 180,
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 100,
      render: (platform: string) => platform.toUpperCase(),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: Device['status']) => {
        const s = statusMap[status];
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '最后连接时间',
      dataIndex: 'lastSeenAt',
      key: 'lastSeenAt',
      width: 200,
      render: (t: string) => (t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>设备管理</h2>
        <Space>
          <Button onClick={() => { form.resetFields(); setRegisterModalOpen(true); }}>
            注册设备
          </Button>
          <Button type="primary" onClick={handleScan} loading={scanning}>
            扫描设备
          </Button>
        </Space>
      </div>

      <Card title="如何注册设备" size="small" style={{ marginBottom: 16 }}>
        <Alert
          type="info"
          showIcon
          message="3 种方式注册设备"
          description={
            <ol style={{ margin: '8px 0 0 20px', paddingLeft: 0 }}>
              <li><b>注册设备</b>: 手动填写序列号(如 <code>192.168.1.18:5555</code>)、设备名称和型号</li>
              <li><b>扫描设备</b>: 通过 ADB 自动扫描当前连接的无线设备并自动注册</li>
              <li><b>无线 adb 连接步骤</b>:
                <ul style={{ margin: '4px 0 0 20px' }}>
                  <li>数据线连接手机 → 手机开启 USB 调试</li>
                  <li>执行 <code>adb -s &lt;serial&gt; tcpip 5555</code> 切换到无线模式</li>
                  <li>拔掉数据线,手机保持在同一 WiFi</li>
                  <li>在「注册设备」中填写 <code>&lt;手机WiFi IP&gt;:5555</code></li>
                </ul>
              </li>
            </ol>
          }
          style={{ textAlign: 'left' }}
        />
      </Card>
      <Table<Device>
        rowKey="id"
        columns={columns}
        dataSource={devices}
        loading={loading}
        onRow={(record) => ({
          onClick: () => {
            setSelectedDevice(record);
            setDrawerOpen(true);
          },
          style: { cursor: 'pointer' },
        })}
      />
      <Drawer
        title="设备详情"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={600}
      >
        {selectedDevice && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="名称">{selectedDevice.name}</Descriptions.Item>
            <Descriptions.Item label="序列号">{selectedDevice.serial}</Descriptions.Item>
            <Descriptions.Item label="型号">{selectedDevice.model}</Descriptions.Item>
            <Descriptions.Item label="平台">
              {selectedDevice.platform.toUpperCase()}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusMap[selectedDevice.status].color}>
                {statusMap[selectedDevice.status].text}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="最后连接时间">
              {selectedDevice.lastSeenAt
                ? dayjs(selectedDevice.lastSeenAt).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(selectedDevice.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      <Modal
        title="注册设备"
        open={registerModalOpen}
        onOk={handleRegister}
        onCancel={() => setRegisterModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="serial" label="序列号 (ADB Serial)" rules={[{ required: true }]}>
            <Input placeholder="例如: 192.168.1.18:5555 或 emulator-5556" />
          </Form.Item>
          <Form.Item name="name" label="设备名称">
            <Input placeholder="例如: 小米14 Pro" />
          </Form.Item>
          <Form.Item name="model" label="型号">
            <Input placeholder="例如: 23127PN0CC" />
          </Form.Item>
          <Form.Item name="platform" label="平台" initialValue="android">
            <Select options={[{ label: 'Android', value: 'android' }, { label: 'iOS', value: 'ios' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
