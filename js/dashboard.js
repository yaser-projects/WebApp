// ============================
//   METAL BRAIN - DASHBOARD JS
// ============================

// منوی موبایل
const btn = document.getElementById("menuToggle");
const mobileMenu = document.getElementById("mobileMenu");

if (btn) {
  btn.addEventListener("click", () => {
    mobileMenu.style.display =
      mobileMenu.style.display === "flex" ? "none" : "flex";

    btn.classList.toggle("open");
  });
}

// انیمیشن همبرگر
btn?.addEventListener("click", () => {
  btn.classList.toggle("x");

  const spans = btn.querySelectorAll("span");

  if (btn.classList.contains("x")) {
    spans[0].style.transform = "translateY(4px) rotate(45deg)";
    spans[1].style.opacity = "0";
    spans[2].style.transform = "translateY(-4px) rotate(-45deg)";
  } else {
    spans[0].style.transform = "none";
    spans[1].style.opacity = "1";
    spans[2].style.transform = "none";
  }
});
