# 基金backtest

一个基于 Next.js 和 akshare 的基金定投回测网站，支持输入基金代码、定义定投方式，并绘制定投成本曲线和价格趋势曲线。

## 功能特性

- 📊 基金数据获取：使用 akshare 获取基金历史净值数据
- 💰 定投回测：支持每日、每周、每月三种定投频率
- 📈 可视化图表：绘制定投成本曲线和基金价格趋势曲线
- 📅 日期范围选择：支持自定义回测时间范围
- 📊 统计信息：显示累计投资、当前市值、盈亏金额、收益率等

## 安装步骤

### 1. 安装 Node.js 依赖

```bash
npm install
```

### 2. 安装 Python 依赖（使用 venv）

项目使用 Python venv 虚拟环境管理依赖：

```bash
# 创建虚拟环境
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate  # Windows

# 升级 pip
pip install --upgrade pip

# 安装依赖
pip install -r requirements.txt
```

**注意**：API 路由会自动使用项目根目录下的 `venv` 环境中的 Python。如果 venv 在其他位置，可以在 `.env.local` 文件中设置 `VENV_PYTHON` 环境变量。

### 3. 运行开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

## 使用方法

1. 在输入框中输入基金代码（例如：000001）
2. 设置每次投资金额
3. 选择定投频率（每日/每周/每月）
4. （可选）设置开始日期和结束日期
5. 点击"开始回测"按钮
6. 查看回测结果和图表

## 技术栈

- **前端框架**: Next.js 14
- **图表库**: Recharts
- **数据获取**: akshare (Python)
- **样式**: CSS3

## 项目结构

```
dca-fe/
├── app/
│   ├── api/
│   │   ├── fund/
│   │   │   └── route.ts          # 基金数据 API
│   │   └── backtest/
│   │       └── route.ts          # 回测计算 API
│   ├── globals.css               # 全局样式
│   ├── layout.tsx                # 根布局
│   └── page.tsx                  # 主页面
├── scripts/
│   └── get_fund_data.py          # Python 脚本（获取基金数据）
├── package.json
├── requirements.txt              # Python 依赖
└── README.md
```

## 注意事项

- 基金代码格式：请使用正确的基金代码格式（例如：000001）
- Python 环境：确保系统已安装 Python 3 和 akshare 库
- 数据来源：基金数据来自 akshare，数据准确性取决于数据源

## 开发

```bash
# 开发模式
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start
```
