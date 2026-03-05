# OpenClaw Healthcare

基于 Next.js 构建的健康管理 Dashboard 应用，提供健康数据概览和 AI 健康助手聊天功能。

## 功能特性

- **用户认证** — 基于 NextAuth v5 的登录系统，支持凭证认证，中间件自动保护路由
- **健康数据概览** — Dashboard 展示四项核心健康指标（步数、心率、睡眠、体重），含趋势分析
- **AI 健康助手** — 内置聊天组件，支持关键词识别与模拟流式响应，可根据用户健康数据提供个性化建议
- **响应式布局** — 侧边栏导航 + 顶部用户菜单，适配桌面和移动端

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS v4 |
| UI 组件 | shadcn/ui + Radix UI |
| 认证 | NextAuth v5 |
| 图标 | Lucide React |
| 运行时 | Bun |

## 项目结构

```
src/
├── app/
│   ├── api/auth/[...nextauth]/   # NextAuth API 路由
│   ├── dashboard/
│   │   ├── layout.tsx            # Dashboard 布局（侧边栏 + 顶栏）
│   │   └── page.tsx              # 健康数据概览 + 聊天助手
│   ├── login/page.tsx            # 登录页
│   ├── layout.tsx                # 根布局
│   └── page.tsx                  # 首页（自动跳转）
├── components/
│   ├── ui/                       # shadcn/ui 基础组件
│   ├── dashboard-header.tsx      # 顶部导航栏（用户头像 + 下拉菜单）
│   ├── dashboard-sidebar.tsx     # 侧边栏导航
│   ├── health-chat.tsx           # AI 健康助手聊天组件
│   └── login-form.tsx            # 登录表单
├── lib/
│   ├── auth.ts                   # NextAuth 配置 + 路由保护回调
│   ├── health-responses.ts       # 健康助手关键词匹配 + 响应生成
│   └── utils.ts                  # 工具函数
└── middleware.ts                  # 路由中间件（认证守卫）
```

## 快速开始

### 前置要求

- [Bun](https://bun.sh/) (推荐) 或 Node.js 18+

### 安装与运行

```bash
# 克隆项目
git clone <repo-url>
cd openclaw-healthcare

# 安装依赖
bun install

# 启动开发服务器
bun dev
```

访问 http://localhost:3000 查看应用。

### 演示账户

| 邮箱 | 密码 |
|------|------|
| admin@openclaw.com | admin123 |

### 构建生产版本

```bash
bun build
bun start
```

## 页面流程

1. 访问首页 → 未登录自动跳转到 `/login`，已登录跳转到 `/dashboard`
2. 登录页 → 输入演示账户凭证完成认证
3. Dashboard → 查看健康指标卡片（步数、心率、睡眠、体重）
4. 健康助手 → 在聊天框中输入问题，获取基于个人数据的健康建议
