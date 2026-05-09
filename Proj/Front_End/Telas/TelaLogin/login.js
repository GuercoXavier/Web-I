const API_URL = 'http://localhost:3000/api';

const container = document.getElementById('container');
const registerBtn = document.querySelector('.register-btn');
const loginBtn = document.querySelector('.login-btn');

// Toggle entre login e registro
if (registerBtn && loginBtn && container) {
    registerBtn.addEventListener('click', () => {
        container.classList.add('active');
    });

    loginBtn.addEventListener('click', () => {
        container.classList.remove('active');
    });
}

// ==================== LOGIN ====================
const loginForm = document.querySelector('.form-box.login form');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const inputs = loginForm.querySelectorAll('input');
        const username = inputs[0].value.trim();
        const password = inputs[1].value;

        if (!username || !password) {
            alert('Preencha todos os campos');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.erro || 'Erro no login');
                return;
            }

            localStorage.setItem('token', data.token);
            localStorage.setItem('utilizador', JSON.stringify(data.utilizador));

            alert('Login bem-sucedido!');

            if (data.utilizador.role === 'admin') {
                window.location.href = '../TelaRegistro/registroAdm.html';
            } else {
                window.location.href = '../TelaPrincipal/index.html';
            }

        } catch (err) {
            console.error(err);
            alert('Erro ao ligar ao servidor');
        }
    });
}

// ==================== REGISTRO ====================
const registerForm = document.querySelector('.form-box.register form');

if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const inputs = registerForm.querySelectorAll('input');
        const username = inputs[0].value.trim();
        const email = inputs[1].value.trim();
        const password = inputs[2].value;

        if (!username || !email || !password) {
            alert('Preencha todos os campos');
            return;
        }

        if (password.length < 6) {
            alert('Password deve ter no mínimo 6 caracteres');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.erro || 'Erro no registo');
                return;
            }

            alert('Conta criada com sucesso! Faça login.');

            // Limpar formulário e voltar para login
            registerForm.reset();
            container.classList.remove('active');

        } catch (err) {
            console.error(err);
            alert('Erro ao ligar ao servidor');
        }
    });
}