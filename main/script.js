document.addEventListener('click', function(e) {
  var btn = e.target.closest('.theme-toggle');
  if (!btn) return;
  var el = document.documentElement;
  el.classList.add('theme-transition');
  void el.offsetHeight;
  var next = el.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  el.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  setTimeout(function() {
    el.classList.remove('theme-transition');
  }, 350);
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
  if (!localStorage.getItem('theme')) {
    document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
  }
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
    }
  });
}, { threshold: 0.3 });

document.querySelectorAll('.how__step, .feature-card').forEach(el => observer.observe(el));

async function checkAuth() {
  try {
    const res = await fetch('/api/me');
    const data = await res.json();

    if (!data.loggedIn) return;

    const user = data.user;
    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator || 0) % 5}.png`;

    document.getElementById('nav-user').style.display = 'block';
    document.getElementById('auth-btn-guest').style.display = 'none';

    const authBtn = document.getElementById('auth-btn');
    authBtn.innerHTML = `
      <img src="${avatarUrl}" width="24" height="24" style="border-radius:50%">
      <span>${user.username}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    `;

    const dropdown = document.getElementById('nav-dropdown');
    authBtn.onclick = (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    };
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== authBtn) {
        dropdown.classList.remove('open');
      }
    });

    const roleLabels = { user: 'Пользователь', deputy_leader: 'Заместитель лидера', leader: 'Лидер', developer: 'Developer' };
    document.getElementById('dropdown-role').textContent = roleLabels[user.role] || 'Пользователь';

    if (['leader', 'deputy_leader', 'developer'].includes(user.role)) {
      document.getElementById('btn-department').style.display = 'flex';
    }
    if (user.role === 'developer') {
      document.getElementById('btn-admin').style.display = 'flex';
    }

    const heroBtn = document.getElementById('hero-login-btn');
    if (heroBtn) {
      if (['leader', 'deputy_leader'].includes(user.role)) {
        heroBtn.href = '/department';
        heroBtn.innerHTML = `
          <svg width="20" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 21h18M3 7v14M21 7v14M6 11h.01M6 15h.01M6 19h.01M10 11h.01M10 15h.01M10 19h.01M14 11h.01M14 15h.01M14 19h.01M18 11h.01M18 15h.01M18 19h.01M9 7a3 3 0 116 0v0a3 3 0 01-6 0z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Открыть ведомство
        `;
      } else if (user.role === 'developer') {
        heroBtn.href = '/admin';
        heroBtn.innerHTML = `
          <svg width="20" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Админ панель
        `;
      } else {
        heroBtn.href = '#profile';
        heroBtn.innerHTML = `
          <svg width="20" height="16" viewBox="0 0 24 18" fill="none"><path d="M19.7 1.5A19.8 19.8 0 0014.8 0a.1.1 0 00-.1.04c-.2.4-.4.9-.6 1.2-1.8-.3-3.7-.3-5.5 0-.2-.4-.4-.9-.6-1.2a.1.1 0 00-.1-.04A19.7 19.7 0 001.5 1.5a.1.1 0 000 .03C-.5 6 .0 10.5.4 15a.1.1 0 000 .06c2 1.5 4 2.4 6 3a.1.1 0 00.1-.03c.5-.6.9-1.3 1.2-2a.1.1 0 00-.1-.1c-.7-.2-1.3-.5-1.9-.9a.1.1 0 010-.1c.1-.1.3-.2.4-.3a.1.1 0 01.1 0c3.9 1.8 8.2 1.8 12.1 0a.1.1 0 01.1 0l.4.3a.1.1 0 010 .1c-.6.4-1.2.7-1.9.9a.1.1 0 00-.1.1c.4.7.8 1.3 1.2 2a.1.1 0 00.1.03c2-.6 4-1.5 6-3a.1.1 0 000-.06c.6-5.2-1-9.7-3.8-13.7a.1.1 0 000-.03zM8 12.6c-1.2 0-2.2-1.1-2.2-2.4 0-1.3 1-2.4 2.2-2.4 1.2 0 2.2 1.1 2.2 2.4 0 1.3-1 2.4-2.2 2.4zm8 0c-1.2 0-2.2-1.1-2.2-2.4 0-1.3 1-2.4 2.2-2.4 1.2 0 2.2 1.1 2.2 2.4 0 1.3-.9 2.4-2.2 2.4z" fill="white"/></svg>
          Мой профиль
        `;
      }
    }

    const profileSection = document.getElementById('profile');
    profileSection.style.display = 'block';
    document.getElementById('profile-avatar').src = avatarUrl;
    document.getElementById('profile-username').textContent = user.username;

    const accessBtn = document.getElementById('access-login-btn');
    if (accessBtn) accessBtn.style.display = 'none';

  } catch (err) {
    console.error('Auth check failed:', err);
  }
}

checkAuth();
