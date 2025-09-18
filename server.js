const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@apex-athletics.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');

const sessions = new Map();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon'
};

async function readJson(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  const raw = await fs.promises.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

async function writeJson(fileName, data) {
  const filePath = path.join(DATA_DIR, fileName);
  const tmpFile = `${filePath}.tmp`;
  await fs.promises.writeFile(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
  await fs.promises.rename(tmpFile, filePath);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    ...headers
  });
  res.end(text);
}

function notFound(res) {
  sendJson(res, 404, { message: '未找到资源' });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req
      .on('data', (chunk) => chunks.push(chunk))
      .on('end', () => {
        if (chunks.length === 0) {
          resolve(null);
          return;
        }
        const raw = Buffer.concat(chunks).toString('utf-8');
        try {
          const data = JSON.parse(raw || '{}');
          resolve(data);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

function createToken() {
  return crypto.randomBytes(32).toString('hex');
}

function authenticate(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.replace('Bearer ', '');
  const session = sessions.get(token);
  if (!session) {
    return null;
  }
  return session;
}

function requireAuth(req, res) {
  const session = authenticate(req);
  if (!session) {
    sendJson(res, 401, { message: '未授权访问，请重新登录。' });
    return null;
  }
  return session;
}

function sanitizeProduct(payload) {
  const {
    id,
    name,
    category,
    price,
    currency,
    description,
    image,
    features,
    inventory,
    badge
  } = payload || {};

  if (!name || !category || typeof price !== 'number') {
    return { valid: false, message: '产品名称、类别与价格为必填项。' };
  }

  return {
    valid: true,
    product: {
      id: id || `prod-${crypto.randomUUID()}`,
      name,
      category,
      price,
      currency: currency || 'CNY',
      description: description || '',
      image: image || '',
      features: Array.isArray(features) ? features : [],
      inventory: typeof inventory === 'number' ? inventory : 0,
      badge: badge || ''
    }
  };
}

async function serveStatic(res, filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const mime = mimeTypes[ext] || 'application/octet-stream';
    const stream = fs.createReadStream(filePath);
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=31536000'
    });
    stream.pipe(res);
  } catch (error) {
    if (error.code === 'ENOENT') {
      notFound(res);
    } else {
      sendText(res, 500, '服务器内部错误');
    }
  }
}

function resolveStaticPath(requestPath) {
  const decoded = decodeURIComponent(requestPath);
  if (decoded === '/' || decoded === '') {
    return path.join(PUBLIC_DIR, 'index.html');
  }
  const absolute = path.join(PUBLIC_DIR, decoded);
  return absolute;
}

async function handleLogin(req, res) {
  try {
    const body = await parseBody(req);
    if (!body || !body.email || !body.password) {
      sendJson(res, 400, { message: '请输入邮箱和密码。' });
      return;
    }
    if (body.email !== ADMIN_EMAIL || body.password !== ADMIN_PASSWORD) {
      sendJson(res, 401, { message: '账号或密码错误。' });
      return;
    }
    const token = createToken();
    const session = {
      email: ADMIN_EMAIL,
      issuedAt: Date.now()
    };
    sessions.set(token, session);
    sendJson(res, 200, {
      token,
      session
    });
  } catch (error) {
    sendJson(res, 400, { message: '登录失败，请检查请求格式。' });
  }
}

async function handleLogout(req, res) {
  const session = authenticate(req);
  if (session) {
    const token = req.headers['authorization'].replace('Bearer ', '');
    sessions.delete(token);
  }
  sendJson(res, 200, { message: '已退出登录' });
}

async function handleProducts(req, res, method, pathname) {
  if (method === 'GET' && pathname === '/api/products') {
    const products = await readJson('products.json');
    sendJson(res, 200, { items: products });
    return;
  }

  const idMatch = pathname.match(/^\/api\/products\/([^\/]+)$/);
  if (method === 'GET' && idMatch) {
    const products = await readJson('products.json');
    const product = products.find((item) => item.id === idMatch[1]);
    if (!product) {
      notFound(res);
      return;
    }
    sendJson(res, 200, product);
    return;
  }

  if (['POST', 'PUT', 'DELETE'].includes(method)) {
    const session = requireAuth(req, res);
    if (!session) {
      return;
    }
  }

  if (method === 'POST' && pathname === '/api/products') {
    try {
      const body = await parseBody(req);
      const { valid, product, message } = sanitizeProduct(body);
      if (!valid) {
        sendJson(res, 400, { message });
        return;
      }
      const products = await readJson('products.json');
      if (products.some((item) => item.id === product.id)) {
        sendJson(res, 400, { message: '产品 ID 已存在，请更换。' });
        return;
      }
      products.push(product);
      await writeJson('products.json', products);
      sendJson(res, 201, product);
    } catch (error) {
      sendJson(res, 400, { message: '无法解析产品数据。' });
    }
    return;
  }

  if (method === 'PUT' && idMatch) {
    try {
      const body = await parseBody(req);
      const products = await readJson('products.json');
      const index = products.findIndex((item) => item.id === idMatch[1]);
      if (index === -1) {
        notFound(res);
        return;
      }
      const current = products[index];
      const { valid, product, message } = sanitizeProduct({ ...current, ...body, id: current.id });
      if (!valid) {
        sendJson(res, 400, { message });
        return;
      }
      products[index] = product;
      await writeJson('products.json', products);
      sendJson(res, 200, product);
    } catch (error) {
      sendJson(res, 400, { message: '无法更新产品数据。' });
    }
    return;
  }

  if (method === 'DELETE' && idMatch) {
    const products = await readJson('products.json');
    const index = products.findIndex((item) => item.id === idMatch[1]);
    if (index === -1) {
      notFound(res);
      return;
    }
    const [removed] = products.splice(index, 1);
    await writeJson('products.json', products);
    sendJson(res, 200, removed);
    return;
  }

  notFound(res);
}

async function handleSite(req, res, method) {
  if (method === 'GET') {
    const site = await readJson('site.json');
    sendJson(res, 200, site);
    return;
  }

  if (method === 'PUT') {
    const session = requireAuth(req, res);
    if (!session) {
      return;
    }
    try {
      const body = await parseBody(req);
      const current = await readJson('site.json');
      const merged = {
        ...current,
        ...body,
        hero: {
          ...current.hero,
          ...(body.hero || {})
        },
        highlights: Array.isArray(body.highlights) ? body.highlights : current.highlights,
        consult: {
          ...current.consult,
          ...(body.consult || {})
        },
        footer: {
          ...current.footer,
          ...(body.footer || {})
        }
      };
      await writeJson('site.json', merged);
      sendJson(res, 200, merged);
    } catch (error) {
      sendJson(res, 400, { message: '站点信息更新失败。' });
    }
    return;
  }

  sendJson(res, 405, { message: '不支持的请求方式。' });
}

async function handleCheckout(req, res, method) {
  if (method !== 'POST') {
    sendJson(res, 405, { message: '仅支持 POST 请求。' });
    return;
  }
  try {
    const body = await parseBody(req);
    if (!body || !Array.isArray(body.items) || body.items.length === 0) {
      sendJson(res, 400, { message: '请提供有效的订单商品信息。' });
      return;
    }
    const products = await readJson('products.json');
    let total = 0;
    const resolvedItems = body.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        throw new Error('产品不存在');
      }
      const quantity = Number(item.quantity) || 1;
      total += product.price * quantity;
      return {
        productId: product.id,
        name: product.name,
        unitPrice: product.price,
        quantity
      };
    });

    const order = {
      id: `order-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      items: resolvedItems,
      customer: body.customer || {},
      payment: {
        method: (body.payment && body.payment.method) || 'offline',
        status: 'pending',
        reference: (body.payment && body.payment.reference) || ''
      },
      total
    };

    const orders = await readJson('orders.json');
    orders.push(order);
    await writeJson('orders.json', orders);

    sendJson(res, 200, {
      message: '订单已创建，请在后台完成支付网关配置。',
      order
    });
  } catch (error) {
    sendJson(res, 400, { message: error.message || '订单创建失败。' });
  }
}

async function handleOrders(req, res, method) {
  const session = requireAuth(req, res);
  if (!session) {
    return;
  }
  if (method === 'GET') {
    const orders = await readJson('orders.json');
    sendJson(res, 200, { items: orders });
    return;
  }
  sendJson(res, 405, { message: '不支持的请求方式。' });
}

function handleCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
}

const server = http.createServer(async (req, res) => {
  handleCors(req, res);
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = parsedUrl;
  const method = req.method.toUpperCase();

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    if (pathname.startsWith('/api/')) {
      if (pathname.startsWith('/api/auth/login') && method === 'POST') {
        await handleLogin(req, res);
        return;
      }
      if (pathname.startsWith('/api/auth/logout') && method === 'POST') {
        await handleLogout(req, res);
        return;
      }
      if (pathname.startsWith('/api/products')) {
        await handleProducts(req, res, method, pathname);
        return;
      }
      if (pathname === '/api/site') {
        await handleSite(req, res, method);
        return;
      }
      if (pathname === '/api/checkout') {
        await handleCheckout(req, res, method);
        return;
      }
      if (pathname === '/api/orders') {
        await handleOrders(req, res, method);
        return;
      }
      notFound(res);
      return;
    }

    const staticPath = resolveStaticPath(pathname);
    const normalized = path.normalize(staticPath);
    if (!normalized.startsWith(PUBLIC_DIR)) {
      sendText(res, 403, '禁止访问');
      return;
    }

    let fileToServe = normalized;
    let stat;
    try {
      stat = await fs.promises.stat(fileToServe);
    } catch (error) {
      fileToServe = path.join(PUBLIC_DIR, '404.html');
      try {
        await fs.promises.access(fileToServe);
        await serveStatic(res, fileToServe);
      } catch (err) {
        notFound(res);
      }
      return;
    }

    if (stat.isDirectory()) {
      fileToServe = path.join(fileToServe, 'index.html');
    }
    await serveStatic(res, fileToServe);
  } catch (error) {
    sendText(res, 500, '服务器内部错误');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
  console.log('默认管理员账号:', ADMIN_EMAIL);
});
