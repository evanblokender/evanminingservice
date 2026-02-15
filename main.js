const API_BASE = 'https://YOUR-APP-NAME.onrender.com';

function setCookie(name, value, days = 365) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Lax`;
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function getTicketHistory() {
  try {
    return JSON.parse(getCookie('ems_ticket_history') || '[]');
  } catch { return []; }
}

function saveTicketToHistory(ticket) {
  const history = getTicketHistory();
  history.unshift({ ...ticket, savedAt: new Date().toISOString() });
  // Keep last 10
  setCookie('ems_ticket_history', JSON.stringify(history.slice(0, 10)));
}

// ============================================================
// State
// ============================================================
let currentStep = 'home';
let selectedPlatform = null;
let selectedArea = null;

const AREA_OPTIONS = [
  { id: 'small',  label: 'Small',  size: '5×5',   meters: '-5m',  desc: 'Perfect for a personal mine' },
  { id: 'medium', label: 'Medium', size: '15×15',  meters: '-15m', desc: 'Great for resource gathering' },
  { id: 'large',  label: 'Large',  size: '20×20',  meters: '-20m', desc: 'For serious miners' },
  { id: 'huge',   label: 'Huge',   size: '50×50',  meters: '-50m', desc: 'Maximum excavation zone' },
];

// ============================================================
// DOM helpers
// ============================================================
function show(id) { const el = document.getElementById(id); if (el) el.style.display = ''; }
function hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
function setText(id, t) { const el = document.getElementById(id); if (el) el.textContent = t; }

function showView(view) {
  ['view-home', 'view-ticket', 'view-reviews'].forEach(v => hide(v));
  show('view-' + view);
  currentStep = view;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// Toast notifications
// ============================================================
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  t.innerHTML = `<span>${icon}</span> ${msg}`;
  t.className = 'toast toast-' + type + ' toast-show';
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.classList.remove('toast-show'), 4000);
}

// ============================================================
// Ticket form — Step 1: Platform selection
// ============================================================
function selectPlatform(platform) {
  selectedPlatform = platform;
  document.querySelectorAll('.platform-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('btn-' + platform).classList.add('selected');
  
  const hint = document.getElementById('bedrock-hint');
  if (platform === 'bedrock') {
    hint.style.display = 'flex';
  } else {
    hint.style.display = 'none';
  }
  
  // Show step 2
  document.getElementById('step-area').style.opacity = '1';
  document.getElementById('step-area').style.pointerEvents = 'auto';
  document.getElementById('step-username').style.opacity = '1';
  document.getElementById('step-username').style.pointerEvents = 'auto';
}

function selectArea(areaId) {
  selectedArea = areaId;
  document.querySelectorAll('.area-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('area-' + areaId).classList.add('selected');
}

// ============================================================
// Submit ticket
// ============================================================
async function submitTicket() {
  const username = document.getElementById('username-input').value.trim();
  const email = document.getElementById('email-input').value.trim();

  if (!selectedPlatform) return showToast('Please select your platform (Java or Bedrock)', 'error');
  if (!selectedArea) return showToast('Please select an area size', 'error');
  if (!username) return showToast('Please enter your Minecraft username', 'error');
  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) return showToast('Please enter a valid email address', 'error');

  const finalUsername = selectedPlatform === 'bedrock' ? `.${username}` : username;
  const areaOption = AREA_OPTIONS.find(a => a.id === selectedArea);
  const areaLabel = `${areaOption.label} (${areaOption.meters})`;

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    const res = await fetch(API_BASE + '/api/ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: finalUsername,
        platform: selectedPlatform,
        areaSize: areaLabel,
        email,
      }),
    });

    const data = await res.json();
    if (data.success) {
      // Save to cookie history
      saveTicketToHistory({ username: finalUsername, platform: selectedPlatform, areaSize: areaLabel, email, submittedAt: new Date().toISOString() });
      
      // Show success screen
      document.getElementById('ticket-form-area').style.display = 'none';
      document.getElementById('ticket-success').style.display = 'block';
      setText('success-username', finalUsername);
      setText('success-area', areaLabel);
      setText('success-email', email);
    } else {
      showToast(data.error || 'Failed to submit ticket', 'error');
    }
  } catch (e) {
    showToast('Network error — is the backend running?', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Ticket';
  }
}

function resetTicketForm() {
  selectedPlatform = null;
  selectedArea = null;
  document.querySelectorAll('.platform-btn').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.area-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('username-input').value = '';
  document.getElementById('email-input').value = '';
  document.getElementById('bedrock-hint').style.display = 'none';
  document.getElementById('step-area').style.opacity = '0.4';
  document.getElementById('step-area').style.pointerEvents = 'none';
  document.getElementById('step-username').style.opacity = '0.4';
  document.getElementById('step-username').style.pointerEvents = 'none';
  document.getElementById('ticket-form-area').style.display = 'block';
  document.getElementById('ticket-success').style.display = 'none';
}

// ============================================================
// Ratings
// ============================================================
let selectedRating = 0;

function setRatingStar(n) {
  selectedRating = n;
  document.querySelectorAll('.star-btn').forEach((s, i) => {
    s.classList.toggle('active', i < n);
  });
  setText('rating-label', ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][n] || '');
}

async function submitRating() {
  const username = document.getElementById('review-username').value.trim();
  const review = document.getElementById('review-text').value.trim();

  if (!username) return showToast('Please enter your Minecraft username', 'error');
  if (!selectedRating) return showToast('Please select a star rating', 'error');

  const btn = document.getElementById('rating-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    const res = await fetch(API_BASE + '/api/rating', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, rating: selectedRating, review }),
    });
    const data = await res.json();
    if (data.success) {
      showToast('⭐ Thank you for your review!', 'success');
      document.getElementById('review-username').value = '';
      document.getElementById('review-text').value = '';
      selectedRating = 0;
      setRatingStar(0);
      loadRatings();
    } else {
      showToast(data.error || 'Failed to submit review', 'error');
    }
  } catch(e) {
    showToast('Network error', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Review';
  }
}

async function loadRatings() {
  try {
    const res = await fetch(API_BASE + '/api/ratings');
    const data = await res.json();
    renderRatings(data);
  } catch(e) {
    document.getElementById('ratings-list').innerHTML = '<p style="color:#4a6a9e;text-align:center;">Could not load reviews.</p>';
  }
}

function renderRatings({ ratings, average, total }) {
  const avgEl = document.getElementById('avg-rating');
  const totalEl = document.getElementById('total-reviews');
  const avgStars = document.getElementById('avg-stars');
  const list = document.getElementById('ratings-list');

  if (avgEl) avgEl.textContent = total > 0 ? average.toFixed(1) : '—';
  if (totalEl) totalEl.textContent = total > 0 ? `${total} review${total !== 1 ? 's' : ''}` : 'No reviews yet';
  if (avgStars) avgStars.innerHTML = total > 0 ? renderStars(average) : '';

  if (!ratings || ratings.length === 0) {
    list.innerHTML = '<p style="color:#4a6a9e;text-align:center;padding:32px 0;">No reviews yet. Be the first!</p>';
    return;
  }

  list.innerHTML = ratings.slice().reverse().map(r => `
    <div class="review-card">
      <div class="review-header">
        <span class="review-user">⛏ ${r.username}</span>
        <span class="review-stars">${renderStars(r.rating)}</span>
      </div>
      ${r.review ? `<p class="review-text">${escapeHtml(r.review)}</p>` : ''}
      <div class="review-date">${new Date(r.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
    </div>
  `).join('');
}

function renderStars(n) {
  const full = Math.floor(n);
  const half = n - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '⭐'.repeat(full) + (half ? '✨' : '') + '☆'.repeat(empty);
}

function escapeHtml(t) {
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================
// Ticket history from cookies
// ============================================================
function renderTicketHistory() {
  const history = getTicketHistory();
  const el = document.getElementById('ticket-history');
  if (!el) return;
  if (history.length === 0) {
    el.innerHTML = '<p style="color:#4a6a9e;font-size:14px;text-align:center;padding:16px 0;">No previous tickets found on this device.</p>';
    return;
  }
  el.innerHTML = history.map(t => `
    <div class="history-item">
      <span class="history-user">⛏ ${t.username}</span>
      <span class="history-area">${t.areaSize}</span>
      <span class="history-date">${new Date(t.submittedAt || t.savedAt).toLocaleDateString()}</span>
    </div>
  `).join('');
}

// ============================================================
// Init
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Nav links
  document.getElementById('nav-home').addEventListener('click', () => showView('home'));
  document.getElementById('nav-ticket').addEventListener('click', () => { showView('ticket'); resetTicketForm(); });
  document.getElementById('nav-reviews').addEventListener('click', () => { showView('reviews'); loadRatings(); });

  // CTA button
  document.getElementById('cta-btn').addEventListener('click', () => { showView('ticket'); resetTicketForm(); });
  document.getElementById('reviews-btn').addEventListener('click', () => { showView('reviews'); loadRatings(); });

  // Platform buttons
  document.getElementById('btn-java').addEventListener('click', () => selectPlatform('java'));
  document.getElementById('btn-bedrock').addEventListener('click', () => selectPlatform('bedrock'));

  // Area cards
  AREA_OPTIONS.forEach(a => {
    const el = document.getElementById('area-' + a.id);
    if (el) el.addEventListener('click', () => selectArea(a.id));
  });

  // Submit
  document.getElementById('submit-btn').addEventListener('click', submitTicket);

  // Back from success
  document.getElementById('back-home-btn').addEventListener('click', () => { showView('home'); resetTicketForm(); });
  document.getElementById('new-ticket-btn').addEventListener('click', () => resetTicketForm());

  // Star rating
  document.querySelectorAll('.star-btn').forEach((s, i) => {
    s.addEventListener('click', () => setRatingStar(i + 1));
    s.addEventListener('mouseenter', () => {
      document.querySelectorAll('.star-btn').forEach((ss, ii) => ss.classList.toggle('hover', ii <= i));
    });
  });
  document.querySelector('.stars-row')?.addEventListener('mouseleave', () => {
    document.querySelectorAll('.star-btn').forEach(s => s.classList.remove('hover'));
  });

  document.getElementById('rating-submit-btn').addEventListener('click', submitRating);

  // Ticket history
  renderTicketHistory();

  // Mobile nav toggle
  document.getElementById('menu-toggle').addEventListener('click', () => {
    document.getElementById('nav-links').classList.toggle('open');
  });

  // Initial step states
  document.getElementById('step-area').style.opacity = '0.4';
  document.getElementById('step-area').style.pointerEvents = 'none';
  document.getElementById('step-username').style.opacity = '0.4';
  document.getElementById('step-username').style.pointerEvents = 'none';
});
