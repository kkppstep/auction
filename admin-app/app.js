// ============================================================
// State
// ============================================================
const state = {
  apiBase: localStorage.getItem('apiBase') || (window.POS_CONFIG && window.POS_CONFIG.CLOUD_API_BASE) || '',
  customerAppUrl: localStorage.getItem('customerAppUrl') || '',
  token: localStorage.getItem('token') || '',
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  tenant: null,
  features: {}, // tenants.feature_overrides — which gated tabs this tenant can see, set by platform admin
  stores: [],
  categories: [],
  products: [],
  storeId: localStorage.getItem('storeId') || '',
};

function persist(key, value) {
  state[key] = value;
  localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : (value || ''));
}

function logout() {
  ['token', 'user', 'storeId'].forEach((k) => localStorage.removeItem(k));
  state.token = '';
  state.user = null;
  state.storeId = '';
  state.features = {};
  document.querySelectorAll('.feature-nav-item').forEach((el) => { el.hidden = true; });
  switchTab('login');
}

// Shows/hides sidebar tabs gated by tenant.feature_overrides. Also
// checked server-side on the actual endpoints (cloud-api's
// middleware/features.js) — this is convenience, not the real gate.
function applyFeatureVisibility() {
  document.querySelectorAll('.feature-nav-item').forEach((el) => {
    el.hidden = state.features[el.dataset.feature] !== true;
  });
}

// ============================================================
// API helper
// ============================================================
async function api(path, options = {}) {
  const res = await fetch(`${state.apiBase}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401) {
    logout();
    throw new Error('Session expired — please log in again.');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${text}`);
  }
  return res.json();
}

// ============================================================
// Navigation
// ============================================================
const TABS = {
  login: renderLogin,
  business: renderBusiness,
  stores: renderStores,
  categories: renderCategories,
  products: renderProducts,
  provisioning: renderProvisioning,
  qrcodes: renderQrCodes,
  staff: renderStaff,
  liveOrders: renderLiveOrders,
  orders: renderOrders,
  analytics: renderAnalytics,
};

let liveOrdersInterval = null;

function switchTab(tab) {
  if (tab !== 'login' && !state.token) tab = 'login';
  if (liveOrdersInterval) { clearInterval(liveOrdersInterval); liveOrdersInterval = null; }
  document.querySelectorAll('.nav-item').forEach((el) => el.classList.toggle('active', el.dataset.tab === tab));
  updateContextBar();
  TABS[tab]();
}

document.querySelectorAll('.nav-item[data-tab]').forEach((el) => el.addEventListener('click', () => switchTab(el.dataset.tab)));

function updateContextBar() {
  const store = state.stores.find((s) => s.id === state.storeId);
  document.getElementById('contextBar').innerHTML = state.user ? `
    ${escapeHtml(state.user.email)}<br>
    ${store ? `Store: ${escapeHtml(store.name)} (${escapeHtml(store.my_role || '')})` : 'No store selected'}<br>
    <a href="#" id="logoutLink" style="color:var(--gold)">Log out</a>
  ` : '';
  document.getElementById('logoutLink')?.addEventListener('click', (e) => { e.preventDefault(); logout(); });
}

function setContent(html) { document.getElementById('content').innerHTML = html; }
function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str ?? ''; return d.innerHTML; }

// ============================================================
// Reusable drag-and-drop file upload
// Wires a drop-zone element to: drag/drop, click-to-browse, upload via
// POST /admin/uploads, and fill the resulting URL into a target input.
// ============================================================
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function attachUploadZone(zoneId, inputId, statusId) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  const status = document.getElementById(statusId);
  if (!zone) return;

  async function handleFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { status.textContent = 'File is larger than 5MB — use a smaller file.'; return; }
    status.textContent = 'Uploading…';
    try {
      const data = await fileToBase64(file);
      const result = await api('/admin/uploads', { method: 'POST', body: { filename: file.name, contentType: file.type, data } });
      input.value = result.url;
      status.textContent = `Uploaded: ${escapeHtml(file.name)}`;
    } catch (err) {
      status.textContent = `Upload failed: ${err.message}`;
    }
  }

  zone.addEventListener('click', () => {
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.onchange = () => handleFile(picker.files[0]);
    picker.click();
  });
  ['dragover', 'dragenter'].forEach((evt) => zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.add('drag-active'); }));
  ['dragleave', 'drop'].forEach((evt) => zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.remove('drag-active'); }));
  zone.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));
}

function dropZoneHtml(zoneId, label) {
  return `<div class="drop-zone" id="${zoneId}">${label}<div class="drop-zone-status" id="${zoneId}-status"></div></div>`;
}

