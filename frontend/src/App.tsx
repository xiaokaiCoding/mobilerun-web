import { useState } from 'react';
import { HashRouter, Routes, Route, Outlet, Navigate, useNavigate } from 'react-router-dom';
import { Layout, Menu, Typography, Button, theme } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MobileOutlined,
  SettingOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import DevicePage from './pages/DevicePage';
import LLMConfigPage from './pages/LLMConfigPage';
import TestCasePage from './pages/TestCasePage';
import ExecutionPage from './pages/ExecutionPage';
import ExecutionDetailPage from './pages/ExecutionDetailPage';

const { Sider, Header, Content } = Layout;
const { Title } = Typography;

const menuItems = [
  { key: '/devices', icon: <MobileOutlined />, label: '设备管理' },
  { key: '/llm-config', icon: <SettingOutlined />, label: '模型配置' },
  { key: '/test-cases', icon: <FileTextOutlined />, label: '用例配置' },
  { key: '/executions', icon: <PlayCircleOutlined />, label: '任务执行' },
];

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        breakpoint="md"
        onBreakpoint={(broken) => {
          if (broken) setCollapsed(true);
        }}
      >
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <Title level={4} style={{ color: '#fff', margin: 0 }}>
            {collapsed ? 'MR' : 'Mobilerun'}
          </Title>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={[window.location.hash.replace('#', '') || '/devices']}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 16px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Title level={4} style={{ margin: 0 }}>
            mobilerun-web
          </Title>
        </Header>
        <Content
          style={{
            margin: 16,
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: 8,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/devices" replace />} />
          <Route path="devices" element={<DevicePage />} />
          <Route path="llm-config" element={<LLMConfigPage />} />
          <Route path="test-cases" element={<TestCasePage />} />
          <Route path="executions" element={<ExecutionPage />} />
          <Route path="executions/:id" element={<ExecutionDetailPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
