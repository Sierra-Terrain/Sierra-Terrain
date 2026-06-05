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

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const status = form.querySelector(".form-status");
  const submitButton = form.querySelector('button[type="submit"]');
  const defaultButtonText = submitButton.textContent;
  const formData = new FormData(form);

  status.classList.remove("is-error", "is-success");
  status.textContent = "Sending your request...";
  submitButton.disabled = true;
  submitButton.textContent = "Sending...";

  try {
    const response = await fetch(form.action, {
      method: form.method,
      body: formData,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Formspree rejected the request.");
    }

    status.classList.add("is-success");
    status.textContent = "Thanks. Your request was sent to the Sierra Terrain team.";
    form.reset();
  } catch (error) {
    status.classList.add("is-error");
    status.textContent =
      "Sorry, we could not send your request. Please try again or contact us directly.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = defaultButtonText;
  }
});