// ============================================================
// Reusable menu-theme fields: preset dropdown + custom controls.
// Shared between store creation and the per-store edit row via a
// unique `prefix` so element ids don't collide.
// ============================================================
function themeFieldsHtml(prefix, current) {
  const theme = current || { preset: 'green' };
  const preset = theme.preset || 'green';
  const layout = theme.layout || 'standard';
  return `
    <div class="field"><label>Menu theme</label>
      <select id="${prefix}-preset">
        <option value="green" ${preset === 'green' ? 'selected' : ''}>Green (default)</option>
        <option value="cozy" ${preset === 'cozy' ? 'selected' : ''}>Cozy (warm browns)</option>
        <option value="ice" ${preset === 'ice' ? 'selected' : ''}>Ice (cool blues)</option>
        <option value="custom" ${preset === 'custom' ? 'selected' : ''}>Custom</option>
      </select>
    </div>
    <div id="${prefix}-custom-fields" ${preset === 'custom' ? '' : 'hidden'}>
      <div class="field"><label>Accent color</label>
        <input id="${prefix}-primary" type="color" value="${theme.primary_color || '#1B7A3D'}" style="height:40px;padding:4px;">
      </div>
      <div class="field"><label>Background gradient (optional, ignored if an image is set)</label>
        <div style="display:flex;gap:10px;">
          <input id="${prefix}-gradFrom" type="color" value="${theme.gradient_from || '#ffffff'}" style="height:40px;padding:4px;flex:1;">
          <input id="${prefix}-gradTo" type="color" value="${theme.gradient_to || '#ffffff'}" style="height:40px;padding:4px;flex:1;">
        </div>
      </div>
      <div class="field"><label>Background image (optional, overrides gradient)</label>
        ${dropZoneHtml(`${prefix}-bgDrop`, 'Drag a background image here, or click to browse')}
        <input id="${prefix}-bgUrl" value="${escapeHtml(theme.background_image_url || '')}" placeholder="https://.../background.jpg">
      </div>
    </div>
    <div class="field"><label>Menu layout</label>
      <select id="${prefix}-layout">
        <option value="standard" ${layout === 'standard' ? 'selected' : ''}>Standard — scrolling card list</option>
        <option value="stage" ${layout === 'stage' ? 'selected' : ''}>Stage — dark, premium hero dish view</option>
      </select>
    </div>
  `;
}

function wireThemeFields(prefix) {
  const presetSelect = document.getElementById(`${prefix}-preset`);
  const customFields = document.getElementById(`${prefix}-custom-fields`);
  presetSelect.addEventListener('change', () => {
    customFields.hidden = presetSelect.value !== 'custom';
  });
  attachUploadZone(`${prefix}-bgDrop`, `${prefix}-bgUrl`, `${prefix}-bgDrop-status`);
}

function collectThemeConfig(prefix) {
  const preset = document.getElementById(`${prefix}-preset`).value;
  const layout = document.getElementById(`${prefix}-layout`).value;
  if (preset !== 'custom') return { preset, layout };
  return {
    preset: 'custom',
    layout,
    primary_color: document.getElementById(`${prefix}-primary`).value,
    gradient_from: document.getElementById(`${prefix}-gradFrom`).value,
    gradient_to: document.getElementById(`${prefix}-gradTo`).value,
    background_image_url: document.getElementById(`${prefix}-bgUrl`).value.trim() || null,
  };
}

// ============================================================
// Login (and one-time tenant bootstrap for the platform operator)
// ============================================================
function renderLogin() {
  setContent(`
    <h1>Log in</h1>
    <div class="subtitle">Business owners: sign in with Google. Staff: use the email/password your owner gave you.</div>
    <div class="card" style="max-width:420px;">
      <div class="field"><label>Cloud API URL</label><input id="apiBaseInput" value="${escapeHtml(state.apiBase)}" placeholder="https://your-api.vercel.app"></div>
      <button class="btn" id="googleSignInBtn" style="background:#fff;color:var(--text);border:1px solid var(--ivory-dim);width:100%;margin-bottom:14px;">Sign in with Google</button>
      <div style="text-align:center;color:var(--text-muted);font-size:0.8rem;margin-bottom:14px;">— staff log in —</div>
      <div class="field"><label>Email</label><input id="loginEmail"></div>
      <div class="field"><label>Password</label><input id="loginPassword" type="password"></div>
      <button class="btn" id="loginBtn">Log in</button>
      <div id="loginResult" style="margin-top:12px;"></div>
    </div>
  `);

  document.getElementById('googleSignInBtn').addEventListener('click', async () => {
    persist('apiBase', document.getElementById('apiBaseInput').value.replace(/\/$/, ''));
    const supa = getSupabaseClient();
    if (!supa) {
      document.getElementById('loginResult').innerHTML = `<span style="color:#A6301F">Google sign-in isn't configured (missing SUPABASE_URL/SUPABASE_ANON_KEY).</span>`;
      return;
    }
    await supa.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
  });

  document.getElementById('loginBtn').addEventListener('click', async () => {
    persist('apiBase', document.getElementById('apiBaseInput').value.replace(/\/$/, ''));
    const resultEl = document.getElementById('loginResult');
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: { email: document.getElementById('loginEmail').value.trim(), password: document.getElementById('loginPassword').value },
      });
      persist('token', data.token);
      persist('user', data.user);
      state.stores = data.stores.map((s) => ({ id: s.store_id, name: s.store_name, my_role: s.role }));
      resultEl.innerHTML = `<span style="color:#2C5A28">Logged in as ${escapeHtml(data.user.email)}.</span>`;
      await loadTenantFeatures();
      switchTab('business');
    } catch (err) {
      resultEl.innerHTML = `<span style="color:#A6301F">${escapeHtml(err.message)}</span>`;
    }
  });
}

