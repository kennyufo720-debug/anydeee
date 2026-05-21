/**
 * Anydeee Core — Auth + Session + Order Logic
 * 統一管理登入、訂單、帳戶狀態
 * 用 localStorage 模擬後端（可日後換成真實 API）
 */

// ── 資料層 ──────────────────────────────────────────────────────────
const ADB = {
  getUsers:    () => JSON.parse(localStorage.getItem('anyd_users') || '{}'),
  saveUsers:   u  => localStorage.setItem('anyd_users', JSON.stringify(u)),
  getSession:  () => JSON.parse(localStorage.getItem('anyd_session') || 'null'),
  saveSession: s  => localStorage.setItem('anyd_session', JSON.stringify(s)),
  clearSession:()  => localStorage.removeItem('anyd_session'),
  getOrders:   () => JSON.parse(localStorage.getItem('anyd_orders') || '[]'),
  saveOrders:  o  => localStorage.setItem('anyd_orders', JSON.stringify(o)),
  getNotifs:   () => JSON.parse(localStorage.getItem('anyd_notifs') || '[]'),
  addNotif:    msg => {
    const n = ADB.getNotifs();
    n.unshift({ msg, time: new Date().toLocaleString('zh-TW'), read: false });
    localStorage.setItem('anyd_notifs', JSON.stringify(n.slice(0,20)));
  }
};

// ── OTP 模擬 ────────────────────────────────────────────────────────
let _otp = null, _otpEmail = null;
function ADB_sendOTP(email) {
  _otp = Math.floor(100000 + Math.random() * 900000).toString();
  _otpEmail = email;
  ADB_toast(`OTP 已發送至 ${email}（Demo 驗證碼：${_otp}）`, 'info', 5000);
}
function ADB_verifyOTP(otp) { return otp === _otp; }

// ── Toast 通知 ──────────────────────────────────────────────────────
function ADB_toast(msg, type = 'info', dur = 3500) {
  const colors = { info:'#2d4a3e', error:'#7f1d1d', success:'#14532d', warn:'#78350f' };
  const icons  = { info:'ℹ️', error:'❌', success:'✅', warn:'⚠️' };
  const el = Object.assign(document.createElement('div'), {
    innerHTML: `<span>${icons[type]}</span> ${msg}`
  });
  Object.assign(el.style, {
    position:'fixed', bottom:'24px', right:'24px', zIndex:'99999',
    background: colors[type], color:'#f8fafc',
    padding:'12px 18px', borderRadius:'10px', fontSize:'13px',
    boxShadow:'0 4px 20px rgba(0,0,0,.5)', maxWidth:'340px',
    display:'flex', gap:'8px', alignItems:'flex-start',
    lineHeight:'1.5', fontFamily:'inherit',
    transition:'all .3s', opacity:'0', transform:'translateY(12px)'
  });
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity='1'; el.style.transform='translateY(0)'; });
  setTimeout(() => {
    el.style.opacity='0'; el.style.transform='translateY(12px)';
    setTimeout(() => el.remove(), 300);
  }, dur);
}

