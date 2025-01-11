const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD;

export function checkAuth() {
  const isAuthenticated = sessionStorage.getItem("isAuthenticated");
  const mainContent = document.querySelector(".container");
  const logoutBtn = document.querySelector(".logout-btn");

  if (!isAuthenticated) {
    showLoginModal();
    if (mainContent) {
      mainContent.style.display = "none";
    }
    if (logoutBtn) {
      logoutBtn.style.display = "none";
    }
    return false;
  }

  if (mainContent) {
    mainContent.style.display = "block";
  }
  if (logoutBtn) {
    logoutBtn.style.display = "block";
  }
  return true;
}

function showLoginModal() {
  const modal = document.createElement("div");
  modal.className = "auth-modal modal";
  modal.innerHTML = `
    <div class="modal-content auth-content">
      <h3>Password Required</h3>
      <input type="password" id="passwordInput" placeholder="Enter password" />
      <div class="modal-buttons">
        <button onclick="window.authenticate()" class="save-btn">Login</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

export function authenticate() {
  const password = document.getElementById("passwordInput").value;
  if (password === APP_PASSWORD) {
    sessionStorage.setItem("isAuthenticated", "true");
    document.querySelector(".auth-modal").remove();
    const mainContent = document.querySelector(".container");
    if (mainContent) {
      mainContent.style.display = "block";
    }
    window.location.reload();
  } else {
    alert("Incorrect password");
  }
}

export function logout() {
  sessionStorage.removeItem("isAuthenticated");
  const mainContent = document.querySelector(".container");
  const logoutBtn = document.querySelector(".logout-btn");
  if (mainContent) {
    mainContent.style.display = "none";
  }
  if (logoutBtn) {
    logoutBtn.style.display = "none";
  }
  window.location.reload();
}
