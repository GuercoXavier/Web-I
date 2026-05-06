//posters.js
window.addEventListener('hashchange', () => {
    const pagina = location.hash.replace('#', '');
    if (pagina) ir(pagina);
});

  const EXIBIR = 12;   
  const DUR    = 0.9;  
  const PAUSA  = 0.5;  

  function animar() {
    const tras   = document.getElementById('samsung');
    const frente = document.getElementById('sTras');
    const pen    = document.getElementById('pen');

    
    const sair = (el, anim, delay) => {
      const current = getComputedStyle(el).transform;
      el.style.transform = current;
      void el.offsetWidth;
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = `${anim} ${DUR}s ${delay}s cubic-bezier(0.55,0,0.78,0) forwards`;
    };

    sair(tras,   'saidaTras',   0);
    sair(frente, 'saidaFrente', 0.1);
    sair(pen,    'saidaPen',    0.2);

    
    const totalSaida = (DUR + 0.2 + PAUSA) * 1000;

    setTimeout(() => {
      const entrar = (el, anim, delay) => {
        el.style.opacity  = '0';
        el.style.transform = '';
        void el.offsetWidth;
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = `${anim} ${DUR}s ${delay}s cubic-bezier(0.22,1,0.36,1) forwards,
                               float 4.5s ${delay + DUR + 0.1}s ease-in-out infinite`;
      };

      entrar(tras,   'entradaTras',   0);
      entrar(frente, 'entradaFrente', 0.1);
      entrar(pen,    'entradaPen',    0.2);

      
      setTimeout(animar, EXIBIR * 1000);

    }, totalSaida);
  }

  
  setTimeout(animar, EXIBIR * 1000);
