const API_URL = 'http://localhost:3000/api';

// ==================== TOGGLE LOGIN/REGISTO ====================
const container = document.getElementById('container');
const registerBtn = document.querySelector('.register-btn');
const loginBtn = document.querySelector('.login-btn');

if (registerBtn && loginBtn && container) {
    registerBtn.addEventListener('click', () => container.classList.add('active'));
    loginBtn.addEventListener('click', () => container.classList.remove('active'));
}

// ==================== SISTEMA DE TOAST ====================
function mostrarToast(mensagem, tipo = 'info', duracao = 3000) {
    const containerToast = document.getElementById('toastContainer');
    if (!containerToast) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo === 'sucesso' ? 'sucesso' : (tipo === 'erro' ? 'erro' : 'info')}`;
    let icone = tipo === 'sucesso' ? '<img src="../../imagens/icon/check-circle-fill.svg">' : (tipo === 'erro' ? '<img src="../../imagens/icon/x-circle-fill.svg">' : '<img src="../../imagens/icon/info-circle-fill.svg">');
    toast.innerHTML = `
        <div class="toast-icon">${icone}</div>
        <div class="toast-mensagem">${mensagem}</div>
        <button class="toast-fechar" onclick="this.parentElement.remove()">✕</button>
    `;
    containerToast.appendChild(toast);
    setTimeout(() => {
        if (toast && toast.parentElement) {
            toast.style.animation = 'fadeOutRight 0.2s forwards';
            setTimeout(() => toast.remove(), 200);
        }
    }, duracao);
}

// ==================== VALIDAÇÕES ====================
function validarEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ==================== LOGIN COM LOADING ====================
const loginForm = document.querySelector('.form-box.login form');
const loginButton = loginForm?.querySelector('.btn');

if (loginForm && loginButton) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('loginUsername')?.value.trim();
        const password = document.getElementById('loginPassword')?.value;

        if (!username || !password) {
            mostrarToast('Preencha todos os campos', 'erro');
            return;
        }

        // Estado de loading
        const textoOriginal = loginButton.textContent;
        loginButton.textContent = 'A entrar...';
        loginButton.disabled = true;
        loginButton.classList.add('loading');

        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.erro || 'Credenciais inválidas');
            }

            localStorage.setItem('token', data.token);
            localStorage.setItem('utilizador', JSON.stringify(data.utilizador));
            const carrinhoLocal = localStorage.getItem('carrinho_local');
            if (carrinhoLocal) localStorage.setItem('carrinho_para_sincronizar', carrinhoLocal);

            mostrarToast(`Login bem-sucedido! Bem-vindo, ${data.utilizador.username}`, 'sucesso');

            setTimeout(() => {
                const destino = data.utilizador.role === 'admin'
                    ? '../TelaRegistro/registroAdm.html'
                    : '../TelaPrincipal/index.html';
                window.location.href = destino;
            }, 800);
        } catch (err) {
            let msg = err.message;
            if (msg.includes('Failed to fetch') || msg.includes('fetch')) {
                msg = 'Não foi possível contactar o servidor. Verifique se o backend está em execução.';
            }
            mostrarToast(msg, 'erro');
        } finally {
            loginButton.textContent = textoOriginal;
            loginButton.disabled = false;
            loginButton.classList.remove('loading');
        }
    });
}

// ==================== REGISTO COM LOADING ====================
const registerForm = document.querySelector('.form-box.register form');
const registerButton = registerForm?.querySelector('.btn');

if (registerForm && registerButton) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('registerUsername')?.value.trim();
        const email = document.getElementById('registerEmail')?.value.trim();
        const password = document.getElementById('registerPassword')?.value;

        if (!username || !email || !password) {
            mostrarToast('Preencha todos os campos', 'erro');
            return;
        }
        if (username.length < 3) {
            mostrarToast('Username deve ter pelo menos 3 caracteres', 'erro');
            return;
        }
        if (!validarEmail(email)) {
            mostrarToast('Email inválido', 'erro');
            return;
        }
        if (password.length < 6) {
            mostrarToast('Password deve ter no mínimo 6 caracteres', 'erro');
            return;
        }

        const textoOriginal = registerButton.textContent;
        registerButton.textContent = 'A registar...';
        registerButton.disabled = true;
        registerButton.classList.add('loading');

        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.erro || 'Erro no registo');

            mostrarToast('Conta criada com sucesso! Faça login.', 'sucesso');
            registerForm.reset();
            setTimeout(() => container.classList.remove('active'), 1200);
        } catch (err) {
            let msg = err.message;
            if (msg.includes('Failed to fetch')) {
                msg = 'Erro de conexão. Verifique o servidor.';
            }
            mostrarToast(msg, 'erro');
        } finally {
            registerButton.textContent = textoOriginal;
            registerButton.disabled = false;
            registerButton.classList.remove('loading');
        }
    });
}

// ==================== REDEFINIR SENHA ====================
const btnRedefinir = document.getElementById('btnRedefinir');
if (btnRedefinir) {
    btnRedefinir.addEventListener('click', async () => {
        const novaSenha = document.getElementById('novaSenha')?.value;
        const confirmarSenha = document.getElementById('confirmarSenha')?.value;
        const token = new URLSearchParams(window.location.search).get('token') || localStorage.getItem('resetToken');

        if (!token) {
            mostrarToast('Token inválido. Solicite nova redefinição.', 'erro');
            return;
        }
        if (!novaSenha || !confirmarSenha) {
            mostrarToast('Preencha todos os campos', 'erro');
            return;
        }
        if (novaSenha !== confirmarSenha) {
            mostrarToast('As senhas não coincidem', 'erro');
            return;
        }
        if (novaSenha.length < 6) {
            mostrarToast('A senha deve ter no mínimo 6 caracteres', 'erro');
            return;
        }

        const textoOriginal = btnRedefinir.textContent;
        btnRedefinir.textContent = 'A processar...';
        btnRedefinir.disabled = true;
        btnRedefinir.classList.add('loading');

        try {
            const res = await fetch(`${API_URL}/auth/redefinir-senha`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, nova_senha: novaSenha })
            });
            const data = await res.json();
            if (res.ok) {
                mostrarToast('Senha redefinida! Redirecionando...', 'sucesso');
                localStorage.removeItem('resetToken');
                setTimeout(() => window.location.href = 'tela_login.html', 2000);
            } else {
                mostrarToast(data.erro || 'Erro ao redefinir senha', 'erro');
            }
        } catch (err) {
            mostrarToast('Erro de conexão com o servidor', 'erro');
        } finally {
            btnRedefinir.textContent = textoOriginal;
            btnRedefinir.disabled = false;
            btnRedefinir.classList.remove('loading');
        }
    });
}