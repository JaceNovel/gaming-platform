const RAMADAN_END_AT = new Date("2026-03-05T23:59:59").getTime();

const starsContainer = document.getElementById("stars");
const countdownEl = document.getElementById("countdown");
const continueBtn = document.getElementById("continueBtn");
const overlay = document.querySelector(".ramadan-overlay");

const pad = (value) => String(value).padStart(2, "0");

for (let i = 0; i < 140; i += 1) {
  const star = document.createElement("span");
  star.className = "star";
  star.style.left = `${Math.random() * 100}%`;
  star.style.top = `${Math.random() * 100}%`;
  const size = `${Math.random() * 2.3 + 1}px`;
  star.style.width = size;
  star.style.height = size;
  star.style.animationDuration = `${Math.random() * 4 + 2.5}s`;
  star.style.animationDelay = `${Math.random() * 3}s`;
  star.style.opacity = `${Math.random() * 0.7 + 0.2}`;
  starsContainer.appendChild(star);
}

const updateCountdown = () => {
  const remaining = Math.max(0, RAMADAN_END_AT - Date.now());
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  countdownEl.textContent = `Se termine dans ${pad(days)}j ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;

  if (remaining <= 0 && overlay) {
    overlay.style.display = "none";
  }
};

updateCountdown();
const timer = window.setInterval(updateCountdown, 1000);

continueBtn?.addEventListener("click", () => {
  if (overlay) {
    overlay.style.display = "none";
  }
  window.clearInterval(timer);
});
