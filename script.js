// Mobile nav toggle
const nav = document.getElementById('nav');
const navToggle = document.getElementById('navToggle');
if (nav && navToggle) {
	navToggle.addEventListener('click', () => {
		const isOpen = nav.getAttribute('data-open') === 'true';
		nav.setAttribute('data-open', String(!isOpen));
		navToggle.setAttribute('aria-expanded', String(!isOpen));
	});

	// Close menu when clicking a link (mobile)
	nav.querySelectorAll('a').forEach((link) => {
		link.addEventListener('click', () => {
			nav.removeAttribute('data-open');
			navToggle.setAttribute('aria-expanded', 'false');
		});
	});
}

// Smooth scroll (native behavior is fine; ensure focus for accessibility)
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
	anchor.addEventListener('click', (e) => {
		const targetId = anchor.getAttribute('href');
		if (!targetId || targetId === '#' || targetId.length < 2) return;
		const target = document.querySelector(targetId);
		if (!target) return;
		e.preventDefault();
		target.scrollIntoView({ behavior: 'smooth', block: 'start' });
		if (target.tabIndex === -1) {
			target.setAttribute('tabindex', '-1');
		}
		target.focus({ preventScroll: true });
	});
});

// Contact form validation
const form = document.getElementById('contactForm');
const statusEl = document.getElementById('formStatus');
if (form && statusEl) {
	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		statusEl.textContent = '';

		const name = /** @type {HTMLInputElement} */(document.getElementById('name'));
		const email = /** @type {HTMLInputElement} */(document.getElementById('email'));
		const message = /** @type {HTMLTextAreaElement} */(document.getElementById('message'));

		clearErrors('name', 'email', 'message');

		let valid = true;
		if (!name.value.trim()) { setError('name', 'Nama wajib diisi'); valid = false; }
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) { setError('email', 'Email tidak valid'); valid = false; }
		if (message.value.trim().length < 10) { setError('message', 'Minimal 10 karakter'); valid = false; }

		if (!valid) return;

		statusEl.textContent = 'Mengirim...';
		await new Promise((r) => setTimeout(r, 700));
		statusEl.textContent = 'Terkirim! Kami akan segera menghubungi Anda.';
		form.reset();
	});
}

function setError(fieldId, msg) {
	const err = document.querySelector(`.error[data-for="${fieldId}"]`);
	if (err) err.textContent = msg;
}
function clearErrors(...fieldIds) {
	for (const id of fieldIds) {
		const err = document.querySelector(`.error[data-for="${id}"]`);
		if (err) err.textContent = '';
	}
}

// Dynamic year
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

// Reviews logic (localStorage)
const reviewsKey = 'oss_profile_reviews_v1';
const reviewsRemoteUrl = 'assets/reviews.json';
const reviewForm = document.getElementById('reviewForm');
const starInput = document.getElementById('starInput');
const ratingHidden = document.getElementById('rating');
const reviewsList = document.getElementById('reviewsList');
const reviewStatus = document.getElementById('reviewStatus');
const avgRatingEl = document.getElementById('avgRating');
const avgStarsEl = document.getElementById('avgStars');
const reviewsCountEl = document.getElementById('reviewsCount');

