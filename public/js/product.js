/**
 * product.js — progressive enhancement for the server-rendered product page.
 * The page works fully without JS (thumbnails are just links to the same
 * image); this just avoids a full reload when swapping the main photo.
 */
(function () {
  const mainImg = document.getElementById('galleryMainImg');
  const thumbs = document.getElementById('galleryThumbs');
  if (!mainImg || !thumbs) return;

  thumbs.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-full]');
    if (!btn) return;
    mainImg.src = btn.getAttribute('data-full');
    thumbs.querySelectorAll('button').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
  });
})();