// ============================================================
// Business (read-only tenant info)
// ============================================================
// Called right after any successful login (password or Google) so the
// sidebar reflects the tenant's enabled features immediately, without
// waiting for the user to visit the Business tab first.
async function loadTenantFeatures() {
  try {
    const tenant = await api('/admin/tenants/me');
    state.tenant = tenant;
    state.features = tenant.feature_overrides || {};
    applyFeatureVisibility();
  } catch (err) {
    console.error('[features] failed to load tenant features:', err.message);
  }
}

async function renderBusiness() {
  setContent(`<h1>Business</h1><div id="bizInfo">Loading…</div>`);
  try {
    const tenant = await api('/admin/tenants/me');
    state.tenant = tenant;
    state.features = tenant.feature_overrides || {};
    applyFeatureVisibility();
    const enabledFeatures = Object.entries(state.features).filter(([, v]) => v === true).map(([k]) => k);
    document.getElementById('bizInfo').innerHTML = `
      <div class="card">
        <div class="field"><label>Name</label><div>${escapeHtml(tenant.business_name)}</div></div>
        <div class="field"><label>Contact email</label><div>${escapeHtml(tenant.contact_email || '—')}</div></div>
        <div class="field"><label>Subscription status</label><div>${escapeHtml(tenant.subscription_status)}</div></div>
        <div class="field"><label>Enabled features</label><div>${
          enabledFeatures.length ? enabledFeatures.map((f) => `<span class="pill synced" style="margin-right:4px;">${escapeHtml(f)}</span>`).join('') : '<span class="state-message" style="padding:0;">None yet — contact the platform operator to enable extra features.</span>'
        }</div></div>
      </div>
    `;
  } catch (err) {
    document.getElementById('bizInfo').innerHTML = `<div class="state-message error">${escapeHtml(err.message)}</div>`;
  }
}

// ============================================================
// Stores
// ============================================================
async function renderStores() {
  setContent(`
    <h1>Stores</h1>
    <div class="card">
      <div class="field"><label>Store name</label><input id="storeName"></div>
      <div class="field"><label>Address</label><input id="storeAddress"></div>
      <div class="field"><label>Region / state</label><input id="storeRegion" placeholder="e.g. Yangon, Rakhine, Kachin"></div>
      <div class="field"><label>KBZPay QR image (optional)</label>
        ${dropZoneHtml('storeKbzDrop', 'Drag the QR image here, or click to browse')}
        <input id="storeKbzQr" placeholder="https://.../kbzpay-qr.png">
      </div>
      <div class="field"><label>Ambient music (optional)</label>
        ${dropZoneHtml('storeAmbientDrop', 'Drag a small audio loop here, or click to browse')}
        <input id="storeAmbientUrl" placeholder="https://.../lobby-loop.mp3">
      </div>
      <div class="field"><label><input type="checkbox" id="storeAmbientEnabled" style="width:auto;margin-right:6px;">Play while browsing the menu</label></div>
      ${themeFieldsHtml('createTheme')}
      <button class="btn" id="createStoreBtn">Create store</button>
    </div>
    <div id="storesTable">Loading…</div>
  `);

  attachUploadZone('storeKbzDrop', 'storeKbzQr', 'storeKbzDrop-status');
  attachUploadZone('storeAmbientDrop', 'storeAmbientUrl', 'storeAmbientDrop-status');
  wireThemeFields('createTheme');

  document.getElementById('createStoreBtn').addEventListener('click', async () => {
    const name = document.getElementById('storeName').value.trim();
    if (!name) return;
    await api('/admin/stores', {
      method: 'POST',
      body: {
        name,
        address: document.getElementById('storeAddress').value.trim(),
        region_state: document.getElementById('storeRegion').value.trim(),
        kbzpay_qr_url: document.getElementById('storeKbzQr').value.trim() || null,
        ambient_audio_url: document.getElementById('storeAmbientUrl').value.trim() || null,
        ambient_audio_enabled: document.getElementById('storeAmbientEnabled').checked,
        theme_config: collectThemeConfig('createTheme'),
      },
    });
    renderStores();
  });

  const data = await api('/admin/stores');
  state.stores = data.stores;
  const rows = state.stores.map((s) => `
    <tr>
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.region_state || '')}</td>
      <td><span class="pill">${escapeHtml(s.my_role || '')}</span></td>
      <td>
        <button class="btn secondary select-store" data-id="${s.id}">${s.id === state.storeId ? 'Selected' : 'Select'}</button>
        <button class="btn secondary edit-store" data-id="${s.id}">Edit settings</button>
      </td>
    </tr>
    <tr class="edit-row" id="edit-row-${s.id}" hidden><td colspan="4"></td></tr>
  `).join('');
  document.getElementById('storesTable').innerHTML = `
    <table><thead><tr><th>Store</th><th>Region</th><th>Your role</th><th></th></tr></thead><tbody>${rows}</tbody></table>
  `;
  document.querySelectorAll('.select-store').forEach((btn) => {
    btn.addEventListener('click', () => { persist('storeId', btn.dataset.id); renderStores(); updateContextBar(); });
  });
  document.querySelectorAll('.edit-store').forEach((btn) => {
    btn.addEventListener('click', () => openStoreEditRow(btn.dataset.id));
  });
}

