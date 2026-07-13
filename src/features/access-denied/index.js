export async function init(mount) {
  mount.querySelector('.mc-btn')?.addEventListener('click', () => {
    if (window.history.length > 1) history.back();
    else history.replaceState({}, '', '/dashboard');
  });
}
