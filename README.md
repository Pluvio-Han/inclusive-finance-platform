# 普惠金融风险动态评估平台

“区域与行业大数据驱动的普惠金融风险动态评估平台”竞赛演示版本。

当前版本定位：
- 面向“三创赛”路演展示
- 前后端同源部署
- 完全离线资源可运行
- 目前以模拟数据驱动全链路演示，真实数据接入留作后续阶段

## 技术栈
- Backend: FastAPI
- Frontend: 原生 HTML / CSS / JavaScript
- Charts: ECharts
- Schema validation: Pydantic

## 核心功能
- 综合驾驶舱首页
- 行业演化视图
- 区域下钻规划
- 政策模拟平台
- 决策证据链面板
- 报告导出

## 项目结构
```text
inclusive-finance-platform/
├── backend/
│   ├── main.py
│   ├── data_provider.py
│   ├── schemas.py
│   └── requirements.txt
├── css/
├── js/
│   └── lib/
├── assets/
├── index.html
└── README.md
```

## 本地运行

### 1. 创建虚拟环境
```bash
cd /Users/evanhan/项目/三创赛/inclusive-finance-platform
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### 2. 启动后端
```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### 3. 浏览器访问
```text
http://127.0.0.1:8001
```

## 线上环境

### 域名
- https://pluviohan.com
- https://www.pluviohan.com

### 服务器
- Provider: 腾讯云 Lighthouse
- OS: Ubuntu Server 22.04 LTS 64bit
- Public IP: `106.53.76.27`

### 线上部署目录
```text
/opt/inclusive-finance-platform
```

### Python 虚拟环境
```text
/opt/inclusive-finance-platform/.venv
```

### systemd 服务
```bash
sudo systemctl status inclusive-finance
sudo systemctl restart inclusive-finance
sudo journalctl -u inclusive-finance -n 100 --no-pager
```

### Nginx
```bash
sudo nginx -t
sudo systemctl restart nginx
```

### HTTPS
- Certbot / Let's Encrypt
- 证书域名：`pluviohan.com`、`www.pluviohan.com`

## 重新部署线上版本

推荐流程：

1. 在本地修改代码
2. 提交到 GitHub
3. 将最新代码包同步到服务器
4. 覆盖 `/opt/inclusive-finance-platform`
5. 保留 `.venv`，重启 `inclusive-finance`

线上部署时请注意：
- 不要删除服务器上的 `.venv`，除非明确要重建依赖环境
- 静态资源路径使用相对路径，不要改成外链
- 本项目强调离线展示能力，不要引入 CDN

## 当前版本说明

当前 GitHub 仓库中的这一版属于“可路演、可部署、可演示”的稳定基线版本，具备：
- 域名访问
- HTTPS
- 腾讯云部署
- 手机端初步适配

后续建议演进方向：
- 补充真实数据接入层
- 继续优化移动端布局
- 完善 README 与部署脚本
- 增加线上自动化发布流程