// ── 顯示 OTP 輸入框（不用 prompt，用自訂 modal）────────────────────
function ADB_showOTPModal(email, onSuccess) {
  const old = document.getElementById('_anydOTPModal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = '_anydOTPModal';
  modal.innerHTML = `
    <div style="position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center">
      <div style="background:#0d1018;border:1px solid rgba(201,168,76,.3);border-radius:16px;padding:32px;width:360px;max-width:90vw">
        <div style="font-size:18px;font-weight:700;color:#f8fafc;margin-bottom:6px">✉️ 輸入 OTP 驗證碼</div>
        <div style="font-size:13px;color:#64748b;margin-bottom:20px">已發送至 ${email}（Demo 驗證碼：${_otp}）</div>
        <input id="_anydOTPInput" type="text" maxlength="6" placeholder="6 位數驗證碼"
          style="width:100%;padding:12px 16px;background:#111620;border:1px solid rgba(255,255,255,.1);
                 border-radius:10px;color:#f8fafc;font-size:20px;letter-spacing:.2em;text-align:center;
                 outline:none;font-family:monospace;margin-bottom:16px" />
        <button id="_anydOTPSubmit"
          style="width:100%;padding:12px;border-radius:10px;font-size:14px;font-weight:600;
                 background:linear-gradient(135deg,#c9a84c,#a07828);color:#1c1917;border:none;cursor:pointer">
          驗證並登入
        </button>
        <div style="text-align:center;margin-top:12px">
          <span id="_anydOTPResend" style="font-size:12px;color:#c9a84c;cursor:pointer">重新發送 OTP</span>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const input = document.getElementById('_anydOTPInput');
  input.focus();

  document.getElementById('_anydOTPResend').onclick = () => ADB_sendOTP(email);

  const submit = () => {
    const val = input.value.trim();
    if (!ADB_verifyOTP(val)) {
      input.style.borderColor = '#ef4444';
      ADB_toast('OTP 錯誤，請重試', 'error');
      return;
    }
    modal.remove();
    onSuccess();
  };

  document.getElementById('_anydOTPSubmit').onclick = submit;
  input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}

// ── 更新導覽列 UI ───────────────────────────────────────────────────
function ADB_updateNav() {
  const s = ADB.getSession();

  // 找登入/註冊按鈕（各種寫法的網站都能找到）
  const allBtns = [...document.querySelectorAll('button, a')];
  const loginBtns = allBtns.filter(b => b.textContent.trim() === '登入');
  const regBtns   = allBtns.filter(b => b.textContent.trim() === '免費註冊' || b.textContent.trim() === '開立帳戶');

  // 找已登入的用戶 pill（各種 class 名稱）
  const userPills = document.querySelectorAll('[class*="user-pill"],[class*="userPill"],[class*="user_pill"]');

  if (s) {
    loginBtns.forEach(b => b.style.display = 'none');
    regBtns.forEach(b => b.style.display = 'none');

    // 更新 KYC 橫幅
    document.querySelectorAll('[class*="kyc-banner"],[class*="kycBanner"]').forEach(el => {
      if (s.kyc) el.style.display = 'none';
    });

    // 更新帳戶頁資料（如果在帳戶頁）
    const navEmail = document.getElementById('navUserEmail');
    const navAvatar = document.getElementById('navAvatarLetter');
    if (navEmail) navEmail.textContent = s.email;
    if (navAvatar) navAvatar.textContent = (s.email[0] || 'U').toUpperCase();

    const profileAvatar = document.getElementById('profileAvatar');
    const profileName   = document.getElementById('profileName');
    const profileEmail  = document.getElementById('profileEmail');
    const fieldEmail    = document.getElementById('fieldEmail');
    const fieldName     = document.getElementById('fieldName');
    const lastLogin     = document.getElementById('lastLogin');
    if (profileAvatar) profileAvatar.textContent = s.email[0].toUpperCase();
    if (profileName)   profileName.textContent   = s.name || s.email.split('@')[0];
    if (profileEmail)  profileEmail.textContent  = s.email;
    if (fieldEmail)    fieldEmail.value           = s.email;
    if (fieldName)     fieldName.value            = s.name || s.email.split('@')[0];
    if (lastLogin)     lastLogin.textContent      = new Date(s.loginAt).toLocaleString('zh-TW');

    // 顯示 DEALER 分潤區塊
    const role = s.role || 'USER';
    if (role === 'DEALER' || role === 'SUPPLIER') {
      document.querySelectorAll('[id="dealerLabel"],[id="commissionBtn"],[id="dealerIncomeCard"]').forEach(el => {
        el.style.display = el.tagName === 'BUTTON' ? 'flex' : 'block';
      });
    }

    // 通知徽章
    const notifBadge = document.querySelector('[class*="notif"] span, .notif-count');
    if (notifBadge) notifBadge.textContent = ADB.getNotifs().filter(n => !n.read).length || '';

  } else {
    loginBtns.forEach(b => b.style.display = '');
    regBtns.forEach(b => b.style.display = '');
  }
}

// ── 攔截登入表單 ────────────────────────────────────────────────────
function ADB_patchLogin() {
  // 找登入 Modal 裡的登入按鈕（排除 Nav 上的登入按鈕）
  const allBtns = [...document.querySelectorAll('button')];
  const submitBtns = allBtns.filter(b => {
    const txt = b.textContent.trim();
    return txt === '登入' && b.closest('[class*="modal"],[class*="Modal"],dialog,[id*="login"]');
  });

  submitBtns.forEach(btn => {
    if (btn.dataset.anydPatched) return;
    btn.dataset.anydPatched = '1';

    btn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      const modal = btn.closest('[class*="modal"],[class*="Modal"],dialog,[id*="login"]') || document.body;
      const emailEl = modal.querySelector('input[type="email"],input[name="email"]')
                   || [...modal.querySelectorAll('input')].find(i => i.placeholder?.toLowerCase().includes('mail'));
      const pwEl    = modal.querySelector('input[type="password"]');
      if (!emailEl?.value) { ADB_toast('請輸入電子郵件', 'error'); return; }

      const email = emailEl.value.trim().toLowerCase();
      const pw    = pwEl?.value || '';
      const users = ADB.getUsers();

      if (!users[email]) { ADB_toast('帳號不存在，請先註冊', 'error'); return; }
      if (users[email].password !== pw) { ADB_toast('密碼錯誤', 'error'); return; }

      ADB_sendOTP(email);
      ADB_showOTPModal(email, () => {
        ADB.saveSession({ ...users[email], email, loginAt: Date.now() });
        ADB_toast(`🎉 歡迎回來，${users[email].name || email}！`, 'success');
        ADB.addNotif(`登入成功：${new Date().toLocaleString('zh-TW')}`);
        // 關閉 modal
        const closeBtn = modal.querySelector('[class*="close"],[aria-label="close"],[data-dismiss]');
        if (closeBtn) closeBtn.click();
        else { modal.style.display = 'none'; modal.style.opacity = '0'; modal.style.pointerEvents = 'none'; }
        ADB_updateNav();
      });
    });
  });
}

// ── 攔截註冊表單 ────────────────────────────────────────────────────
function ADB_patchRegister() {
  const submitBtns = [...document.querySelectorAll('button')].filter(b => {
    const txt = b.textContent.trim();
    return (txt === '建立帳號' || txt === '註冊') &&
           b.closest('[class*="modal"],[class*="Modal"],dialog,[id*="register"],[id*="signup"]');
  });

  submitBtns.forEach(btn => {
    if (btn.dataset.anydPatched) return;
    btn.dataset.anydPatched = '1';

    btn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      const modal = btn.closest('[class*="modal"],[class*="Modal"],dialog,[id*="register"],[id*="signup"]') || document.body;
      const nameEl  = [...modal.querySelectorAll('input')].find(i => i.placeholder?.includes('名稱') || i.placeholder?.includes('name') || i.type === 'text');
      const emailEl = modal.querySelector('input[type="email"]') || [...modal.querySelectorAll('input')].find(i => i.placeholder?.toLowerCase().includes('mail'));
      const pwEl    = modal.querySelector('input[type="password"]');
      const pw2El   = [...modal.querySelectorAll('input[type="password"]')][1];

      if (!emailEl?.value) { ADB_toast('請輸入電子郵件', 'error'); return; }
      if (!pwEl?.value || pwEl.value.length < 6) { ADB_toast('密碼至少 6 個字元', 'error'); return; }
      if (pw2El && pw2El.value !== pwEl.value) { ADB_toast('兩次密碼不一致', 'error'); return; }

      const email = emailEl.value.trim().toLowerCase();
      const users = ADB.getUsers();
      if (users[email]) { ADB_toast('此 Email 已註冊，請直接登入', 'error'); return; }

      const newUser = {
        name: nameEl?.value?.trim() || email.split('@')[0],
        password: pwEl.value,
        email, kyc: false, vip: 0, anyu: 0,
        role: 'USER', createdAt: Date.now()
      };
      users[email] = newUser;
      ADB.saveUsers(users);
      ADB.saveSession({ ...newUser, loginAt: Date.now() });
      ADB_toast('🌱 帳號建立成功！歡迎加入 Anydeee', 'success', 4000);
      ADB.addNotif('帳號建立成功，歡迎加入 Anydeee！');

      const closeBtn = modal.querySelector('[class*="close"],[aria-label="close"]');
      if (closeBtn) closeBtn.click();
      else { modal.style.display = 'none'; modal.style.opacity = '0'; modal.style.pointerEvents = 'none'; }
      ADB_updateNav();
    });
  });
}

// ── 攔截登出 ────────────────────────────────────────────────────────
function ADB_patchLogout() {
  [...document.querySelectorAll('a,button')].filter(b =>
    b.textContent.includes('登出') || b.textContent.includes('Logout')
  ).forEach(btn => {
    if (btn.dataset.anydPatched) return;
    btn.dataset.anydPatched = '1';
    btn.addEventListener('click', e => {
      e.preventDefault();
      ADB.clearSession();
      ADB_toast('已安全登出', 'info');
      setTimeout(() => location.href = '/', 800);
    });
  });
}

// ── 攔截「立即認購」按鈕 ────────────────────────────────────────────
function ADB_patchBuy() {
  [...document.querySelectorAll('button')].filter(b =>
    b.textContent.includes('立即認購') || b.textContent.includes('立即購買')
  ).forEach(btn => {
    if (btn.dataset.anydPatched) return;
    btn.dataset.anydPatched = '1';

    btn.addEventListener('click', () => {
      const s = ADB.getSession();
      if (!s) {
        ADB_toast('請先登入才能認購', 'error');
        // 嘗試打開登入 modal
        const loginTrigger = [...document.querySelectorAll('button')].find(b =>
          b.textContent.trim() === '登入' && !b.closest('[class*="modal"]'));
        if (loginTrigger) loginTrigger.click();
        return;
      }

      // 取得卡片資訊
      const card = btn.closest('[class*="card"],[class*="item"],[class*="nft"],section,article') || btn.parentElement;
      const title = card.querySelector('h2,h3,h4,[class*="title"],[class*="name"]')?.textContent?.trim() || '未知系列';
      const priceEl = card.querySelector('[class*="price"],[class*="Price"]');
      const price = priceEl?.textContent?.trim() || '—';

      // 建立訂單
      const orderId = `ORD-${Date.now().toString().slice(-6)}`;
      const order = {
        id: orderId, user: s.email, item: title, price,
        status: '待付款', zone: 'RWA交易所',
        createdAt: new Date().toLocaleString('zh-TW'),
        updatedAt: new Date().toLocaleString('zh-TW'),
      };
      const orders = ADB.getOrders();
      orders.unshift(order);
      ADB.saveOrders(orders);
      ADB.addNotif(`訂單建立：${title}，訂單號 #${orderId}`);

      ADB_toast(`✅ 訂單建立！#${orderId}`, 'success', 4000);

      // 詢問是否前往帳戶查看
      setTimeout(() => {
        if (confirm(`訂單 #${orderId} 已建立！\n商品：${title}\n\n要前往帳戶查看訂單嗎？`)) {
          location.href = '/account#orders';
        }
      }, 500);
    });
  });
}

