// ==================== CONFIGURAÇÃO ====================
const API_URL = `${window.location.protocol}//${window.location.hostname}:3000/api`;

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
    toast.className = `toast toast-${tipo}`;
    
    let iconeHtml = '';
    switch(tipo) {
        case 'sucesso':
            iconeHtml = '<i class="bx bx-check-circle" style="font-size: 20px; color: #22c55e;"></i>';
            break;
        case 'erro':
            iconeHtml = '<i class="bx bx-x-circle" style="font-size: 20px; color: #ef4444;"></i>';
            break;
        default:
            iconeHtml = '<i class="bx bx-info-circle" style="font-size: 20px; color: #3b82f6;"></i>';
    }
    
    toast.innerHTML = `
        <div class="toast-icon">${iconeHtml}</div>
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

function validarUsername(username) {
    return /^[a-zA-Z0-9_]{3,30}$/.test(username);
}

function validarSenha(senha) {
    return {
        length: senha.length >= 6,
        number: /[0-9]/.test(senha),
        upper: /[A-Z]/.test(senha)
    };
}

// ==================== MOSTRAR ERRO NO FORMULÁRIO ====================
function mostrarErroCampo(inputId, mensagem) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    const erroAnterior = input.parentElement?.querySelector('.erro-texto');
    if (erroAnterior) erroAnterior.remove();
    
    input.style.borderColor = '#ef4444';
    
    const erroDiv = document.createElement('small');
    erroDiv.className = 'erro-texto';
    erroDiv.style.color = '#ef4444';
    erroDiv.style.fontSize = '11px';
    erroDiv.style.marginTop = '5px';
    erroDiv.style.display = 'block';
    erroDiv.textContent = mensagem;
    
    input.parentElement?.appendChild(erroDiv);
    
    setTimeout(() => {
        input.style.borderColor = '';
        if (erroDiv.parentElement) erroDiv.remove();
    }, 3000);
}

function limparErroCampo(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.style.borderColor = '';
    const erro = input.parentElement?.querySelector('.erro-texto');
    if (erro) erro.remove();
}

// ==================== MOSTRAR/OCULTAR SENHA ====================
function toggleSenha(inputId, icon) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('bx-show');
        icon.classList.add('bx-hide');
    } else {
        input.type = 'password';
        icon.classList.remove('bx-hide');
        icon.classList.add('bx-show');
    }
}

// ==================== LOGIN ====================
const loginForm = document.querySelector('.form-box.login form');
const loginButton = loginForm?.querySelector('.btn');

if (loginForm && loginButton) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('loginUsername')?.value.trim();
        const password = document.getElementById('loginPassword')?.value;

        let temErro = false;
        if (!username) {
            mostrarErroCampo('loginUsername', 'Username é obrigatório');
            temErro = true;
        }
        if (!password) {
            mostrarErroCampo('loginPassword', 'Password é obrigatória');
            temErro = true;
        }
        if (temErro) return;

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
            if (carrinhoLocal) {
                localStorage.setItem('carrinho_para_sincronizar', carrinhoLocal);
            }

            mostrarToast(`✅ Login bem-sucedido! Bem-vindo, ${data.utilizador.username}`, 'sucesso');

            setTimeout(() => {
                const destino = data.utilizador.role === 'admin'
                    ? '/Telas/TelaRegistro/RegistroAdm.html'
                    : '/Telas/TelaPrincipal/index.html';
                window.location.href = destino;
            }, 800);
            
        } catch (err) {
            let msg = err.message;
            if (msg.includes('Failed to fetch') || msg.includes('fetch')) {
                msg = '❌ Não foi possível contactar o servidor. Verifique se o backend está em execução.';
            }
            mostrarToast(msg, 'erro');
        } finally {
            loginButton.textContent = textoOriginal;
            loginButton.disabled = false;
            loginButton.classList.remove('loading');
        }
    });
}

// ==================== REGISTO ====================
const registerForm = document.querySelector('.form-box.register form');
const registerButton = registerForm?.querySelector('.btn');

if (registerForm && registerButton) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('registerUsername')?.value.trim();
        const email = document.getElementById('registerEmail')?.value.trim();
        const password = document.getElementById('registerPassword')?.value;

        let temErro = false;
        
        if (!username) {
            mostrarErroCampo('registerUsername', 'Username é obrigatório');
            temErro = true;
        } else if (username.length < 3) {
            mostrarErroCampo('registerUsername', 'Username deve ter pelo menos 3 caracteres');
            temErro = true;
        } else if (!validarUsername(username)) {
            mostrarErroCampo('registerUsername', 'Username só pode conter letras, números e underscore');
            temErro = true;
        }
        
        if (!email) {
            mostrarErroCampo('registerEmail', 'Email é obrigatório');
            temErro = true;
        } else if (!validarEmail(email)) {
            mostrarErroCampo('registerEmail', 'Email inválido');
            temErro = true;
        }
        
        if (!password) {
            mostrarErroCampo('registerPassword', 'Password é obrigatória');
            temErro = true;
        } else if (password.length < 6) {
            mostrarErroCampo('registerPassword', 'Password deve ter no mínimo 6 caracteres');
            temErro = true;
        }
        
        if (temErro) return;

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
            
            if (!res.ok) {
                throw new Error(data.erro || 'Erro no registo');
            }

            mostrarToast('✅ Conta criada com sucesso! Faça login.', 'sucesso');
            registerForm.reset();
            
            setTimeout(() => {
                if (container) container.classList.remove('active');
            }, 1200);
            
        } catch (err) {
            let msg = err.message;
            if (msg.includes('Failed to fetch')) {
                msg = '❌ Erro de conexão. Verifique o servidor.';
            }
            mostrarToast(msg, 'erro');
        } finally {
            registerButton.textContent = textoOriginal;
            registerButton.disabled = false;
            registerButton.classList.remove('loading');
        }
    });
}

// ==================== RECUPERAR SENHA ====================
async function recuperarSenha(email) {
    mostrarToast('📧 Enviando link de recuperação...', 'info');
    
    try {
        const res = await fetch(`${API_URL}/auth/recuperar-senha`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            mostrarToast('✅ Link de recuperação enviado! Verifique seu email.', 'sucesso');
            if (data.reset_token) {
                console.log('🔑 Token de recuperação (apenas desenvolvimento):', data.reset_token);
            }
        } else {
            mostrarToast(data.erro || '❌ Erro ao enviar recuperação', 'erro');
        }
    } catch (err) {
        mostrarToast('❌ Erro de conexão com o servidor', 'erro');
    }
}

// Adicionar evento ao link "Esqueceu a senha?"
const forgotLink = document.querySelector('.forget-link a');
if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = '/Telas/TelaLogin/redefinir_senha.html';
    });
}

// ==================== REDEFINIR SENHA (página de redefinição) ====================
if (window.location.pathname.includes('redefinir_senha')) {
    const btnRedefinir = document.getElementById('btnRedefinir');
    const emailInput = document.getElementById('email');
    const novaSenha = document.getElementById('novaSenha');
    const confirmarSenha = document.getElementById('confirmarSenha');
    const senhaInfo = document.getElementById('senhaInfo');
    const lengthReq = document.getElementById('lengthReq');
    const numberReq = document.getElementById('numberReq');
    const upperReq = document.getElementById('upperReq');

    // Validação da senha em tempo real (opcional)
    if (novaSenha) {
        novaSenha.addEventListener('input', () => {
            const senha = novaSenha.value;
            const valid = validarSenha(senha);
            lengthReq.innerHTML = valid.length ? '<i class="bx bx-check"></i> 6+ caracteres' : '<i class="bx bx-x"></i> 6+ caracteres';
            numberReq.innerHTML = valid.number ? '<i class="bx bx-check"></i> Número' : '<i class="bx bx-x"></i> Número';
            upperReq.innerHTML = valid.upper ? '<i class="bx bx-check"></i> Maiúscula' : '<i class="bx bx-x"></i> Maiúscula';
            lengthReq.style.color = valid.length ? '#22c55e' : '#6b7280';
            numberReq.style.color = valid.number ? '#22c55e' : '#6b7280';
            upperReq.style.color = valid.upper ? '#22c55e' : '#6b7280';
        });
    }

    if (btnRedefinir) {
        btnRedefinir.addEventListener('click', async () => {
            const email = emailInput?.value.trim();
            const senha = novaSenha?.value;
            const confirmar = confirmarSenha?.value;

            if (!email || !senha || !confirmar) {
                mostrarToast('Preencha todos os campos', 'erro');
                return;
            }

            if (senha !== confirmar) {
                mostrarToast('As senhas não coincidem', 'erro');
                return;
            }

            const validacao = validarSenha(senha);
            if (!validacao.length || !validacao.number || !validacao.upper) {
                mostrarToast('Senha fraca. Deve ter pelo menos 6 caracteres, um número e uma letra maiúscula.', 'erro');
                return;
            }

            try {
                const res = await fetch(`${API_URL}/auth/redefinir-senha`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, nova_senha: senha })
                });

                const data = await res.json();

                if (res.ok) {
                    mostrarToast('Senha redefinida com sucesso!', 'sucesso');
                    setTimeout(() => {
                        window.location.href = '/Telas/TelaLogin/tela_login.html';
                    }, 1500);
                } else {
                    mostrarToast(data.erro || 'Erro ao redefinir senha', 'erro');
                }
            } catch (err) {
                mostrarToast('Erro de conexão com o servidor', 'erro');
            }
        });
    }
}

// ==================== VERIFICAR SE JÁ ESTÁ LOGADO ====================
function verificarSessao() {
    const token = localStorage.getItem('token');
    if (token && window.location.pathname.includes('tela_login')) {
        const user = JSON.parse(localStorage.getItem('utilizador') || '{}');
        if (user.id) {
            const destino = user.role === 'admin' 
                ? '/Telas/TelaRegistro/RegistroAdm.html' 
                : '/Telas/TelaPrincipal/index.html';
            window.location.href = destino;
        }
    }
}

verificarSessao();