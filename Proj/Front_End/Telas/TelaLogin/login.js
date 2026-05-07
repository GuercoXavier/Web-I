const container = document.querySelector('.container');

const registerBtn = document.querySelector('.register-btn');
const loginBtn = document.querySelector('.login-btn');

registerBtn.addEventListener('click', () => {
  container.classList.add('active');
});

loginBtn.addEventListener('click', () => {
  container.classList.remove('active');
});

// ======================
// LOGIN
// ======================

const loginForm = document.querySelector('.form-box.login form');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = loginForm.querySelector('input[type="text"]').value.trim();
  const password = loginForm.querySelector('input[type="password"]').value;

  try {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username,
        password
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.erro || 'Erro no login');
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('utilizador', JSON.stringify(data.utilizador));

    alert('Login bem-sucedido!');

    window.location.href = '../dashboard.html';

  } catch (err) {
    console.error(err);
    alert('Erro ao ligar ao servidor');
  }
});

// ======================
// REGISTER
// ======================

const registerForm = document.querySelector('.form-box.register form');

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = registerForm.querySelector('input[type="text"]').value.trim();
  const email = registerForm.querySelector('input[type="email"]').value.trim();
  const password = registerForm.querySelector('input[type="password"]').value;

  if (!username || !email || !password) {
    alert('Preencha todos os campos');
    return;
  }

  if (password.length < 6) {
    alert('Password deve ter no mínimo 6 caracteres');
    return;
  }

  try {
    const res = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username,
        email,
        password
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.erro || 'Erro no registo');
      return;
    }

    alert('Conta criada com sucesso!');

    registerForm.reset();

    container.classList.remove('active');

  } catch (err) {
    console.error(err);
    alert('Erro ao ligar ao servidor');
  }
});