// ── 攔截「複製」按鈕 ────────────────────────────────────────────────
function ADB_patchCopy() {
  [...document.querySelectorAll('button')].filter(b =>
    b.textContent.trim() === '複製' || b.textContent.includes('複製連結')
  ).forEach(btn => {
    if (btn.dataset.anydPatched) return;
    btn.dataset.anydPatched = '1';
    btn.addEventListener('click', () => {
      const s = ADB.getSession();
      const code = s ? `ANYU-${s.email.slice(0,6).toUpperCase().replace('@','')}` : 'ANYU-DEMO';
      const url = `https://anydeee.vercel.app/?ref=${code}`;
      navigator.clipboard.writeText(url)
        .then(() => ADB_toast('✅ 推薦連結已複製！', 'success'))
        .catch(() => ADB_toast(`推薦連結：${url}`, 'info', 6000));
    });
  });
}

// ── 攔截 KYC 完成 ───────────────────────────────────────────────────
function ADB_patchKYC() {
  [...document.querySelectorAll('button')].filter(b =>
    b.textContent.includes('綁定並完成 KYC') || b.textContent.includes('完成 KYC')
  ).forEach(btn => {
    if (btn.dataset.anydPatched) return;
    btn.dataset.anydPatched = '1';
    btn.addEventListener('click', () => {
      const s = ADB.getSession();
      if (!s) return;
      s.kyc = true;
      s.vip = Math.max(s.vip || 0, 1);
      ADB.saveSession(s);
      const users = ADB.getUsers();
      if (users[s.email]) { users[s.email].kyc = true; users[s.email].vip = 1; ADB.saveUsers(users); }
      ADB_toast('🎉 KYC 驗證完成！VIP 1 已解鎖', 'success', 4000);
      ADB.addNotif('KYC 驗證完成，VIP 1 已解鎖！');
      ADB_updateNav();
    });
  });
}

