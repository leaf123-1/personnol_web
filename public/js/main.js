const state = {
  products: [],
  cart: [],
  site: null
};

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`请求失败: ${res.status}`);
  }
  return res.json();
}

function formatCurrency(value, currency = 'CNY') {
  try {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency
    }).format(value);
  } catch (error) {
    return `￥${value}`;
  }
}

function updateHero(site) {
  const title = document.getElementById('heroTitle');
  const subtitle = document.getElementById('heroSubtitle');
  const heroMedia = document.getElementById('heroMedia');
  const primaryAction = document.getElementById('heroPrimaryAction');
  const secondaryAction = document.getElementById('heroSecondaryAction');
  if (!site) return;

  title.textContent = site.hero?.title ?? title.textContent;
  subtitle.textContent = site.hero?.subtitle ?? subtitle.textContent;
  if (site.hero?.backgroundImage) {
    heroMedia.style.backgroundImage = `url('${site.hero.backgroundImage}')`;
  }
  if (site.hero?.primaryAction) {
    primaryAction.textContent = site.hero.primaryAction.label ?? primaryAction.textContent;
    primaryAction.href = site.hero.primaryAction.href ?? primaryAction.getAttribute('href');
  }
  if (site.hero?.secondaryAction) {
    secondaryAction.textContent = site.hero.secondaryAction.label ?? secondaryAction.textContent;
    secondaryAction.href = site.hero.secondaryAction.href ?? secondaryAction.getAttribute('href');
  }
}

function updateHighlights(highlights = []) {
  const grid = document.getElementById('highlightGrid');
  if (!grid) return;
  grid.innerHTML = '';
  highlights.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'highlight-card';
    card.innerHTML = `
      <h3>${item.title}</h3>
      <p>${item.description}</p>
    `;
    grid.appendChild(card);
  });
}

function updateFooter(site) {
  if (!site) return;
  const brand = document.getElementById('brandName');
  const footerBrand = document.getElementById('footerBrand');
  const footerEmail = document.getElementById('footerEmail');
  const footerPhone = document.getElementById('footerPhone');
  const footerAddress = document.getElementById('footerAddress');
  brand.textContent = site.brand ?? brand.textContent;
  footerBrand.textContent = site.brand ?? footerBrand.textContent;
  if (site.footer?.email) {
    footerEmail.textContent = site.footer.email;
    footerEmail.href = `mailto:${site.footer.email}`;
  }
  if (site.footer?.phone) {
    footerPhone.textContent = site.footer.phone;
    footerPhone.href = `tel:${site.footer.phone.replace(/\s+/g, '')}`;
  }
  if (site.footer?.address) {
    footerAddress.textContent = site.footer.address;
  }
  if (site.consult) {
    const consultTitle = document.getElementById('consultTitle');
    const consultDescription = document.getElementById('consultDescription');
    consultTitle.textContent = site.consult.title ?? consultTitle.textContent;
    consultDescription.textContent = site.consult.description ?? consultDescription.textContent;
  }
  document.getElementById('footerYear').textContent = new Date().getFullYear();
}

function createFeatureList(features = []) {
  const list = document.createDocumentFragment();
  features.forEach((feature) => {
    const li = document.createElement('li');
    li.textContent = feature;
    list.appendChild(li);
  });
  return list;
}

function renderProducts(products = []) {
  const grid = document.getElementById('productGrid');
  const template = document.getElementById('productCardTemplate');
  grid.innerHTML = '';
  products.forEach((product) => {
    const node = template.content.cloneNode(true);
    const article = node.querySelector('.product-card');
    const badge = node.querySelector('.product-badge');
    const img = node.querySelector('img');
    const name = node.querySelector('.product-name');
    const category = node.querySelector('.product-category');
    const description = node.querySelector('.product-description');
    const features = node.querySelector('.product-features');
    const price = node.querySelector('.product-price');
    const inventory = node.querySelector('.product-inventory');
    const addButton = node.querySelector('.add-to-cart');

    if (product.badge) {
      badge.textContent = product.badge;
    } else {
      badge.remove();
    }

    img.src = product.image || '/assets/hero.svg';
    img.alt = `${product.name} 产品图片`;
    name.textContent = product.name;
    category.textContent = product.category;
    description.textContent = product.description;
    features.innerHTML = '';
    features.appendChild(createFeatureList(product.features));
    price.textContent = formatCurrency(product.price, product.currency);
    inventory.textContent = `库存：${product.inventory} 台`;

    addButton.addEventListener('click', () => {
      addToCart(product.id);
    });

    grid.appendChild(node);
    article.dataset.productId = product.id;
  });
}

