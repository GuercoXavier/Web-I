const API_URL = 'http://localhost:3000/api';

// ==================== TOGGLE LOGIN/REGISTRO ====================
const container = document.getElementById('container');
const registerBtn = document.querySelector('.register-btn');
const loginBtn = document.querySelector('.login-btn');

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

            const carrinhoLocal = localStorage.getItem('carrinho_local');
            if (carrinhoLocal) {
                localStorage.setItem('carrinho_para_sincronizar', carrinhoLocal);
            }

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
            registerForm.reset();
            container.classList.remove('active');

        } catch (err) {
            console.error(err);
            alert('Erro ao ligar ao servidor');
        }
    });
}

// ==================== REDEFINIR SENHA (para página redefinir_senha.html) ====================
const btnRedefinir = document.getElementById('btnRedefinir');

if (btnRedefinir) {
    btnRedefinir.addEventListener('click', async () => {
        const novaSenha = document.getElementById('novaSenha')?.value;
        const confirmarSenha = document.getElementById('confirmarSenha')?.value;
        const mensagemDiv = document.getElementById('mensagem');

        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token') || localStorage.getItem('resetToken');

        if (!token) {
            mostrarMensagem('Token inválido. Faça a solicitação novamente.', 'erro', mensagemDiv);
            return;
        }

        if (!novaSenha || !confirmarSenha) {
            mostrarMensagem('Preencha todos os campos', 'erro', mensagemDiv);
            return;
        }

        if (novaSenha !== confirmarSenha) {
            mostrarMensagem('As senhas não coincidem', 'erro', mensagemDiv);
            return;
        }

        if (novaSenha.length < 6) {
            mostrarMensagem('A senha deve ter no mínimo 6 caracteres', 'erro', mensagemDiv);
            return;
        }

        try {
            const res = await fetch(`${API_URL}/auth/redefinir-senha`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, nova_senha: novaSenha })
            });

            const data = await res.json();

            if (res.ok) {
                mostrarMensagem('Senha redefinida com sucesso! Redirecionando...', 'sucesso', mensagemDiv);
                localStorage.removeItem('resetToken');
                setTimeout(() => {
                    window.location.href = 'tela_login.html';
                }, 2000);
            } else {
                mostrarMensagem(data.erro || 'Erro ao redefinir senha', 'erro', mensagemDiv);
            }
        } catch (err) {
            mostrarMensagem('Erro ao conectar ao servidor', 'erro', mensagemDiv);
        }
    });
}

// Função auxiliar para mostrar mensagem
function mostrarMensagem(msg, tipo, elemento) {
    if (elemento) {
        elemento.textContent = msg;
        elemento.className = `mensagem ${tipo}`;
        setTimeout(() => {
            elemento.className = 'mensagem';
        }, 5000);
    }
}