// ── 帳戶頁：渲染真實訂單 ────────────────────────────────────────────
function ADB_renderOrders() {
  const container = document.getElementById('page-orders');
  if (!container) return;
  const s = ADB.getSession();
  if (!s) return;

  const orders = ADB.getOrders().filter(o => o.user === s.email);
  if (orders.length === 0) return; // 保留 demo 訂單

  // 清除 demo 訂單，插入真實訂單
  const demoCards = container.querySelectorAll('.order-card');
  // 在最前面插入真實訂單
  const header = container.querySelector('.page-header');
  orders.forEach(order => {
    const statusColor = { '待付款':'#f59e0b','等待鑄造':'#60a5fa','鑄造中':'#818cf8','已鑄造':'#34d399','已取消':'#f87171' };
    const div = document.createElement('div');
    div.className = 'order-card';
    div.style.borderColor = 'rgba(201,168,76,0.2)';
    div.innerHTML = `
      <div class="order-header">
        <div>
          <div class="order-id">#${order.id} · ${order.createdAt}</div>
          <div class="order-name">${order.item}</div>
          <div class="order-zone">${order.zone || 'RWA 交易所'} · 數量：1</div>
        </div>
        <span class="badge" style="background:rgba(245,158,11,.12);color:${statusColor[order.status]||'#94a3b8'};border:1px solid ${statusColor[order.status]||'#94a3b8'}">${order.status}</span>
      </div>
      <div class="order-meta">
        <div class="order-meta-item">
          <div class="lab">訂單金額</div>
          <div class="val" style="color:#c9a84c">${order.price}</div>
        </div>
        <div class="order-meta-item">
          <div class="lab">建立時間</div>
          <div class="val" style="font-size:11px">${order.createdAt}</div>
        </div>
      </div>`;
    header.after(div);
  });
}

