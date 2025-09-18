const state = {
  token: localStorage.getItem('apex_admin_token') || '',
  session: null,
  products: [],
  site: null,
  orders: []
};

const panels = document.querySelectorAll('.panel');
const navButtons = document.querySelectorAll('.sidebar nav button');

function setActivePanel(id) {
  panels.forEach((panel) => panel.classList.toggle('hidden', panel.id !== id));
  navButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.panel === id);
  });
}

function requireAuth() {
  if (!state.token) {
    alert('请先登录管理员账号。');
    setActivePanel('login');
    return false;
  }
  return true;
}

function setToken(token, session) {
  state.token = token;
  state.session = session;
  if (token) {
    localStorage.setItem('apex_admin_token', token);
    document.getElementById('sessionInfo').textContent = `已登录：${session?.email ?? ''}`;
  } else {
    localStorage.removeItem('apex_admin_token');
    document.getElementById('sessionInfo').textContent = '';
  }
}

async function apiFetch(path, options = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  const response = await fetch(path, {
    ...options,
    headers
  });
  if (!response.ok) {
    let error = '请求失败';
    try {
      const body = await response.json();
      error = body.message || error;
    } catch (err) {
      // ignore
    }
    throw new Error(error);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  try {
    const data = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: formData.get('email'),
        password: formData.get('password')
      })
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: '登录失败' }));
        throw new Error(err.message);
      }
      return res.json();
    });
    setToken(data.token, data.session);
    setActivePanel('products');
    await loadProducts();
    await loadSite();
    await loadOrders();
    alert('登录成功。');
  } catch (error) {
    alert(error.message || '登录失败');
  }
}

async function loadProducts() {
  const data = await apiFetch('/api/products');
  state.products = data.items ?? [];
  renderProducts();
}

function renderProducts() {
  const list = document.getElementById('productList');
  list.innerHTML = '';
  state.products.forEach((product) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <header>
        <strong>${product.name}</strong>
        <div class="actions">
          <button data-action="edit">编辑</button>
          <button data-action="delete">删除</button>
        </div>
      </header>
      <p>${product.description || ''}</p>
      <small>${product.category} · ${product.badge || '无标签'}</small>
      <footer>
        <span>${product.currency || 'CNY'} ${product.price}</span>
        <span>库存：${product.inventory}</span>
      </footer>
    `;
    li.dataset.id = product.id;
    list.appendChild(li);
  });
}

function getProductFormData(form) {
  const data = new FormData(form);
  return {
    id: data.get('id') || undefined,
    name: data.get('name'),
    category: data.get('category'),
    price: Number(data.get('price')),
    currency: data.get('currency') || 'CNY',
    description: data.get('description') || '',
    image: data.get('image') || '',
    features: (data.get('features') || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
    inventory: Number(data.get('inventory') || 0),
    badge: data.get('badge') || ''
  };
}

async function handleProductSubmit(event) {
  event.preventDefault();
  if (!requireAuth()) return;
  const form = event.currentTarget;
  const payload = getProductFormData(form);
  try {
    if (payload.id) {
      await apiFetch(`/api/products/${payload.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      const created = await apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      payload.id = created.id;
    }
    form.reset();
    await loadProducts();
    alert('产品保存成功');
  } catch (error) {
    alert(error.message || '保存失败');
  }
}

function fillProductForm(product) {
  const form = document.getElementById('productForm');
  const fields = form.elements;
  fields.namedItem('id').value = product.id;
  fields.namedItem('name').value = product.name;
  fields.namedItem('category').value = product.category;
  fields.namedItem('price').value = product.price;
  fields.namedItem('currency').value = product.currency;
  fields.namedItem('description').value = product.description;
  fields.namedItem('features').value = product.features.join('\n');
  fields.namedItem('inventory').value = product.inventory;
  fields.namedItem('badge').value = product.badge;
  fields.namedItem('image').value = product.image;
  setActivePanel('products');
}

async function deleteProduct(id) {
  if (!confirm('确定删除该产品吗？')) return;
  await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
  await loadProducts();
}

