(function () {
  'use strict';

  const HAMBURGER_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg>';
  const CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';

  function parsePrice(text) {
    if (!text) return 0;
    const n = parseFloat(String(text).replace(/[^\d.,-]/g, '').replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
  }

  function formatMoney(n) {
    return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ---------- Toast ----------
  let toastContainer = null;
  function ensureToastContainer() {
    if (toastContainer && document.body.contains(toastContainer)) return toastContainer;
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
    return toastContainer;
  }
  function showToast(message, kind) {
    const container = ensureToastContainer();
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || 'ok');
    el.innerHTML = CHECK_SVG + '<span></span>';
    el.querySelector('span').textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 220);
    }, 2200);
  }
  window.showToast = showToast;

  // ---------- Mobile drawer ----------
  function setupDrawer() {
    const topbar = document.querySelector('.topbar');
    const sidebar = document.querySelector('.sidebar');
    if (!topbar || !sidebar) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hamburger';
    btn.setAttribute('aria-label', 'Abrir menú');
    btn.innerHTML = HAMBURGER_SVG;
    topbar.insertBefore(btn, topbar.firstChild);

    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    function close() { document.body.classList.remove('sidebar-open'); }
    function toggle() { document.body.classList.toggle('sidebar-open'); }

    btn.addEventListener('click', toggle);
    overlay.addEventListener('click', close);
    sidebar.addEventListener('click', (e) => {
      if (e.target.closest('.sidebar-link')) close();
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }

  // ---------- Form "save" emulation ----------
  const SAVE_RE = /guardar|agendar|cobrar|crear|aceptar|registrar|enviar|confirmar|aplicar/i;
  const CANCEL_RE = /cancelar|descartar|volver/i;

  function setupFormEmulation() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button, a.btn');
      if (!btn) return;
      const label = (btn.textContent || '').trim();
      if (!label) return;

      const inActions = btn.closest('.form-actions, .page-actions, .pos-cart-footer, .profile-actions, .card-actions');
      if (!inActions) return;

      // Skip real navigational anchors (they already link somewhere)
      if (btn.tagName === 'A' && btn.getAttribute('href') && btn.getAttribute('href') !== '#') return;

      if (SAVE_RE.test(label)) {
        e.preventDefault();
        showToast(label.replace(/^\+\s*/, '') + ' ✓', 'ok');
        const form = btn.closest('form');
        if (form && /guardar|registrar|crear/i.test(label)) {
          try { form.reset(); } catch (_) {}
        }
        if (btn.closest('.pos-cart-footer')) resetPosCart();
      } else if (CANCEL_RE.test(label) && btn.tagName === 'BUTTON') {
        e.preventDefault();
        showToast('Operación cancelada', 'info');
      }
    });
  }

  // ---------- POS cart ----------
  function setupPos() {
    const grid = document.querySelector('.pos-products-grid');
    const cartItems = document.querySelector('.pos-cart-items');
    if (!grid || !cartItems) return;

    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.pos-product');
      if (!card) return;
      addToCart(card);
    });

    cartItems.addEventListener('click', (e) => {
      const remove = e.target.closest('[data-cart-remove]');
      if (!remove) return;
      const row = remove.closest('.pos-cart-item');
      if (row) row.remove();
      recalcCart();
    });
  }

  function addToCart(card) {
    const cartItems = document.querySelector('.pos-cart-items');
    if (!cartItems) return;
    const sku = card.dataset.sku || (card.querySelector('.pos-product-sku') || {}).textContent || '';
    const name = (card.querySelector('.pos-product-name') || {}).textContent || 'Producto';
    const priceText = (card.querySelector('.pos-product-price') || {}).textContent || '0';
    const price = card.dataset.price ? parseFloat(card.dataset.price) : parsePrice(priceText);

    const existing = cartItems.querySelector('.pos-cart-item[data-sku="' + CSS.escape(sku) + '"]');
    if (existing) {
      const qty = parseInt(existing.dataset.qty || '1', 10) + 1;
      existing.dataset.qty = String(qty);
      existing.querySelector('.pos-cart-item-meta').textContent = 'Cant. ' + qty;
      existing.querySelector('.pos-cart-item-price').textContent = formatMoney(price * qty);
    } else {
      const row = document.createElement('div');
      row.className = 'pos-cart-item';
      row.dataset.sku = sku;
      row.dataset.qty = '1';
      row.dataset.unit = String(price);
      row.innerHTML =
        '<div>' +
        '<div class="pos-cart-item-name"></div>' +
        '<div class="pos-cart-item-meta">Cant. 1</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px">' +
        '<div class="pos-cart-item-price"></div>' +
        '<button type="button" data-cart-remove aria-label="Quitar" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:2px;font-size:16px;line-height:1">×</button>' +
        '</div>';
      row.querySelector('.pos-cart-item-name').textContent = name;
      row.querySelector('.pos-cart-item-price').textContent = formatMoney(price);
      cartItems.appendChild(row);
    }
    recalcCart();
    showToast(name + ' agregado', 'ok');
  }

  function findFooterRow(footer, regex) {
    const rows = footer.querySelectorAll('.pos-total-row');
    for (const r of rows) {
      const label = (r.querySelector('span:first-child') || r).textContent || '';
      if (regex.test(label)) return r;
    }
    return null;
  }

  function recalcCart() {
    const footer = document.querySelector('.pos-cart-footer');
    if (!footer) return;
    const rows = document.querySelectorAll('.pos-cart-items .pos-cart-item');
    let subtotal = 0;
    rows.forEach(r => {
      const qty = parseInt(r.dataset.qty || '1', 10);
      const unit = parseFloat(r.dataset.unit || '0');
      if (qty && unit) subtotal += qty * unit;
      else subtotal += parsePrice((r.querySelector('.pos-cart-item-price') || {}).textContent);
    });
    const tax = subtotal * 0.16;
    const discountRow = findFooterRow(footer, /descuento/i);
    let discount = 0;
    if (discountRow) {
      const amt = discountRow.querySelector('.amount, span:last-child');
      if (amt) {
        discount = subtotal * 0.10;
        amt.textContent = '−' + formatMoney(discount);
      }
    }
    const total = subtotal + tax - discount;

    const subRow = findFooterRow(footer, /subtotal/i);
    const taxRow = findFooterRow(footer, /iva|impuesto/i);
    const totalRow = footer.querySelector('.pos-total-row.total') || findFooterRow(footer, /^total$|total/i);
    if (subRow) {
      const a = subRow.querySelector('.amount, span:last-child');
      if (a) a.textContent = formatMoney(subtotal);
    }
    if (taxRow) {
      const a = taxRow.querySelector('.amount, span:last-child');
      if (a) a.textContent = formatMoney(tax);
    }
    if (totalRow) {
      const a = totalRow.querySelector('.amount') || totalRow.querySelector('span:last-child');
      if (a) a.textContent = formatMoney(total);
    }
    const cobrar = footer.querySelector('button.btn-primary');
    if (cobrar) {
      cobrar.childNodes.forEach(n => {
        if (n.nodeType === 3 && /Cobrar/i.test(n.textContent)) n.textContent = ' Cobrar ' + formatMoney(total);
      });
    }
    const countBadge = document.querySelector('.pos-cart-header .badge');
    if (countBadge) {
      const n = Array.from(rows).reduce((s, r) => s + (parseInt(r.dataset.qty || '1', 10) || 1), 0);
      countBadge.textContent = n + (n === 1 ? ' item' : ' items');
    }
  }

  function resetPosCart() {
    const cartItems = document.querySelector('.pos-cart-items');
    if (!cartItems) return;
    cartItems.innerHTML = '';
    recalcCart();
  }

  // ---------- List page tab filters ----------
  function setupTabFilters() {
    document.querySelectorAll('.tab-group').forEach(group => {
      const tabs = group.querySelectorAll('.tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const filter = tab.dataset.filter;
          if (!filter) return;
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const scope = group.closest('.card') || document;
          const rows = scope.querySelectorAll('tbody tr');
          rows.forEach(row => {
            if (filter === 'all' || !row.dataset.status) {
              row.style.display = filter === 'all' ? '' : (row.dataset.status ? 'none' : '');
              if (filter === 'all') row.style.display = '';
              return;
            }
            const statuses = row.dataset.status.split(/\s+/);
            row.style.display = statuses.includes(filter) ? '' : 'none';
          });
        });
      });
    });
  }

  // ---------- Init ----------
  function init() {
    setupDrawer();
    setupFormEmulation();
    setupPos();
    setupTabFilters();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