function addToCart(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;
  const existing = state.cart.find((item) => item.productId === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({ productId, quantity: 1 });
  }
  updateCartUI();
  openCart();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter((item) => item.productId !== productId);
  updateCartUI();
}

function updateQuantity(productId, delta) {
  const entry = state.cart.find((item) => item.productId === productId);
  if (!entry) return;
  entry.quantity += delta;
  if (entry.quantity <= 0) {
    removeFromCart(productId);
    return;
  }
  updateCartUI();
}

function calculateCartTotal() {
  let total = 0;
  state.cart.forEach((item) => {
    const product = state.products.find((p) => p.id === item.productId);
    if (product) {
      total += product.price * item.quantity;
    }
  });
  return total;
}

function updateCartUI() {
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById('cartCount').textContent = count;
  const list = document.getElementById('cartItems');
  list.innerHTML = '';

  state.cart.forEach((item) => {
    const product = state.products.find((p) => p.id === item.productId);
    if (!product) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'cart-item';
    wrapper.innerHTML = `
      <header>
        <strong>${product.name}</strong>
        <button aria-label="移除" data-action="remove">✕</button>
      </header>
      <p>${product.category}</p>
      <footer>
        <div class="cart-quantity">
          <button data-action="decrease">-</button>
          <span>${item.quantity}</span>
          <button data-action="increase">+</button>
        </div>
        <span>${formatCurrency(product.price * item.quantity, product.currency)}</span>
      </footer>
    `;
    wrapper.dataset.productId = product.id;
    list.appendChild(wrapper);
  });

  document.getElementById('cartTotal').textContent = formatCurrency(calculateCartTotal());
}

function openCart() {
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartDrawer').setAttribute('aria-hidden', 'false');
}

function closeCart() {
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('cartDrawer').setAttribute('aria-hidden', 'true');
}

function bindCartEvents() {
  const drawer = document.getElementById('cartDrawer');
  drawer.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const card = target.closest('.cart-item');
    if (!card) return;
    const productId = card.dataset.productId;
    switch (target.dataset.action) {
      case 'remove':
        removeFromCart(productId);
        break;
      case 'increase':
        updateQuantity(productId, 1);
        break;
      case 'decrease':
        updateQuantity(productId, -1);
        break;
      default:
        break;
    }
  });
}

async function initialise() {
  try {
    const [site, productResponse] = await Promise.all([
      fetchJSON('/api/site'),
      fetchJSON('/api/products')
    ]);
    state.site = site;
    state.products = productResponse.items ?? [];
    updateHero(site);
    updateHighlights(site.highlights ?? []);
    updateFooter(site);
    renderProducts(state.products);
  } catch (error) {
    console.error('初始化数据失败', error);
  }
}

async function submitCheckout(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (state.cart.length === 0) {
    alert('请先添加产品到选购清单。');
    return;
  }
  const formData = new FormData(form);
  const payload = {
    items: state.cart.map((item) => ({
      productId: item.productId,
      quantity: item.quantity
    })),
    customer: {
      company: formData.get('company'),
      contact: formData.get('contact'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      notes: formData.get('notes')
    },
    payment: {
      method: 'offline'
    }
  };
  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: '提交失败' }));
      throw new Error(error.message);
    }
    const data = await res.json();
    alert('预订单已创建，我们将尽快与您联系。');
    form.reset();
    state.cart = [];
    updateCartUI();
    closeCart();
    console.log('订单信息', data);
  } catch (error) {
    alert(error.message || '提交失败，请稍后再试。');
  }
}

function bindUI() {
  document.getElementById('cartToggle').addEventListener('click', openCart);
  document.getElementById('cartClose').addEventListener('click', closeCart);
  bindCartEvents();
  document.getElementById('checkoutForm').addEventListener('submit', submitCheckout);
  document.getElementById('exploreAll').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.products, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'apex-athletics-products.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

bindUI();
initialise();
