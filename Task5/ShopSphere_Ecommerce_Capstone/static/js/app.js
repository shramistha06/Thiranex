"use strict";

const app = document.getElementById("app");
const cartCount = document.getElementById("cart-count");
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const toastNode = document.getElementById("toast");

const state = {
  products: [],
  categories: ["All"],
  category: "All",
  search: "",
  user: null,
  cart: readCart(),
  toastTimer: null
};

function readCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem("shopsphere-cart") || "[]");
    return Array.isArray(parsed) ? parsed.filter(x =>
      Number.isInteger(x.product_id) && Number.isInteger(x.quantity) &&
      x.quantity > 0 && x.quantity <= 99
    ) : [];
  } catch {
    return [];
  }
}
function saveCart() {
  localStorage.setItem("shopsphere-cart", JSON.stringify(state.cart));
  updateCartCount();
}
function updateCartCount() {
  cartCount.textContent = state.cart.reduce((sum, item) => sum + item.quantity, 0);
}
function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value));
}
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}
function showToast(message) {
  toastNode.textContent = message;
  toastNode.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toastNode.classList.remove("show"), 2600);
}
async function api(url, options = {}) {
  const config = { credentials: "same-origin", ...options, headers: { ...(options.headers || {}) } };
  if (config.body && typeof config.body !== "string") {
    config.headers["Content-Type"] = "application/json";
    config.body = JSON.stringify(config.body);
  }
  const method = (config.method || "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = document.cookie.split("; ").find(x => x.startsWith("csrftoken="));
    if (csrf) config.headers["X-CSRFToken"] = decodeURIComponent(csrf.split("=").slice(1).join("="));
  }
  const response = await fetch(url, config);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : {};
  if (!response.ok) {
    const detail = data.detail || Object.values(data).flat().join(" ") || `Request failed (${response.status}).`;
    throw new Error(detail);
  }
  return data;
}
async function loadInitialData() {
  try {
    const [products, categories, user] = await Promise.all([
      api("/api/products/"), api("/api/categories/"), api("/api/auth/me/")
    ]);
    state.products = products;
    state.categories = categories;
    state.user = user.authenticated ? user : null;
    updateCartCount();
    updateAccountLink();
    renderRoute();
  } catch (error) {
    app.innerHTML = `<div class="page-wrap"><div class="panel"><h1>Could not load ShopSphere</h1><p class="muted">${escapeHTML(error.message)}</p><button class="btn" data-action="retry">Try again</button></div></div>`;
  }
}
function updateAccountLink() {
  document.getElementById("account-link").textContent = state.user ? `Hi, ${state.user.username}` : "Sign in";
}
function navigate(path) {
  if (location.pathname + location.search === path) return;
  history.pushState({}, "", path);
  renderRoute();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function currentPath() { return location.pathname.replace(/\/+$/, "") || "/"; }
function productById(id) { return state.products.find(p => p.id === Number(id)); }
function filteredProducts() {
  const q = state.search.toLowerCase();
  return state.products.filter(p =>
    (state.category === "All" || p.category.toLowerCase() === state.category.toLowerCase()) &&
    (!q || `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(q))
  );
}
function productCard(p) {
  const image = p.image_url
    ? `<img class="product-image" src="${escapeHTML(p.image_url)}" alt="${escapeHTML(p.name)}" loading="lazy" decoding="async" width="600" height="600" onerror="this.style.display='none'">`
    : `<div class="product-image product-image-placeholder" aria-hidden="true">📦</div>`;
  return `<article class="product-card">
    <a href="/product/${encodeURIComponent(p.slug)}" data-link aria-label="View ${escapeHTML(p.name)}">${image}</a>
    <div class="product-info">
      <div class="product-category">${escapeHTML(p.category)}</div>
      <h3><a href="/product/${encodeURIComponent(p.slug)}" data-link>${escapeHTML(p.name)}</a></h3>
      <div class="product-price-row"><span class="price">${money(p.price)}</span>
        <button class="icon-btn" data-action="add" data-id="${p.id}" aria-label="Add ${escapeHTML(p.name)} to bag" ${p.stock < 1 ? "disabled" : ""}>＋</button>
      </div>
      <div class="stock-note">${p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}</div>
    </div>
  </article>`;
}
function homePage() {
  const products = filteredProducts();
  const categories = state.categories.map(c =>
    `<button class="chip ${state.category === c ? "active" : ""}" data-action="category" data-category="${escapeHTML(c)}">${escapeHTML(c)}</button>`
  ).join("");
  app.innerHTML = `<div class="container">
    <section class="hero">
      <div><div class="eyebrow">The everyday edit</div><h1>Good things for your everyday.</h1>
      <p>Discover thoughtful essentials for your desk, your wardrobe, and everywhere in between.</p>
      <button class="btn btn-light" data-action="shop">Explore collection&nbsp; →</button></div>
      <div class="hero-art" aria-hidden="true">🛍️</div>
    </section>
    <section aria-labelledby="collection-title">
      <div class="section-head"><div><h2 id="collection-title">${state.search ? "Search results" : "Curated for you"}</h2><p>${products.length} product${products.length === 1 ? "" : "s"} to discover</p></div></div>
      <div class="category-row" aria-label="Filter by category">${categories}</div>
      ${products.length ? `<div class="product-grid">${products.map(productCard).join("")}</div>` :
        `<div class="empty-state"><div class="empty-icon">🔎</div><h2>No products found</h2><p class="muted">Try a different search or category.</p><button class="btn" data-action="clear-filters">Clear filters</button></div>`}
    </section>
  </div>`;
}
function cartPage() {
  const lines = state.cart.map(item => ({ ...item, product: productById(item.product_id) })).filter(x => x.product);
  const total = lines.reduce((sum, x) => sum + Number(x.product.price) * x.quantity, 0);
  if (!lines.length) {
    app.innerHTML = `<div class="page-wrap"><div class="empty-state"><div class="empty-icon">🛍️</div><h1>Your bag is waiting</h1><p class="muted">Find something you'll love and it will appear here.</p><p style="margin-top:22px"><button class="btn" data-action="shop">Explore products</button></p></div></div>`;
    return;
  }
  app.innerHTML = `<div class="page-wrap"><h1 class="page-title">Your bag</h1><p class="muted">Review your items before checkout.</p>
    <div class="cart-layout"><section class="panel">${lines.map(({product:p, quantity}) => `
      <article class="cart-item">
        <img src="${escapeHTML(p.image_url)}" alt="${escapeHTML(p.name)}" loading="lazy" onerror="this.style.visibility='hidden'">
        <div><strong>${escapeHTML(p.name)}</strong><div class="muted">${money(p.price)} each</div>
          <div class="quantity"><button data-action="quantity" data-id="${p.id}" data-delta="-1" aria-label="Decrease quantity">−</button><span>${quantity}</span><button data-action="quantity" data-id="${p.id}" data-delta="1" aria-label="Increase quantity" ${quantity >= 99 ? "disabled" : ""}>+</button></div>
          <button class="remove-btn" data-action="remove" data-id="${p.id}">Remove</button>
        </div><strong class="price">${money(Number(p.price) * quantity)}</strong>
      </article>`).join("")}</section>
      <aside class="panel"><h2>Order summary</h2><div class="summary-line"><span>Subtotal</span><strong>${money(total)}</strong></div><div class="summary-line"><span>Shipping</span><span>Free</span></div><div class="summary-line summary-total"><span>Total</span><span>${money(total)}</span></div><p class="muted" style="font-size:.82rem;margin:14px 0">Demo checkout. No payment will be collected.</p><button class="btn" style="width:100%" data-action="checkout">Continue to checkout</button></aside>
    </div></div>`;
}
function accountPage() {
  app.innerHTML = `<div class="page-wrap"><section class="panel auth-panel">
    <h1>${state.user ? "Your account" : "Welcome back"}</h1>
    <p class="muted">${state.user ? `Signed in as ${escapeHTML(state.user.username)} (${escapeHTML(state.user.email)})` : "Sign in or create an account to place and track orders."}</p>
    ${state.user ? `<div style="display:grid;gap:12px;margin-top:22px"><button class="btn" data-action="orders">View my orders</button><button class="btn" style="background:#eef2ff;color:#243b87" data-action="logout">Sign out</button></div>` : `
    <div class="category-row" style="margin-top:22px"><button class="chip active" data-action="auth-mode" data-mode="login" id="login-tab">Sign in</button><button class="chip" data-action="auth-mode" data-mode="register" id="register-tab">Create account</button></div>
    <form id="auth-form">
      <div class="field"><label for="username">Username</label><input id="username" name="username" autocomplete="username" required maxlength="150"></div>
      <div class="field" id="email-field" hidden><label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="email"></div>
      <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" minlength="8" required></div>
      <p class="error-text" id="auth-error" role="alert"></p><button class="btn" style="width:100%" type="submit" id="auth-submit">Sign in</button>
    </form>`}
  </section></div>`;
}
function checkoutPage() {
  if (!state.cart.length) { navigate("/cart"); return; }
  if (!state.user) {
    app.innerHTML = `<div class="page-wrap"><div class="empty-state"><div class="empty-icon">🔐</div><h1>Sign in to check out</h1><p class="muted">Your bag is saved on this device.</p><p style="margin-top:20px"><button class="btn" data-action="account">Sign in / Create account</button></p></div></div>`;
    return;
  }
  const total = state.cart.reduce((sum, item) => {
    const p = productById(item.product_id); return sum + (p ? Number(p.price) * item.quantity : 0);
  }, 0);
  app.innerHTML = `<div class="page-wrap"><h1 class="page-title">Delivery details</h1><p class="muted">Complete the form to create your demo order.</p>
    <div class="cart-layout"><section class="panel"><form id="checkout-form">
      <div class="form-grid">
        <div class="field full"><label for="full_name">Full name</label><input id="full_name" name="full_name" autocomplete="name" required maxlength="120"></div>
        <div class="field full"><label for="checkout_email">Email</label><input id="checkout_email" name="email" type="email" autocomplete="email" value="${escapeHTML(state.user.email)}" required></div>
        <div class="field full"><label for="address">Street address</label><input id="address" name="address" autocomplete="street-address" required maxlength="250"></div>
        <div class="field"><label for="city">City</label><input id="city" name="city" autocomplete="address-level2" required maxlength="100"></div>
        <div class="field"><label for="postal_code">Postal code</label><input id="postal_code" name="postal_code" autocomplete="postal-code" required maxlength="20"></div>
      </div>
      <p class="notice">This capstone demo creates an order record only. It does not process payments.</p><p class="error-text" id="checkout-error" role="alert"></p>
      <button class="btn" type="submit" id="place-order" style="width:100%">Place demo order · ${money(total)}</button>
    </form></section>
    <aside class="panel"><h2>Summary</h2>${state.cart.map(item => { const p=productById(item.product_id); return p ? `<div class="summary-line"><span>${escapeHTML(p.name)} × ${item.quantity}</span><strong>${money(Number(p.price)*item.quantity)}</strong></div>` : ""; }).join("")}<div class="summary-line summary-total"><span>Total</span><span>${money(total)}</span></div></aside></div></div>`;
}
async function ordersPage() {
  if (!state.user) {
    app.innerHTML = `<div class="page-wrap"><div class="empty-state"><h1>Sign in to view orders</h1><button class="btn" data-action="account">Sign in</button></div></div>`;
    return;
  }
  app.innerHTML = `<div class="page-wrap"><h1 class="page-title">Your orders</h1><p class="muted">Order history for your account.</p><div class="loading-panel"><div class="spinner"></div><p>Loading orders…</p></div></div>`;
  try {
    const orders = await api("/api/orders/");
    if (currentPath() !== "/orders") return;
    app.innerHTML = `<div class="page-wrap"><h1 class="page-title">Your orders</h1><p class="muted">Order history for your account.</p>
      ${orders.length ? orders.map(order => `<article class="order-card"><div class="order-head"><div><strong>Order #${order.id}</strong><div class="muted">${new Date(order.created_at).toLocaleString()}</div></div><span class="badge">${escapeHTML(order.status)}</span></div><div style="margin-top:14px">${order.items.map(item => `<div class="summary-line"><span>${escapeHTML(item.product_name)} × ${item.quantity}</span><span>${money(Number(item.unit_price)*item.quantity)}</span></div>`).join("")}</div><div class="summary-line summary-total"><span>Total</span><span>${money(order.total)}</span></div><div class="muted">${escapeHTML(order.address)}, ${escapeHTML(order.city)} ${escapeHTML(order.postal_code)}</div></article>`).join("") : `<div class="empty-state"><div class="empty-icon">📦</div><h2>No orders yet</h2><p class="muted">Your placed orders will appear here.</p><p style="margin-top:18px"><button class="btn" data-action="shop">Browse products</button></p></div>`}
    </div>`;
  } catch (error) {
    app.innerHTML = `<div class="page-wrap"><div class="panel"><h2>Could not load orders</h2><p class="error-text">${escapeHTML(error.message)}</p></div></div>`;
  }
}
function productPage(slug) {
  const p = state.products.find(x => x.slug === slug);
  if (!p) {
    app.innerHTML = `<div class="page-wrap"><div class="empty-state"><div class="empty-icon">🔎</div><h1>Product not found</h1><button class="btn" data-action="shop">Back to shop</button></div></div>`;
    return;
  }
  app.innerHTML = `<div class="page-wrap"><p class="muted"><a href="/" data-link>Shop</a> / ${escapeHTML(p.category)}</p><div class="detail-layout" style="margin-top:20px"><img class="detail-image" src="${escapeHTML(p.image_url)}" alt="${escapeHTML(p.name)}" onerror="this.style.visibility='hidden'"><div><span class="badge">${p.stock > 0 ? "In stock" : "Out of stock"}</span><h1 class="page-title" style="margin-top:14px">${escapeHTML(p.name)}</h1><div class="detail-price">${money(p.price)}</div><p class="detail-description">${escapeHTML(p.description)}</p><p class="stock-note">${p.stock} available</p><button class="btn" style="margin-top:20px" data-action="add" data-id="${p.id}" ${p.stock < 1 ? "disabled" : ""}>Add to bag</button><p class="muted" style="margin-top:16px;font-size:.84rem">Secure account sessions · Demo checkout · No payment required</p></div></div></div>`;
}
function renderRoute() {
  const path = currentPath();
  if (path === "/" || path === "/products") homePage();
  else if (path === "/cart") cartPage();
  else if (path === "/account") accountPage();
  else if (path === "/checkout") checkoutPage();
  else if (path === "/orders") ordersPage();
  else if (path.startsWith("/product/")) productPage(decodeURIComponent(path.slice("/product/".length)));
  else { app.innerHTML = `<div class="page-wrap"><div class="empty-state"><h1>Page not found</h1><button class="btn" data-action="shop">Go home</button></div></div>`; }
}
function addToCart(id) {
  const p = productById(id);
  if (!p) return;
  const existing = state.cart.find(item => item.product_id === p.id);
  if (existing) {
    if (existing.quantity >= Math.min(99, p.stock)) return showToast("You have reached the available stock limit.");
    existing.quantity++;
  } else {
    if (p.stock < 1) return showToast("This product is out of stock.");
    state.cart.push({ product_id: p.id, quantity: 1 });
  }
  saveCart(); showToast(`${p.name} added to your bag.`);
  if (currentPath() === "/cart") cartPage();
}
function changeQuantity(id, delta) {
  const item = state.cart.find(x => x.product_id === Number(id));
  const product = productById(id);
  if (!item || !product) return;
  const next = item.quantity + delta;
  if (next <= 0) state.cart = state.cart.filter(x => x.product_id !== Number(id));
  else if (next <= 99 && next <= product.stock) item.quantity = next;
  else showToast("Quantity exceeds available stock.");
  saveCart(); cartPage();
}
let authMode = "login";
function setAuthMode(mode) {
  authMode = mode;
  const register = mode === "register";
  document.getElementById("email-field").hidden = !register;
  document.getElementById("email").required = register;
  document.getElementById("password").autocomplete = register ? "new-password" : "current-password";
  document.getElementById("auth-submit").textContent = register ? "Create account" : "Sign in";
  document.getElementById("login-tab").classList.toggle("active", !register);
  document.getElementById("register-tab").classList.toggle("active", register);
  document.getElementById("auth-error").textContent = "";
}
document.addEventListener("click", async event => {
  const link = event.target.closest("a[data-link]");
  if (link) {
    const url = new URL(link.href, location.origin);
    if (url.origin === location.origin && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) {
      event.preventDefault(); navigate(url.pathname + url.search);
    }
    return;
  }
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  try {
    if (action === "add") addToCart(Number(button.dataset.id));
    if (action === "quantity") changeQuantity(button.dataset.id, Number(button.dataset.delta));
    if (action === "remove") { state.cart = state.cart.filter(x => x.product_id !== Number(button.dataset.id)); saveCart(); cartPage(); showToast("Item removed."); }
    if (action === "category") { state.category = button.dataset.category; renderRoute(); }
    if (action === "clear-filters") { state.category = "All"; state.search = ""; searchInput.value = ""; renderRoute(); }
    if (action === "shop") navigate("/");
    if (action === "account") navigate("/account");
    if (action === "orders") navigate("/orders");
    if (action === "checkout") navigate("/checkout");
    if (action === "auth-mode") setAuthMode(button.dataset.mode);
    if (action === "retry") await loadInitialData();
    if (action === "logout") {
      await api("/api/auth/logout/", { method: "POST", body: {} });
      state.user = null; updateAccountLink(); showToast("You have signed out."); navigate("/account");
    }
  } catch (error) { showToast(error.message); }
});
document.addEventListener("submit", async event => {
  if (event.target.id === "auth-form") {
    event.preventDefault();
    const form = new FormData(event.target);
    const payload = { username: form.get("username"), password: form.get("password") };
    if (authMode === "register") payload.email = form.get("email");
    const errorNode = document.getElementById("auth-error");
    const submit = document.getElementById("auth-submit");
    submit.disabled = true; errorNode.textContent = "";
    try {
      state.user = await api(authMode === "register" ? "/api/auth/register/" : "/api/auth/login/", { method: "POST", body: payload });
      updateAccountLink(); showToast(authMode === "register" ? "Account created." : "Welcome back.");
      navigate(state.cart.length ? "/checkout" : "/");
    } catch (error) { errorNode.textContent = error.message; }
    finally { submit.disabled = false; }
  }
  if (event.target.id === "checkout-form") {
    event.preventDefault();
    const form = new FormData(event.target);
    const payload = Object.fromEntries(form.entries());
    payload.items = state.cart.map(x => ({ product_id: x.product_id, quantity: x.quantity }));
    const errorNode = document.getElementById("checkout-error");
    const submit = document.getElementById("place-order");
    submit.disabled = true; errorNode.textContent = "";
    try {
      const order = await api("/api/orders/", { method: "POST", body: payload });
      state.cart = []; saveCart();
      await loadInitialData();
      showToast(`Order #${order.id} placed successfully.`);
      navigate("/orders");
    } catch (error) { errorNode.textContent = error.message; }
    finally { submit.disabled = false; }
  }
});
searchForm.addEventListener("submit", event => {
  event.preventDefault();
  state.search = searchInput.value.trim();
  state.category = "All";
  if (currentPath() !== "/") navigate("/");
  else renderRoute();
});
searchInput.addEventListener("search", () => {
  if (!searchInput.value) { state.search = ""; state.category = "All"; renderRoute(); }
});
window.addEventListener("popstate", renderRoute);
updateCartCount();
loadInitialData();