// ── 保護路由（帳戶/後台需要登入）───────────────────────────────────
function ADB_guardRoute() {
  const path = location.pathname;
  const s = ADB.getSession();
  if ((path.includes('account') || path.includes('admin')) && !s) {
    ADB_toast('請先登入', 'error');
    setTimeout(() => location.href = '/', 1000);
  }
}

// ── MutationObserver：動態 Modal 也能攔截 ───────────────────────────
let _patchTimer = null;
const _observer = new MutationObserver(() => {
  clearTimeout(_patchTimer);
  _patchTimer = setTimeout(() => {
    ADB_patchLogin();
    ADB_patchRegister();
    ADB_patchLogout();
    ADB_patchBuy();
    ADB_patchCopy();
    ADB_patchKYC();
  }, 150);
});

// ── 初始化 ──────────────────────────────────────────────────────────
function ADB_init() {
  ADB_guardRoute();
  ADB_updateNav();
  ADB_patchLogin();
  ADB_patchRegister();
  ADB_patchLogout();
  ADB_patchBuy();
  ADB_patchCopy();
  ADB_patchKYC();
  ADB_renderOrders();
  _observer.observe(document.body, { childList: true, subtree: true });
  console.log('%c[Anydeee Core] ✅ 已載入 v1.0', 'color:#c9a84c;font-weight:bold');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ADB_init);
else ADB_init();