function openStoreEditRow(storeId) {
  const store = state.stores.find((s) => s.id === storeId);
  const row = document.getElementById(`edit-row-${storeId}`);
  row.hidden = false;
  row.querySelector('td').innerHTML = `
    <div class="card" style="margin:8px 0;">
      <div class="field"><label>KBZPay QR image</label>
        ${dropZoneHtml(`editKbzDrop-${storeId}`, 'Drag the QR image here, or click to browse')}
        <input id="editKbz-${storeId}" value="${escapeHtml(store.kbzpay_qr_url || '')}">
      </div>
      <div class="field"><label>Ambient music</label>
        ${dropZoneHtml(`editAmbientDrop-${storeId}`, 'Drag a small audio loop here, or click to browse')}
        <input id="editAmbient-${storeId}" value="${escapeHtml(store.ambient_audio_url || '')}">
      </div>
      <div class="field"><label><input type="checkbox" id="editAmbientOn-${storeId}" style="width:auto;margin-right:6px;" ${store.ambient_audio_enabled ? 'checked' : ''}>Play while browsing the menu</label></div>
      ${themeFieldsHtml(`editTheme-${storeId}`, store.theme_config)}
      <button class="btn" id="saveStoreEdit-${storeId}">Save</button>
    </div>
  `;
  attachUploadZone(`editKbzDrop-${storeId}`, `editKbz-${storeId}`, `editKbzDrop-${storeId}-status`);
  attachUploadZone(`editAmbientDrop-${storeId}`, `editAmbient-${storeId}`, `editAmbientDrop-${storeId}-status`);
  wireThemeFields(`editTheme-${storeId}`);
  document.getElementById(`saveStoreEdit-${storeId}`).addEventListener('click', async () => {
    await api(`/admin/stores/${storeId}`, {
      method: 'PATCH',
      body: {
        kbzpay_qr_url: document.getElementById(`editKbz-${storeId}`).value.trim() || null,
        ambient_audio_url: document.getElementById(`editAmbient-${storeId}`).value.trim() || null,
        ambient_audio_enabled: document.getElementById(`editAmbientOn-${storeId}`).checked,
        theme_config: collectThemeConfig(`editTheme-${storeId}`),
      },
    });
    renderStores();
  });
}

// ============================================================
// Categories
// ============================================================
async function renderCategories() {
  setContent(`
    <h1>Categories</h1>
    <div class="card">
      <div class="field"><label>Name</label><input id="categoryName" placeholder="e.g. Noodles, Drinks"></div>
      <button class="btn" id="createCategoryBtn">Add category</button>
    </div>
    <div id="categoriesTable">Loading…</div>
  `);

  document.getElementById('createCategoryBtn').addEventListener('click', async () => {
    const name = document.getElementById('categoryName').value.trim();
    if (!name) return;
    try {
      await api('/admin/categories', { method: 'POST', body: { name } });
      renderCategories();
    } catch (err) {
      alert(err.message.includes('403') ? "You need an owner or manager role at one of your stores to add categories." : err.message);
    }
  });

  const data = await api('/admin/categories');
  state.categories = data.categories;
  document.getElementById('categoriesTable').innerHTML = `<table><tbody>${
    state.categories.map((c) => `<tr><td>${escapeHtml(c.name)}</td></tr>`).join('')
  }</tbody></table>`;
}

