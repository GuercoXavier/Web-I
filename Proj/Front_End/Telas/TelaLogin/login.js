const container = document.querySelector('.container');
const registerBtn = document.querySelector('.register-btn');
const loginBtn = document.querySelector('.login-btn');

// alternar telas
registerBtn.addEventListener('click', () => {
  container.classList.add('active');
});

loginBtn.addEventListener('click', () => {
  container.classList.remove('active');
});

// ===== LOGIN =====
const loginForm = document.querySelector('.form-box.login form');

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const username = loginForm.querySelector('input[type="text"]').value;
  const password = loginForm.querySelector('input[type="password"]').value;

  if (window._k(username, password)) {
    window.open("../TelaRegistro/RegistroAdm.html", "_blank");
  } else {
    alert("Credenciais invalidas!");
  }
});