# Apex Athletics 独立站

一个针对体育器材品牌打造的无依赖 Node.js 独立站方案，包含前台展示、选购清单、预订单生成以及后台内容管理接口。项目默认提供示例数据，支持通过后台快速替换图片与文案，也可扩展接入第三方支付网关。

## 功能概览

- 🎯 **前台站点**：极简高端风格的产品展示页，包含产品矩阵、亮点说明、顾问预约表单与选购清单。
- 🛒 **预订单 & 支付接口占位**：访客可将器材加入清单并提交咨询，后端生成订单记录，预留支付网关接入点。
- 🛠️ **后台管理**：内置登录认证、产品 CRUD、站点内容配置及订单查看功能，支持一键导出 JSON。
- ⚙️ **可配置数据源**：所有展示数据存放在 `data/*.json` 中，易于版本管理与自动化部署。

## 快速开始

```bash
npm install   # 无外部依赖，可跳过
npm run dev   # 等价于 `node server.js`
```

服务器默认监听 `http://0.0.0.0:3000`。若需修改端口，可在启动前设置环境变量：

```bash
export PORT=4000
node server.js
```

### 管理员账号

- 邮箱：`admin@apex-athletics.com`
- 密码：`ChangeMe123!`

建议在生产环境中通过环境变量覆盖：

```bash
export ADMIN_EMAIL="you@example.com"
export ADMIN_PASSWORD="StrongPassword"
```

## 数据结构

- `data/site.json`：站点品牌、Hero 区文案、亮点、底部联系方式等。
- `data/products.json`：前台展示的产品列表。
- `data/orders.json`：访客提交的预订单记录。

所有接口均为 JSON 格式，支持通过后台或直接编辑文件管理。

## API 速览

| 方法 | 路径 | 说明 |
| ---- | ---- | ---- |
| POST | `/api/auth/login` | 管理员登录，返回 Bearer token |
| POST | `/api/auth/logout` | 退出登录 |
| GET  | `/api/products` | 获取产品列表（公开） |
| POST | `/api/products` | 新增产品（需登录） |
| PUT  | `/api/products/:id` | 更新产品（需登录） |
| DELETE | `/api/products/:id` | 删除产品（需登录） |
| GET  | `/api/site` | 获取站点配置（公开） |
| PUT  | `/api/site` | 更新站点配置（需登录） |
| POST | `/api/checkout` | 提交预订单，生成订单记录 |
| GET  | `/api/orders` | 获取订单列表（需登录） |

所有需鉴权接口请在 Header 中携带 `Authorization: Bearer <token>`。

## 支付网关对接建议

当前的 `/api/checkout` 会将订单信息写入 `data/orders.json`，默认支付状态为 `pending`。如需接入 Stripe / 微信支付 / 支付宝，可在该路由中：

1. 读取访客提交的商品列表和客户信息。
2. 调用第三方支付 SDK 或 HTTPS API 创建支付意向。
3. 将返回的支付链接或二维码写入订单 `payment.reference` 字段，以便后台查看。

## 自定义图片与文案

- **图片**：将新的图片文件放入 `public/assets/` 并在后台或 JSON 中更新路径即可，支持相对路径或外链。
- **文案**：在后台「站点配置」中修改 hero、亮点、顾问区和页脚信息，或直接编辑 `data/site.json`。
- **产品信息**：在后台「产品管理」页增删改产品，支持批量粘贴特性（每行一条）。

## 部署建议

- 使用 `pm2`、`systemd` 或 Docker 运行 `node server.js`。
- 配置反向代理（Nginx / Caddy）以启用 HTTPS，并转发到 Node 服务。
- 定期备份 `data/` 目录以保留产品与订单数据。

## 许可证

MIT License