// ============================================================
// Products
// ============================================================
async function renderProducts() {
  const catData = await api('/admin/categories');
  state.categories = catData.categories;
  const categoryOptions = state.categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

  setContent(`
    <h1>Products</h1>
    <div class="card">
      <div class="field"><label>Name</label><input id="productName"></div>
      <div class="field"><label>Description</label><input id="productDescription" placeholder="Shown on the customer menu"></div>
      <div class="field"><label>Image URL</label>
        ${dropZoneHtml('productImageDrop', 'Drag an image here, or click to browse')}
        <input id="productImageUrl" placeholder="https://.../shan-noodles.jpg">
      </div>
      <div class="field"><label>Price (MMK)</label><input id="productPrice" type="number"></div>
      <div class="field"><label>Category</label><select id="productCategory"><option value="">— none —</option>${categoryOptions}</select></div>
      <button class="btn" id="createProductBtn">Add product</button>
    </div>
    <div id="productsTable">Loading…</div>
  `);

  attachUploadZone('productImageDrop', 'productImageUrl', 'productImageDrop-status');

  document.getElementById('createProductBtn').addEventListener('click', async () => {
    const name = document.getElementById('productName').value.trim();
    const price = Number(document.getElementById('productPrice').value);
    if (!name || !price) return;
    await api('/admin/products', {
      method: 'POST',
      body: {
        name,
        price,
        description: document.getElementById('productDescription').value.trim() || null,
        image_url: document.getElementById('productImageUrl').value.trim() || null,
        category_id: document.getElementById('productCategory').value || null,
      },
    });
    renderProducts();
  });

  const data = await api(`/admin/products${state.storeId ? `?store_id=${state.storeId}` : ''}`);
  state.products = data.products;
  const rows = state.products.map((p) => `
    <tr>
      <td>${escapeHtml(p.name)}</td>
      <td>${Number(p.price).toLocaleString()} MMK</td>
      <td><span class="pill ${p.is_active ? 'synced' : ''}">${p.is_active ? 'Active' : 'Inactive'}</span></td>
      <td>${
        state.storeId
          ? `<button class="btn secondary toggle-availability" data-id="${p.id}" data-available="${p.is_available}">${p.is_available ? 'Mark sold out' : 'Mark available'}</button>`
          : `<span style="font-size:0.78rem;color:var(--text-muted)">Select a store to manage</span>`
      }</td>
    </tr>
  `).join('');
  document.getElementById('productsTable').innerHTML = `
    <table><thead><tr><th>Name</th><th>Price</th><th>Status</th><th>Availability</th></tr></thead><tbody>${rows}</tbody></table>
  `;

  document.querySelectorAll('.toggle-availability').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const nextAvailable = btn.dataset.available !== 'true';
      await api(`/admin/stores/${state.storeId}/products/${btn.dataset.id}/availability`, {
        method: 'PATCH',
        body: { is_available: nextAvailable },
      });
      renderProducts();
    });
  });
}

// ============================================================
// Hub provisioning
// ============================================================
async function renderProvisioning() {
  if (!state.storeId) { setContent(`<h1>Hub setup</h1><div class="state-message">Select a store first.</div>`); return; }
  setContent(`
    <h1>Hub setup</h1>
    <div class="subtitle">Generates a one-time code to register a new hub device for this store. Requires owner/manager role.</div>
    <div class="card">
      <div class="field"><label>Code expires in (minutes)</label><input id="expiryMinutes" type="number" value="30"></div>
      <button class="btn" id="generateCodeBtn">Generate code</button>
      <div id="codeResult"></div>
    </div>
  `);

  document.getElementById('generateCodeBtn').addEventListener('click', async () => {
    try {
      const data = await api(`/admin/stores/${state.storeId}/provisioning-codes`, {
        method: 'POST',
        body: { expires_in_minutes: Number(document.getElementById('expiryMinutes').value) || 30 },
      });
      document.getElementById('codeResult').innerHTML = `
        <div class="code-display">${escapeHtml(data.code)}</div>
        <p style="font-size:0.85rem;color:var(--text-muted)">Expires at ${new Date(data.expires_at).toLocaleTimeString()}. On the hub device, run:</p>
        <pre style="background:var(--ivory-dim);padding:10px;border-radius:8px;font-size:0.8rem;overflow-x:auto">STORE_ID=${state.storeId} node scripts/register.js ${data.code}</pre>
      `;
    } catch (err) {
      document.getElementById('codeResult').innerHTML = `<div class="state-message error">${escapeHtml(err.message)}</div>`;
    }
  });
}

