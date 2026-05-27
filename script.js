const header = document.querySelector("[data-header]");
const menuButton = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");
const form = document.querySelector("[data-estimate-form]");

const setHeaderState = () => {
  header.classList.toggle("is-scrolled", window.scrollY > 10);
};

setHeaderState();
window.addEventListener("scroll", setHeaderState, { passive: true });

menuButton.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!open));
  header.classList.toggle("nav-active", !open);
  document.body.classList.toggle("nav-open", !open);
});

nav.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    menuButton.setAttribute("aria-expanded", "false");
    header.classList.remove("nav-active");
    document.body.classList.remove("nav-open");
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const status = form.querySelector(".form-status");
  status.textContent = "Thanks. Your request is ready for the Sierra Terrain team to review.";
  form.reset();
});
