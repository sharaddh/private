export function flyToCart(sourceEl: HTMLElement) {
  const source = sourceEl.getBoundingClientRect();

  const candidates = document.querySelectorAll("[data-cart-icon]");
  let cartEl: Element | null = null;

  for (const el of candidates) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.right <= window.innerWidth) {
      cartEl = el;
      break;
    }
  }

  if (!cartEl) return;
  const target = cartEl.getBoundingClientRect();

  const ghost = document.createElement("div");
  ghost.style.cssText = `
    position: fixed;
    z-index: 9999;
    pointer-events: none;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--color-primary-500, #f59e0b);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 20px rgba(245, 158, 11, 0.5);
    left: ${source.left + source.width / 2 - 18}px;
    top: ${source.top + source.height / 2 - 18}px;
    transition: all 0.6s cubic-bezier(0.2, 1, 0.3, 1);
    opacity: 1;
    transform: scale(1);
  `;
  ghost.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: #000"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`;

  document.body.appendChild(ghost);

  requestAnimationFrame(() => {
    ghost.style.left = `${target.left + target.width / 2 - 18}px`;
    ghost.style.top = `${target.top + target.height / 2 - 18}px`;
    ghost.style.transform = "scale(0.2)";
    ghost.style.opacity = "0.4";
  });

  setTimeout(() => {
    ghost.remove();
    const cartParent = cartEl!.closest("a") || cartEl!;
    cartParent.classList.add("animate-cart-bump");
    setTimeout(() => cartParent.classList.remove("animate-cart-bump"), 400);
  }, 650);
}