// ============================================================
// Table QR codes
// ============================================================
function renderQrCodes() {
  if (!state.storeId) { setContent(`<h1>Table QR codes</h1><div class="state-message">Select a store first.</div>`); return; }
  if (!state.customerAppUrl) {
    setContent(`
      <h1>Table QR codes</h1>
      <div class="card">
        <div class="field"><label>Customer ordering app URL</label><input id="customerAppUrlInput" placeholder="https://order.yourpos.com"></div>
        <button class="btn" id="saveCustomerUrlBtn">Save</button>
      </div>
    `);
    document.getElementById('saveCustomerUrlBtn').addEventListener('click', () => {
      persist('customerAppUrl', document.getElementById('customerAppUrlInput').value.replace(/\/$/, ''));
      renderQrCodes();
    });
    return;
  }

  setContent(`
    <h1>Table QR codes</h1>
    <div class="card">
      <div class="field"><label>Table number</label><input id="tableNumber" placeholder="e.g. 12"></div>
      <button class="btn" id="generateQrBtn">Generate</button>
      <div class="qr-box" id="qrBox"></div>
    </div>
  `);

  document.getElementById('generateQrBtn').addEventListener('click', () => {
    const table = document.getElementById('tableNumber').value.trim();
    if (!table) return;
    const url = `${state.customerAppUrl}/?store=${state.storeId}&table=${encodeURIComponent(table)}`;
    const qrBox = document.getElementById('qrBox');
    qrBox.innerHTML = `
      <div id="qrCanvas"></div>
      <div class="link-text">${escapeHtml(url)}</div>
      <div class="qr-actions">
        <button class="btn secondary" id="downloadQrBtn">Download PNG</button>
        <button class="btn secondary" id="printQrBtn">Print</button>
      </div>
    `;
    // eslint-disable-next-line no-undef
    new QRCode(document.getElementById('qrCanvas'), { text: url, width: 220, height: 220 });

    document.getElementById('downloadQrBtn').addEventListener('click', () => {
      const canvas = qrBox.querySelector('canvas');
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `table-${table}-qr.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });

    document.getElementById('printQrBtn').addEventListener('click', () => {
      const canvas = qrBox.querySelector('canvas');
      if (!canvas) return;
      const dataUrl = canvas.toDataURL('image/png');
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html><head><title>Table ${escapeHtml(table)} QR</title></head>
        <body style="text-align:center;font-family:sans-serif;padding:40px;">
          <h2>Table ${escapeHtml(table)}</h2>
          <img src="${dataUrl}" style="width:280px;height:280px;">
          <p style="color:#666;font-size:12px;">Scan to order</p>
        </body></html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    });
  });
}

// ============================================================
// Staff
// ============================================================
async function renderStaff() {
  if (state.features.staff_management !== true) { setContent(`<h1>Staff</h1><div class="state-message">This feature isn't enabled for your account yet. Contact the platform operator.</div>`); return; }
  if (!state.storeId) { setContent(`<h1>Staff</h1><div class="state-message">Select a store first.</div>`); return; }
  setContent(`
    <h1>Staff</h1>
    <div class="subtitle">Owner-only. Adds a login scoped to this store.</div>
    <div class="card">
      <div class="field"><label>Name</label><input id="staffName"></div>
      <div class="field"><label>Email</label><input id="staffEmail"></div>
      <div class="field"><label>Initial password</label><input id="staffPassword" type="password"></div>
      <div class="field"><label>Role</label>
        <select id="staffRole">
          <option value="manager">Manager</option>
          <option value="cashier">Cashier</option>
          <option value="kitchen_staff">Kitchen staff</option>
        </select>
      </div>
      <button class="btn" id="addStaffBtn">Add</button>
      <div id="staffResult" style="margin-top:10px;"></div>
    </div>
    <div id="staffTable">Loading…</div>
  `);

  document.getElementById('addStaffBtn').addEventListener('click', async () => {
    const resultEl = document.getElementById('staffResult');
    try {
      await api(`/admin/stores/${state.storeId}/staff`, {
        method: 'POST',
        body: {
          name: document.getElementById('staffName').value.trim(),
          email: document.getElementById('staffEmail').value.trim(),
          password: document.getElementById('staffPassword').value,
          role: document.getElementById('staffRole').value,
        },
      });
      resultEl.innerHTML = `<span style="color:#2C5A28">Added. Share the email/password with them directly.</span>`;
      renderStaffTable();
    } catch (err) {
      resultEl.innerHTML = `<span style="color:#A6301F">${escapeHtml(err.message)}</span>`;
    }
  });

  renderStaffTable();
}

async function renderStaffTable() {
  const data = await api(`/admin/stores/${state.storeId}/staff`);
  const rows = data.staff.map((s) => `
    <tr>
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.email)}</td>
      <td><span class="pill">${escapeHtml(s.role)}</span></td>
      <td>${s.role !== 'owner' ? `<button class="btn secondary remove-staff" data-id="${s.id}">Remove</button>` : ''}</td>
    </tr>
  `).join('');
  document.getElementById('staffTable').innerHTML = `
    <table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead><tbody>${rows}</tbody></table>
  `;
  document.querySelectorAll('.remove-staff').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/admin/stores/${state.storeId}/staff/${btn.dataset.id}`, { method: 'DELETE' });
      renderStaffTable();
    });
  });
}

// ============================================================
// Live orders — the kitchen/staff working view. Polls every 5s.
// ============================================================
async function renderLiveOrders() {
  if (state.features.live_orders !== true) { setContent(`<h1>Live orders</h1><div class="state-message">This feature isn't enabled for your account yet. Contact the platform operator.</div>`); return; }
  if (!state.storeId) { setContent(`<h1>Live orders</h1><div class="state-message">Select a store first.</div>`); return; }
  setContent(`<h1>Live orders</h1><div class="subtitle">Refreshes automatically.</div><div id="liveOrdersList">Loading…</div>`);

  const load = async () => {
    try {
      const data = await api(`/admin/stores/${state.storeId}/live-orders`);
      renderLiveOrdersList(data.orders);
    } catch (err) {
      document.getElementById('liveOrdersList').innerHTML = `<div class="state-message error">${escapeHtml(err.message)}</div>`;
    }
  };

  await load();
  liveOrdersInterval = setInterval(load, 5000);
}

function renderLiveOrdersList(orders) {
  const listEl = document.getElementById('liveOrdersList');
  if (orders.length === 0) {
    listEl.innerHTML = `<div class="state-message">No open orders right now.</div>`;
    return;
  }

  listEl.innerHTML = orders.map((o) => {
    const pendingPayment = o.payments.some((p) => p.status === 'pending');
    const itemsHtml = o.items.map((i) => `
      <div style="padding:4px 0;font-size:0.88rem;">
        ${i.qty} × ${escapeHtml(i.product_name_snapshot)}
        ${i.notes ? `<div style="font-size:0.78rem;color:var(--text-muted);font-style:italic;">note: ${escapeHtml(i.notes)}</div>` : ''}
      </div>
    `).join('');

    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:start;">
          <div>
            <div style="font-weight:700;">${o.table_number ? `Table ${escapeHtml(o.table_number)}` : escapeHtml(o.channel)}</div>
            <div style="font-size:0.78rem;color:var(--text-muted);">${new Date(o.created_at).toLocaleTimeString()}</div>
          </div>
          ${pendingPayment ? `<span class="pill pending">Payment pending</span>` : `<span class="pill synced">Paid</span>`}
        </div>
        <div style="margin:10px 0;">${itemsHtml}</div>
        <div style="display:flex;gap:8px;">
          ${pendingPayment ? `<button class="btn secondary confirm-payment-btn" data-id="${o.id}">Confirm payment</button>` : ''}
          <button class="btn complete-order-btn" data-id="${o.id}">Mark completed</button>
        </div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.confirm-payment-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/admin/orders/${btn.dataset.id}/confirm-payment`, { method: 'POST' });
    });
  });
  listEl.querySelectorAll('.complete-order-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/admin/orders/${btn.dataset.id}/status`, { method: 'POST', body: { status: 'completed' } });
    });
  });
}


// ============================================================
// Analytics — daily revenue and best sellers
// ============================================================
async function renderAnalytics(days = 7) {
  if (state.features.analytics !== true) { setContent(`<h1>Analytics</h1><div class="state-message">This feature isn't enabled for your account yet. Contact the platform operator.</div>`); return; }
  if (!state.storeId) { setContent(`<h1>Analytics</h1><div class="state-message">Select a store first.</div>`); return; }

  setContent(`
    <h1>Analytics</h1>
    <div class="subtitle">Excludes voided/refunded orders.</div>
    <div style="display:flex;gap:8px;margin-bottom:20px;">
      <button class="btn ${days === 7 ? '' : 'secondary'}" id="range7">7 days</button>
      <button class="btn ${days === 30 ? '' : 'secondary'}" id="range30">30 days</button>
      <button class="btn ${days === 90 ? '' : 'secondary'}" id="range90">90 days</button>
    </div>
    <div id="analyticsContent">Loading…</div>
  `);

  document.getElementById('range7').addEventListener('click', () => renderAnalytics(7));
  document.getElementById('range30').addEventListener('click', () => renderAnalytics(30));
  document.getElementById('range90').addEventListener('click', () => renderAnalytics(90));

  try {
    const data = await api(`/admin/stores/${state.storeId}/analytics?days=${days}`);
    const el = document.getElementById('analyticsContent');

    const maxRevenue = Math.max(1, ...data.daily_revenue.map((d) => Number(d.revenue)));
    const barsHtml = data.daily_revenue.map((d) => {
      const heightPct = Math.max(4, (Number(d.revenue) / maxRevenue) * 100);
      const label = new Date(d.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;">
          <div style="font-size:0.68rem;color:var(--text-muted);white-space:nowrap;">${Number(d.revenue).toLocaleString()}</div>
          <div style="width:100%;height:120px;display:flex;align-items:flex-end;">
            <div style="width:100%;height:${heightPct}%;background:var(--red);border-radius:4px 4px 0 0;"></div>
          </div>
          <div style="font-size:0.68rem;color:var(--text-muted);">${label}</div>
        </div>
      `;
    }).join('');

    const bestSellersRows = data.best_sellers.map((b, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(b.name)}</td>
        <td>${b.qty_sold}</td>
        <td>${Number(b.revenue).toLocaleString()} MMK</td>
      </tr>
    `).join('');

    el.innerHTML = `
      <div style="display:flex;gap:14px;margin-bottom:20px;flex-wrap:wrap;">
        <div class="card" style="flex:1;min-width:150px;">
          <div style="font-size:0.78rem;color:var(--text-muted);">Total revenue</div>
          <div style="font-size:1.4rem;font-weight:700;">${Number(data.summary.total_revenue).toLocaleString()} MMK</div>
        </div>
        <div class="card" style="flex:1;min-width:150px;">
          <div style="font-size:0.78rem;color:var(--text-muted);">Orders</div>
          <div style="font-size:1.4rem;font-weight:700;">${data.summary.total_orders}</div>
        </div>
        <div class="card" style="flex:1;min-width:150px;">
          <div style="font-size:0.78rem;color:var(--text-muted);">Avg order value</div>
          <div style="font-size:1.4rem;font-weight:700;">${Math.round(Number(data.summary.avg_order_value)).toLocaleString()} MMK</div>
        </div>
      </div>

      <div class="card">
        <div style="font-weight:600;margin-bottom:14px;">Daily revenue</div>
        ${data.daily_revenue.length === 0
          ? `<div class="state-message">No orders in this range yet.</div>`
          : `<div style="display:flex;gap:6px;align-items:flex-end;">${barsHtml}</div>`}
      </div>

      <div class="card">
        <div style="font-weight:600;margin-bottom:10px;">Best sellers</div>
        ${data.best_sellers.length === 0
          ? `<div class="state-message">No sales in this range yet.</div>`
          : `<table><thead><tr><th>#</th><th>Product</th><th>Qty sold</th><th>Revenue</th></tr></thead><tbody>${bestSellersRows}</tbody></table>`}
      </div>
    `;
  } catch (err) {
    document.getElementById('analyticsContent').innerHTML = `<div class="state-message error">${escapeHtml(err.message)}</div>`;
  }
}


async function renderOrders() {
  if (!state.storeId) { setContent(`<h1>Orders</h1><div class="state-message">Select a store first.</div>`); return; }
  setContent(`<h1>Orders</h1><div class="subtitle">Most recent 50 for this store.</div><div id="ordersTable">Loading…</div>`);

  try {
    const data = await api(`/admin/orders?store_id=${state.storeId}`);
    const rows = data.orders.map((o) => `
      <tr>
        <td>${o.table_number ? `Table ${escapeHtml(o.table_number)}` : '—'}</td>
        <td>${escapeHtml(o.channel)}</td>
        <td>${escapeHtml(o.status)}</td>
        <td>${Number(o.total).toLocaleString()} MMK</td>
        <td><span class="pill ${o.sync_status}">${escapeHtml(o.sync_status)}</span></td>
        <td>${new Date(o.created_at).toLocaleString()}</td>
      </tr>
    `).join('');
    document.getElementById('ordersTable').innerHTML = `
      <table><thead><tr><th>Table</th><th>Channel</th><th>Status</th><th>Total</th><th>Sync</th><th>Placed</th></tr></thead><tbody>${rows}</tbody></table>
    `;
  } catch (err) {
    document.getElementById('ordersTable').innerHTML = `<div class="state-message error">${escapeHtml(err.message)}</div>`;
  }
}

// ============================================================
// Google sign-in (Supabase Auth) plumbing
// ============================================================
let _supabaseClient;
function getSupabaseClient() {
  if (_supabaseClient !== undefined) return _supabaseClient;
  const cfg = window.POS_CONFIG || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || typeof window.supabase === 'undefined') {
    _supabaseClient = null;
  } else {
    _supabaseClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }
  return _supabaseClient;
}

// Called at boot. If the browser just came back from Google's OAuth
// redirect, Supabase's client picks up the session automatically from
// the URL — we just need to hand its access token to our own
// /auth/google-exchange to get our app's JWT (same shape as a normal
// email/password login from there on).
async function tryGoogleSessionExchange() {
  const supa = getSupabaseClient();
  if (!supa) return { ok: false };

  const { data } = await supa.auth.getSession();
  const accessToken = data?.session?.access_token;
  if (!accessToken) return { ok: false }; // not returning from a Google redirect — normal case, not an error

  try {
    const result = await api('/auth/google-exchange', { method: 'POST', body: { supabase_access_token: accessToken } });
    persist('token', result.token);
    persist('user', result.user);
    state.stores = result.stores.map((s) => ({ id: s.store_id, name: s.store_name, my_role: s.role }));
    await supa.auth.signOut(); // done with the Supabase session; our own JWT drives the app from here
    return { ok: true };
  } catch (err) {
    console.error('[auth] google exchange failed:', err.message);
    return { ok: false, error: err.message };
  }
}

// ============================================================
// Boot
// ============================================================
async function boot() {
  if (state.token && state.user) {
    try {
      const data = await api('/admin/stores');
      state.stores = data.stores;
      await loadTenantFeatures();
      switchTab('business');
      return;
    } catch (err) {
      // falls through to login below
    }
  }

  const result = await tryGoogleSessionExchange();
  if (result.ok) {
    await loadTenantFeatures();
    switchTab('business');
    return;
  }

  switchTab('login');
  // Surfaced only if a Google sign-in actually happened and failed —
  // never shown on a plain first visit, since result.error is only
  // set inside the catch block above.
  if (result.error) {
    const resultEl = document.getElementById('loginResult');
    if (resultEl) resultEl.innerHTML = `<span style="color:#A6301F">Google sign-in failed: ${escapeHtml(result.error)}</span>`;
  }
  switchTab('login');
}

boot();