function bindProductListEvents() {
  document.getElementById('productList').addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const li = target.closest('li');
    if (!li) return;
    const product = state.products.find((item) => item.id === li.dataset.id);
    if (!product) return;
    if (target.dataset.action === 'edit') {
      fillProductForm(product);
    }
    if (target.dataset.action === 'delete') {
      try {
        await deleteProduct(product.id);
      } catch (error) {
        alert(error.message || '删除失败');
      }
    }
  });
}

async function loadSite() {
  state.site = await apiFetch('/api/site');
  const form = document.getElementById('siteForm');
  const fields = form.elements;
  fields.namedItem('brand').value = state.site.brand ?? '';
  fields.namedItem('heroTitle').value = state.site.hero?.title ?? '';
  fields.namedItem('heroSubtitle').value = state.site.hero?.subtitle ?? '';
  fields.namedItem('heroImage').value = state.site.hero?.backgroundImage ?? '';
  fields.namedItem('highlights').value = JSON.stringify(state.site.highlights ?? [], null, 2);
  fields.namedItem('consult').value = JSON.stringify(state.site.consult ?? {}, null, 2);
  fields.namedItem('footer').value = JSON.stringify(state.site.footer ?? {}, null, 2);
}

async function handleSiteSubmit(event) {
  event.preventDefault();
  if (!requireAuth()) return;
  const form = event.currentTarget;
  try {
    const payload = {
      brand: form.brand.value,
      hero: {
        title: form.heroTitle.value,
        subtitle: form.heroSubtitle.value,
        backgroundImage: form.heroImage.value
      },
      highlights: JSON.parse(form.highlights.value || '[]'),
      consult: JSON.parse(form.consult.value || '{}'),
      footer: JSON.parse(form.footer.value || '{}')
    };
    state.site = await apiFetch('/api/site', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    alert('站点配置已更新');
  } catch (error) {
    alert(error.message || '更新失败，请检查 JSON 格式。');
  }
}

async function loadOrders() {
  if (!requireAuth()) return;
  state.orders = (await apiFetch('/api/orders')).items ?? [];
  renderOrders();
}

function renderOrders() {
  const list = document.getElementById('orderList');
  list.innerHTML = '';
  state.orders
    .slice()
    .reverse()
    .forEach((order) => {
      const li = document.createElement('li');
      const total = order.total || 0;
      li.innerHTML = `
        <header>
          <strong>${order.customer?.company || '未填写机构'}</strong>
          <span>${new Date(order.createdAt).toLocaleString()}</span>
        </header>
        <p>${order.customer?.contact || '访客'} · ${order.customer?.phone || '无电话'}</p>
        <small>${order.customer?.email || '无邮箱'}</small>
        <ul>
          ${order.items
            .map(
              (item) => `
                <li>${item.name} × ${item.quantity} · ￥${item.unitPrice}</li>
              `
            )
            .join('')}
        </ul>
        <footer>
          <span>总额：￥${total}</span>
          <span>支付方式：${order.payment?.method || 'offline'}</span>
        </footer>
      `;
      list.appendChild(li);
    });
}

function bindNavigation() {
  navButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const panel = button.dataset.panel;
      if (panel !== 'login' && !requireAuth()) {
        return;
      }
      setActivePanel(panel);
      if (panel === 'products') {
        await loadProducts();
      } else if (panel === 'site') {
        await loadSite();
      } else if (panel === 'orders') {
        await loadOrders();
      }
    });
  });
}

function bindForms() {
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('productForm').addEventListener('submit', handleProductSubmit);
  document.getElementById('siteForm').addEventListener('submit', handleSiteSubmit);
  document.getElementById('resetProduct').addEventListener('click', () => {
    document.getElementById('productForm').reset();
  });
  document.getElementById('refreshOrders').addEventListener('click', loadOrders);
}

async function tryRestoreSession() {
  if (!state.token) return;
  try {
    state.site = await apiFetch('/api/site');
    setToken(state.token, { email: state.session?.email || '管理员' });
    await Promise.all([loadProducts(), loadOrders()]);
    setActivePanel('products');
  } catch (error) {
    console.warn('会话失效', error);
    setToken('', null);
    setActivePanel('login');
  }
}

bindNavigation();
bindForms();
bindProductListEvents();
tryRestoreSession();