function loadReviews() {
	try {
		const raw = localStorage.getItem(reviewsKey);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}
function saveReviews(items) {
	localStorage.setItem(reviewsKey, JSON.stringify(items));
}
function renderReviews() {
	if (!reviewsList || !avgRatingEl || !avgStarsEl || !reviewsCountEl) return;
	const items = loadReviews();
	reviewsList.innerHTML = '';
	for (const it of items) {
		const li = document.createElement('li');
		const stars = '★★★★★'.slice(0, it.rating).padEnd(5, '☆');
		li.innerHTML = `
			<div class="meta">
				<span class="name">${escapeHtml(it.name || 'Anon')}</span>
				<span class="stars" aria-label="${it.rating} dari 5">${stars}</span>
			</div>
			<p>${escapeHtml(it.comment)}</p>
		`;
		reviewsList.appendChild(li);
	}
	const avg = items.length ? (items.reduce((s, x) => s + x.rating, 0) / items.length) : 0;
	avgRatingEl.textContent = avg.toFixed(1);
	avgStarsEl.textContent = starBar(avg);
	reviewsCountEl.textContent = `(${items.length} ulasan)`;
}
function starBar(avg) {
	const full = Math.floor(avg);
	const half = avg - full >= 0.5 ? 1 : 0;
	let s = ''.padStart(full, '★');
	s += half ? '☆' : '';
	return s.padEnd(5, '☆');
}
function escapeHtml(t) {
	return t.replace(/[&<>"]+/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

if (starInput && ratingHidden) {
	starInput.querySelectorAll('button').forEach((btn) => {
		btn.addEventListener('click', () => {
			const val = Number(btn.getAttribute('data-value')) || 0;
			ratingHidden.value = String(val);
			starInput.querySelectorAll('button').forEach((b) => b.classList.toggle('active', Number(b.getAttribute('data-value')) <= val));
		});
	});
}

if (reviewForm && ratingHidden && reviewStatus) {
	reviewForm.addEventListener('submit', (e) => {
		e.preventDefault();
		reviewStatus.textContent = '';
		clearErrors('rating', 'comment');
		const rating = Number(ratingHidden.value || '0');
		const name = /** @type {HTMLInputElement} */(document.getElementById('reviewer')).value.trim();
		const comment = /** @type {HTMLTextAreaElement} */(document.getElementById('comment')).value.trim();

		let ok = true;
		if (!(rating >= 1 && rating <= 5)) { setError('rating', 'Pilih rating 1–5'); ok = false; }
		if (comment.length < 5) { setError('comment', 'Minimal 5 karakter'); ok = false; }
		if (!ok) return;

		const items = loadReviews();
		items.unshift({ rating, name, comment, ts: Date.now() });
		saveReviews(items);
		reviewStatus.textContent = 'Terima kasih atas reviewnya!';
		reviewForm.reset();
		ratingHidden.value = '0';
		starInput?.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
		renderReviews();
	});
}

// Initial render
renderReviews();

// Remote reviews fallback (for devices where localStorage cleared or first-time)
async function hydrateFromRemote() {
	try {
		const res = await fetch(reviewsRemoteUrl, { cache: 'no-cache' });
		if (!res.ok) return;
		const remote = await res.json();
		if (Array.isArray(remote) && remote.length) {
			const local = loadReviews();
			// merge without duplicates (by ts+comment hash)
			const key = (r) => `${r.ts || 0}-${(r.comment || '').slice(0,32)}`;
			const map = new Map(local.map((r) => [key(r), r]));
			for (const r of remote) {
				if (!map.has(key(r))) map.set(key(r), r);
			}
			const merged = Array.from(map.values()).sort((a,b) => (b.ts||0)-(a.ts||0));
			localStorage.setItem(reviewsKey, JSON.stringify(merged));
			renderReviews();
		}
	} catch {}
}

hydrateFromRemote();

// Reveal on scroll (IntersectionObserver)
const revealEls = document.querySelectorAll('.reveal, .card');
if ('IntersectionObserver' in window) {
	const io = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			if (entry.isIntersecting) {
				entry.target.classList.add('is-visible');
				io.unobserve(entry.target);
			}
		}
	}, { threshold: 0.12 });
	revealEls.forEach((el) => io.observe(el));
} else {
	revealEls.forEach((el) => el.classList.add('is-visible'));
}

// Parallax effect on hero image (reduced motion respected)
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const parallaxImg = document.querySelector('.parallax');
if (parallaxImg && !prefersReduced) {
	window.addEventListener('scroll', () => {
		const y = window.scrollY || window.pageYOffset;
		const offset = Math.min(12, y * 0.05);
		parallaxImg.style.transform = `translateY(${offset}px)`;
	}, { passive: true });
}

// Theme switcher (auto-random on each refresh)
const themes = [
    { name: 'cyan-blue', primary: '#0ea5e9', primary600: '#0284c7', gradA: '#0ea5e9', gradB: '#60a5fa', bg: '#0b1220', bgSoft: '#0f172a' },
    { name: 'teal-lime', primary: '#14b8a6', primary600: '#0d9488', gradA: '#14b8a6', gradB: '#a3e635', bg: '#071219', bgSoft: '#0b1b22' },
    { name: 'violet-pink', primary: '#8b5cf6', primary600: '#7c3aed', gradA: '#8b5cf6', gradB: '#f472b6', bg: '#0b0a16', bgSoft: '#141327' },
    { name: 'amber-orange', primary: '#f59e0b', primary600: '#d97706', gradA: '#f59e0b', gradB: '#fb923c', bg: '#130d06', bgSoft: '#1a1309' }
];

function applyTheme(t) {
    const root = document.documentElement;
    root.style.setProperty('--primary', t.primary);
    root.style.setProperty('--primary-600', t.primary600);
    root.style.setProperty('--grad-a', t.gradA);
    root.style.setProperty('--grad-b', t.gradB);
    root.style.setProperty('--bg', t.bg);
    root.style.setProperty('--bg-soft', t.bgSoft);
}

function initTheme() {
    const pick = themes[Math.floor(Math.random() * themes.length)];
    applyTheme(pick);
}

initTheme();

