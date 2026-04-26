/**
 * Wealthy9 AI Receptionist Widget
 * Drop-in chat widget powered by Aria — the Wealthy9 AI receptionist.
 *
 * Usage: Add to any page:
 *   <script>window.W9_API_URL = 'https://your-server.com';</script>
 *   <script src="/receptionist.js"></script>
 */
(function () {
  'use strict';

  const API = (window.W9_API_URL || '').replace(/\/$/, '');

  // ─── State ────────────────────────────────────────────────────────────────
  let messages = [];
  let isOpen = false;
  let isBusy = false;
  let greetedOnce = false;

  // ─── Styles ───────────────────────────────────────────────────────────────
  const CSS = `
    .w9-float{position:fixed;bottom:24px;right:24px;width:58px;height:58px;background:#00C8F0;border-radius:50%;cursor:pointer;z-index:2147483647;display:flex;align-items:center;justify-content:center;border:none;box-shadow:0 4px 20px rgba(0,200,240,.45);animation:w9pulse 2.8s ease-in-out infinite;transition:transform .2s}
    .w9-float:hover{transform:scale(1.1)}
    @keyframes w9pulse{0%,100%{box-shadow:0 4px 20px rgba(0,200,240,.45),0 0 0 0 rgba(0,200,240,.3)}70%{box-shadow:0 4px 20px rgba(0,200,240,.45),0 0 0 14px rgba(0,200,240,0)}}
    .w9-float svg{width:26px;height:26px;fill:#02040F;pointer-events:none}
    .w9-badge{position:absolute;top:-1px;right:-1px;width:15px;height:15px;background:#FF4757;border-radius:50%;border:2px solid #02040F;display:none}
    .w9-badge.show{display:block;animation:w9pop .3s cubic-bezier(.175,.885,.32,1.275)}
    @keyframes w9pop{from{transform:scale(0)}to{transform:scale(1)}}

    .w9-win{position:fixed;bottom:96px;right:24px;width:368px;height:540px;background:#02040F;border:1px solid rgba(0,200,240,.18);z-index:2147483646;display:none;flex-direction:column;box-shadow:0 20px 70px rgba(0,0,0,.75),0 0 0 1px rgba(0,200,240,.05);transform-origin:bottom right}
    .w9-win.open{display:flex;animation:w9slide .22s cubic-bezier(.175,.885,.32,1.275)}
    @keyframes w9slide{from{opacity:0;transform:scale(.88)}to{opacity:1;transform:scale(1)}}

    .w9-hd{background:#060914;padding:14px 16px;border-bottom:1px solid rgba(0,200,240,.1);display:flex;align-items:center;gap:11px;flex-shrink:0}
    .w9-av{width:38px;height:38px;background:rgba(0,200,240,.1);border:1px solid rgba(0,200,240,.25);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
    .w9-hd-name{font-size:13px;color:#F0F4FF;letter-spacing:.05em;font-family:Georgia,serif}
    .w9-hd-status{font-size:9px;letter-spacing:.2em;color:#00C8F0;text-transform:uppercase;font-family:Arial,sans-serif;display:flex;align-items:center;gap:5px;margin-top:2px}
    .w9-dot{width:5px;height:5px;background:#00C8F0;border-radius:50%;animation:w9blink 1.8s ease-in-out infinite}
    @keyframes w9blink{0%,100%{opacity:1}50%{opacity:.25}}
    .w9-hd-info{flex:1;min-width:0}
    .w9-x{width:28px;height:28px;background:none;border:none;color:rgba(240,244,255,.3);font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:3px;transition:color .2s,background .2s;padding:0;flex-shrink:0}
    .w9-x:hover{color:#F0F4FF;background:rgba(240,244,255,.07)}

    .w9-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:13px;scrollbar-width:thin;scrollbar-color:rgba(0,200,240,.15) transparent}
    .w9-msgs::-webkit-scrollbar{width:3px}
    .w9-msgs::-webkit-scrollbar-thumb{background:rgba(0,200,240,.2);border-radius:2px}
    .w9-msg{display:flex;flex-direction:column;animation:w9min .18s ease}
    @keyframes w9min{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
    .w9-msg.u{align-items:flex-end}
    .w9-msg.a{align-items:flex-start}
    .w9-bub{max-width:86%;padding:10px 13px;font-size:13px;line-height:1.65;font-family:Arial,sans-serif}
    .w9-msg.u .w9-bub{background:#00C8F0;color:#02040F}
    .w9-msg.a .w9-bub{background:#060914;color:#D0D8EE;border:1px solid rgba(0,200,240,.1)}
    .w9-ts{font-size:9px;color:rgba(138,155,191,.45);letter-spacing:.1em;text-transform:uppercase;font-family:Arial,sans-serif;margin-top:3px;padding:0 2px}

    .w9-typing-bub{background:#060914;border:1px solid rgba(0,200,240,.1);padding:12px 14px;display:flex;gap:4px;align-items:center;width:fit-content}
    .w9-typing-bub span{width:5px;height:5px;background:#00C8F0;border-radius:50%;animation:w9tdot 1.3s ease-in-out infinite}
    .w9-typing-bub span:nth-child(2){animation-delay:.2s}
    .w9-typing-bub span:nth-child(3){animation-delay:.4s}
    @keyframes w9tdot{0%,80%,100%{transform:scale(.6);opacity:.3}40%{transform:scale(1);opacity:1}}

    .w9-qa{padding:0 16px 12px;display:flex;flex-wrap:wrap;gap:5px;flex-shrink:0}
    .w9-qa-btn{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#00C8F0;border:1px solid rgba(0,200,240,.2);background:none;padding:6px 10px;cursor:pointer;font-family:Arial,sans-serif;transition:all .2s;white-space:nowrap}
    .w9-qa-btn:hover{background:rgba(0,200,240,.08);border-color:rgba(0,200,240,.5)}

    .w9-inp-wrap{border-top:1px solid rgba(0,200,240,.1);padding:11px 12px;display:flex;gap:8px;flex-shrink:0;background:#060914}
    .w9-inp{flex:1;background:rgba(240,244,255,.04);border:1px solid rgba(0,200,240,.12);color:#F0F4FF;font-size:13px;font-family:Arial,sans-serif;padding:9px 11px;outline:none;resize:none;line-height:1.4;transition:border-color .2s;height:38px;overflow:hidden}
    .w9-inp:focus{border-color:rgba(0,200,240,.38)}
    .w9-inp::placeholder{color:rgba(138,155,191,.35)}
    .w9-send{width:38px;height:38px;background:#00C8F0;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .18s,transform .1s}
    .w9-send:hover{background:#20D8FF}
    .w9-send:active{transform:scale(.93)}
    .w9-send svg{width:15px;height:15px;fill:#02040F}
    .w9-send:disabled{background:rgba(0,200,240,.3);cursor:not-allowed}

    .w9-book-bar{display:flex;justify-content:center;padding:2px 0 8px;flex-shrink:0}
    .w9-book-cta{font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:#02040F;background:#00C8F0;border:none;padding:11px 22px;cursor:pointer;font-family:Arial,sans-serif;transition:background .18s}
    .w9-book-cta:hover{background:#20D8FF}

    .w9-form-wrap{position:absolute;inset:0;background:#02040F;display:flex;flex-direction:column;overflow:hidden;animation:w9slide .2s ease}
    .w9-form-hd{background:#060914;padding:14px 16px;border-bottom:1px solid rgba(0,200,240,.1);display:flex;align-items:center;gap:10px;flex-shrink:0}
    .w9-back{background:none;border:none;color:rgba(138,155,191,.6);font-size:19px;cursor:pointer;padding:0;line-height:1;transition:color .2s}
    .w9-back:hover{color:#F0F4FF}
    .w9-form-title{font-size:11px;letter-spacing:.25em;color:#00C8F0;text-transform:uppercase;font-family:Arial,sans-serif}
    .w9-form-body{padding:18px 16px;flex:1;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(0,200,240,.12) transparent}
    .w9-form-note{font-size:12px;color:rgba(138,155,191,.75);line-height:1.75;font-family:Arial,sans-serif;margin-bottom:18px}
    .w9-field{margin-bottom:11px}
    .w9-field label{display:block;font-size:9px;letter-spacing:.2em;color:rgba(138,155,191,.65);text-transform:uppercase;font-family:Arial,sans-serif;margin-bottom:4px}
    .w9-field input,.w9-field select{width:100%;background:rgba(240,244,255,.04);border:1px solid rgba(0,200,240,.12);color:#F0F4FF;font-size:13px;font-family:Arial,sans-serif;padding:9px 11px;outline:none;transition:border-color .2s;-webkit-appearance:none;appearance:none}
    .w9-field input:focus,.w9-field select:focus{border-color:rgba(0,200,240,.4)}
    .w9-field input::placeholder{color:rgba(138,155,191,.3)}
    .w9-field select option{background:#060914;color:#F0F4FF}
    .w9-submit{width:100%;background:#00C8F0;border:none;color:#02040F;font-size:10px;letter-spacing:.25em;text-transform:uppercase;font-family:Arial,sans-serif;padding:14px;cursor:pointer;margin-top:8px;transition:background .18s}
    .w9-submit:hover{background:#20D8FF}
    .w9-submit:disabled{background:rgba(0,200,240,.28);cursor:not-allowed}

    .w9-success{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;text-align:center;height:100%}
    .w9-success-icon{width:54px;height:54px;background:rgba(0,200,240,.1);border:1px solid rgba(0,200,240,.3);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:18px}
    .w9-success h3{font-size:21px;font-weight:400;color:#F0F4FF;letter-spacing:.04em;font-family:Georgia,serif;margin:0 0 10px}
    .w9-success p{font-size:13px;color:rgba(138,155,191,.8);line-height:1.75;font-family:Arial,sans-serif;margin:0 0 24px}
    .w9-success-back{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#00C8F0;border:1px solid rgba(0,200,240,.2);background:none;padding:10px 20px;cursor:pointer;font-family:Arial,sans-serif;transition:all .2s}
    .w9-success-back:hover{background:rgba(0,200,240,.08)}

    @media(max-width:400px){.w9-win{width:calc(100vw - 20px);right:10px;bottom:90px}}
  `;

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function ts() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function scrollBottom() {
    const el = document.getElementById('w9-msgs');
    if (el) el.scrollTop = el.scrollHeight;
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatMsg(text) {
    return escHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  // ─── Build DOM ────────────────────────────────────────────────────────────
  function inject() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    // Float button
    const btn = document.createElement('button');
    btn.id = 'w9-float';
    btn.className = 'w9-float';
    btn.setAttribute('aria-label', 'Chat with Aria — Wealthy9 AI Receptionist');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
      <div class="w9-badge" id="w9-badge"></div>`;
    document.body.appendChild(btn);

    // Chat window
    const win = document.createElement('div');
    win.id = 'w9-win';
    win.className = 'w9-win';
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-label', 'Wealthy9 AI Receptionist');
    win.innerHTML = `
      <div class="w9-hd">
        <div class="w9-av">✦</div>
        <div class="w9-hd-info">
          <div class="w9-hd-name">Aria — Wealthy9</div>
          <div class="w9-hd-status"><div class="w9-dot"></div>Online Now</div>
        </div>
        <button class="w9-x" id="w9-close" aria-label="Close chat">✕</button>
      </div>
      <div class="w9-msgs" id="w9-msgs"></div>
      <div class="w9-qa" id="w9-qa">
        <button class="w9-qa-btn" data-q="What packages do you offer?">Packages</button>
        <button class="w9-qa-btn" data-q="Tell me about your services">Services</button>
        <button class="w9-qa-btn" data-q="Do you do reels and video content?">Reels & Video</button>
        <button class="w9-qa-btn" data-q="I want a free audit">Free Audit</button>
      </div>
      <div class="w9-inp-wrap">
        <textarea id="w9-inp" class="w9-inp" placeholder="Ask Aria anything…" rows="1" aria-label="Message input"></textarea>
        <button id="w9-send" class="w9-send" aria-label="Send message">
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>`;
    document.body.appendChild(win);

    // Events
    btn.addEventListener('click', toggle);
    document.getElementById('w9-close').addEventListener('click', close);
    document.getElementById('w9-send').addEventListener('click', send);
    document.getElementById('w9-inp').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    document.getElementById('w9-qa').addEventListener('click', function (e) {
      const q = e.target.closest('.w9-qa-btn');
      if (q) { document.getElementById('w9-inp').value = q.dataset.q; send(); }
    });

    // Show badge after 8s to invite engagement
    setTimeout(function () {
      if (!isOpen) document.getElementById('w9-badge').classList.add('show');
    }, 8000);
  }

  // ─── Chat window open/close ───────────────────────────────────────────────
  function toggle() { isOpen ? close() : open(); }

  function open() {
    isOpen = true;
    const win = document.getElementById('w9-win');
    const badge = document.getElementById('w9-badge');
    win.classList.add('open');
    badge.classList.remove('show');

    if (!greetedOnce) {
      greetedOnce = true;
      setTimeout(function () {
        pushAI("Welcome to Wealthy9. I'm Aria, your AI receptionist.\n\nWhether you want to know about our packages, reels & video content, or book your free digital marketing audit — I'm here. What can I do for you today?");
      }, 380);
    }

    setTimeout(function () {
      const inp = document.getElementById('w9-inp');
      if (inp) inp.focus();
    }, 300);
  }

  function close() {
    isOpen = false;
    document.getElementById('w9-win').classList.remove('open');
  }

  // ─── Messaging ────────────────────────────────────────────────────────────
  function pushMsg(role, text) {
    messages.push({ role: role, content: text, ts: ts() });
    renderMsg(messages[messages.length - 1]);
    scrollBottom();
  }

  function pushAI(text) { pushMsg('assistant', text); }

  function renderMsg(msg) {
    const container = document.getElementById('w9-msgs');
    if (!container) return;

    const el = document.createElement('div');
    el.className = 'w9-msg ' + (msg.role === 'user' ? 'u' : 'a');
    el.innerHTML = '<div class="w9-bub">' + formatMsg(msg.content) + '</div><div class="w9-ts">' + msg.ts + '</div>';
    container.appendChild(el);
  }

  function showTyping() {
    const container = document.getElementById('w9-msgs');
    if (!container || document.getElementById('w9-typing')) return;
    const el = document.createElement('div');
    el.className = 'w9-msg a';
    el.id = 'w9-typing';
    el.innerHTML = '<div class="w9-typing-bub"><span></span><span></span><span></span></div>';
    container.appendChild(el);
    scrollBottom();
  }

  function hideTyping() {
    const el = document.getElementById('w9-typing');
    if (el) el.remove();
  }

  function showBookingBar() {
    if (document.getElementById('w9-book-bar')) return;
    const win = document.getElementById('w9-win');
    const bar = document.createElement('div');
    bar.className = 'w9-book-bar';
    bar.id = 'w9-book-bar';
    bar.innerHTML = '<button class="w9-book-cta" id="w9-book-cta">Book Free Audit →</button>';
    const qa = document.getElementById('w9-qa');
    win.insertBefore(bar, qa);
    document.getElementById('w9-book-cta').addEventListener('click', showForm);
  }

  // ─── Send message ─────────────────────────────────────────────────────────
  async function send() {
    const inp = document.getElementById('w9-inp');
    if (!inp || isBusy) return;

    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';

    document.getElementById('w9-qa').style.display = 'none';
    pushMsg('user', text);

    isBusy = true;
    document.getElementById('w9-send').disabled = true;
    showTyping();

    try {
      const payload = messages
        .filter(function (m) { return m.role === 'user' || m.role === 'assistant'; })
        .map(function (m) { return { role: m.role, content: m.content }; });

      const res = await fetch(API + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payload })
      });

      if (!res.ok) throw new Error('Server error ' + res.status);
      const data = await res.json();

      hideTyping();
      pushAI(data.message);

      const lower = data.message.toLowerCase();
      if (lower.includes('audit') || lower.includes('book') || lower.includes('schedule') || lower.includes('get started')) {
        showBookingBar();
      }

    } catch (_err) {
      hideTyping();
      pushAI("I apologize — something went wrong on my end. Please try again or reach us directly at contact@wealthy9.com");
    } finally {
      isBusy = false;
      document.getElementById('w9-send').disabled = false;
    }
  }

  // ─── Booking form ─────────────────────────────────────────────────────────
  function showForm() {
    const win = document.getElementById('w9-win');
    if (document.getElementById('w9-form')) return;

    const wrap = document.createElement('div');
    wrap.className = 'w9-form-wrap';
    wrap.id = 'w9-form';
    wrap.innerHTML = `
      <div class="w9-form-hd">
        <button class="w9-back" id="w9-form-back" aria-label="Back">←</button>
        <div class="w9-form-title">Book Your Free Audit</div>
      </div>
      <div class="w9-form-body">
        <p class="w9-form-note">Zero cost. Zero obligation. We audit your digital presence, find your top 5 gaps, and show you exactly what you're missing.</p>
        <form id="w9-audit-form" novalidate>
          <div class="w9-field"><label>Full Name *</label><input type="text" name="name" required placeholder="Your full name" autocomplete="name"></div>
          <div class="w9-field"><label>Business Name *</label><input type="text" name="business" required placeholder="Your business name"></div>
          <div class="w9-field">
            <label>Industry</label>
            <select name="industry">
              <option value="">Select your industry</option>
              <option>Hospital / Health System</option>
              <option>Law Firm</option>
              <option>Dental Practice</option>
              <option>Medical Practice</option>
              <option>Real Estate</option>
              <option>Restaurant</option>
              <option>Retail Brand</option>
              <option>Police / Government</option>
              <option>Professional Services</option>
              <option>Other</option>
            </select>
          </div>
          <div class="w9-field"><label>Email Address *</label><input type="email" name="email" required placeholder="your@email.com" autocomplete="email"></div>
          <div class="w9-field"><label>Phone Number</label><input type="tel" name="phone" placeholder="(305) 000-0000" autocomplete="tel"></div>
          <div class="w9-field">
            <label>Preferred Time</label>
            <select name="preferredTime">
              <option value="">Select a time</option>
              <option>Monday Morning (9am–12pm ET)</option>
              <option>Monday Afternoon (1pm–5pm ET)</option>
              <option>Tuesday Morning (9am–12pm ET)</option>
              <option>Tuesday Afternoon (1pm–5pm ET)</option>
              <option>Wednesday Morning (9am–12pm ET)</option>
              <option>Wednesday Afternoon (1pm–5pm ET)</option>
              <option>Thursday Morning (9am–12pm ET)</option>
              <option>Thursday Afternoon (1pm–5pm ET)</option>
              <option>Friday Morning (9am–12pm ET)</option>
              <option>Friday Afternoon (1pm–5pm ET)</option>
              <option>Flexible — Anytime Works</option>
            </select>
          </div>
          <button type="submit" class="w9-submit" id="w9-submit">Request My Free Audit →</button>
        </form>
      </div>`;

    win.style.position = 'relative';
    win.appendChild(wrap);

    document.getElementById('w9-form-back').addEventListener('click', function () {
      wrap.remove();
    });

    document.getElementById('w9-audit-form').addEventListener('submit', submitForm);
  }

  async function submitForm(e) {
    e.preventDefault();
    const form = e.target;
    const btn = document.getElementById('w9-submit');
    const name = form.name.value.trim();
    const email = form.email.value.trim();

    if (!name || !email || !email.includes('@')) {
      form.name.style.borderColor = name ? '' : 'rgba(255,71,87,.6)';
      form.email.style.borderColor = email.includes('@') ? '' : 'rgba(255,71,87,.6)';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Submitting…';

    const data = {
      name: name,
      business: form.business.value.trim(),
      industry: form.industry.value,
      email: email,
      phone: form.phone.value.trim(),
      preferredTime: form.preferredTime.value,
      source: 'Website Chat Widget'
    };

    try {
      const res = await fetch(API + '/api/book-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Failed');

      // Show success
      const wrap = document.getElementById('w9-form');
      wrap.innerHTML = `
        <div class="w9-success">
          <div class="w9-success-icon">✓</div>
          <h3>You're All Set</h3>
          <p>Your free audit is requested, ${escHtml(name)}. A Wealthy9 strategist will reach out within 24 hours to confirm your appointment.</p>
          <button class="w9-success-back" id="w9-done-back">Back to Chat</button>
        </div>`;

      document.getElementById('w9-done-back').addEventListener('click', function () {
        document.getElementById('w9-form').remove();
      });

      pushAI("You're confirmed, " + name + "! Check your inbox — a strategist will reach out within 24 hours. Feel free to ask me anything else in the meantime.");

    } catch (_err) {
      btn.disabled = false;
      btn.textContent = 'Request My Free Audit →';
      const errEl = document.createElement('p');
      errEl.style.cssText = 'font-size:12px;color:rgba(255,71,87,.8);font-family:Arial,sans-serif;margin-top:8px;text-align:center';
      errEl.textContent = 'Something went wrong. Email us at contact@wealthy9.com';
      if (!form.querySelector('.w9-err')) {
        errEl.className = 'w9-err';
        form.appendChild(errEl);
      }
    }
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }

})();
