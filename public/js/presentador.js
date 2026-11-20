(function () {
  const CLAVE_TOKEN = "tpr_token_presentador";
  const LOGO_SRC = "/assets/logo-blanco.png";
  const LOGO_CADA_MS = 15000;        // cada cuánto entra el logo
  const ACTUALIZAR_MS = 20000;       // cada cuánto se buscan fotos nuevas aprobadas
  const ALTURA_CARRIL = 240;         // altura aproximada de cada carril en px
  const VEL_MIN = 30, VEL_MAX = 70;  // velocidad en px por segundo

  const vistaLogin = document.getElementById("vista-login");
  const vistaPanel = document.getElementById("vista-panel");
  const formLogin = document.getElementById("form-login");
  const inputPassword = document.getElementById("password");
  const mensajeLogin = document.getElementById("mensaje-login");
  const contador = document.getElementById("contador");
  const estado = document.getElementById("estado");
  const escenario = document.getElementById("escenario");

  let token = sessionStorage.getItem(CLAVE_TOKEN);
  let aprobadas = [];        // [{id, url}] fotos aprobadas
  let cola = [];             // fotos pendientes de mostrar en esta vuelta
  let carriles = [];
  let W = 0, H = 0, cardH = 0;
  let presentando = false;
  let rafId = 0, ultimoT = 0, ultimoLogo = 0, logoPendiente = false;
  let temporizadores = [];
  let wakeLock = null;

  function avisar(texto, tipo) {
    estado.textContent = texto;
    estado.className = "mensaje " + (tipo || "");
  }

  function mostrarPanel(mostrar) {
    vistaLogin.classList.toggle("oculto", mostrar);
    vistaPanel.classList.toggle("oculto", !mostrar);
  }

  function cerrarSesion(mensaje) {
    detener();
    token = null;
    sessionStorage.removeItem(CLAVE_TOKEN);
    aprobadas = [];
    mostrarPanel(false);
    mensajeLogin.textContent = mensaje || "";
  }

  // ---------- Datos ----------
  async function cargarFotos() {
    if (!token) return;
    try {
      const r = await TPR.api("/api/fotos-aprobadas", { token });
      aprobadas = r.fotos || [];
      cola = []; // así las fotos nuevas entran en la siguiente vuelta
      contador.textContent = aprobadas.length;
      actualizarMensajeVacio();
    } catch (e) {
      if (e.status === 401) return cerrarSesion("Tu sesión venció. Volvé a ingresar.");
      avisar("No pudimos actualizar las fotos. Reintentando…", "error");
    }
  }

  function siguienteFoto() {
    if (!cola.length) cola = TPR.barajar(aprobadas);
    return cola.shift();
  }

  // ---------- Carriles ----------
  function anchoDe(esLogo) {
    return esLogo ? cardH * 2.2 : cardH * 0.8;
  }

  function hayLogoEnPantalla() {
    return carriles.some((l) => l.items.some((i) => i.esLogo));
  }

  function crearItem(lane, x, esLogo) {
    const el = document.createElement("div");
    const w = anchoDe(esLogo);
    if (esLogo) {
      el.className = "item logo";
      el.style.fontSize = cardH * 0.1 + "px";
      el.innerHTML = '<img src="' + LOGO_SRC + '" alt="TPR"><span>Un socio en quien confiar</span>';
    } else {
      el.className = "item";
      const foto = siguienteFoto();
      const img = document.createElement("img");
      img.src = foto.url;
      img.alt = "";
      el.appendChild(img);
    }
    el.style.width = w + "px";
    el.style.height = cardH + "px";
    el.style.transform = "translate3d(" + x + "px," + lane.y + "px,0)";
    escenario.appendChild(el);
    const item = { el, x, w, esLogo };
    lane.items.push(item);
    return item;
  }

  // Agrega elementos por el borde de entrada del carril (derecha o izquierda según la dirección)
  function reponer(lane) {
    for (let k = 0; k < 30; k++) {
      const esLogo = logoPendiente && !hayLogoEnPantalla() && Math.random() < 0.5;
      if (!esLogo && aprobadas.length === 0) break;
      const w = anchoDe(esLogo);
      const gap = 60 + Math.random() * 140;
      let x;
      if (lane.dir < 0) {
        if (lane.items.length) {
          x = Math.max(...lane.items.map((i) => i.x + i.w)) + gap;
          if (x >= W) break;
        } else {
          x = W + gap;
        }
      } else {
        if (lane.items.length) {
          x = Math.min(...lane.items.map((i) => i.x)) - gap - w;
          if (x + w <= 0) break;
        } else {
          x = -w - gap;
        }
      }
      crearItem(lane, x, esLogo);
      if (esLogo) logoPendiente = false;
    }
  }

  function avanzar(dt) {
    for (const lane of carriles) {
      for (const it of lane.items) {
        it.x += lane.dir * lane.v * dt;
        it.el.style.transform = "translate3d(" + it.x.toFixed(1) + "px," + lane.y + "px,0)";
      }
      lane.items = lane.items.filter((it) => {
        const fuera = lane.dir < 0 ? it.x + it.w < -30 : it.x > W + 30;
        if (fuera) it.el.remove();
        return !fuera;
      });
      reponer(lane);
    }
  }

  function montar() {
    W = escenario.clientWidth;
    H = escenario.clientHeight;
    escenario.querySelectorAll(".item").forEach((e) => e.remove());
    const n = Math.max(3, Math.round(H / ALTURA_CARRIL));
    const laneH = H / n;
    cardH = laneH * 0.8;
    carriles = [];
    for (let i = 0; i < n; i++) {
      carriles.push({
        y: i * laneH + (laneH - cardH) / 2,
        dir: i % 2 === 0 ? -1 : 1,
        v: VEL_MIN + Math.random() * (VEL_MAX - VEL_MIN),
        items: [],
      });
    }
    // Precalentado: simula ~40 segundos para que los carriles ya estén llenos al empezar
    for (let s = 0; s < 400; s++) avanzar(0.1);
    actualizarMensajeVacio();
  }

  function actualizarMensajeVacio() {
    let msg = escenario.querySelector(".sin-fotos");
    if (presentando && aprobadas.length === 0) {
      if (!msg) {
        msg = document.createElement("div");
        msg.className = "sin-fotos";
        msg.innerHTML = "Todavía no hay fotos aprobadas.<br>Van a aparecer acá apenas se aprueben.";
        escenario.appendChild(msg);
      }
    } else if (msg) {
      msg.remove();
    }
  }

  function frame(t) {
    const dt = Math.min(0.05, (t - ultimoT) / 1000);
    ultimoT = t;
    avanzar(dt);
    if (t - ultimoLogo >= LOGO_CADA_MS) {
      ultimoLogo = t;
      logoPendiente = true;
    }
    rafId = requestAnimationFrame(frame);
  }

  // ---------- Presentación ----------
  async function iniciar() {
    presentando = true;
    escenario.classList.remove("oculto");
    try {
      if (escenario.requestFullscreen) await escenario.requestFullscreen();
    } catch (e) { /* si no se permite pantalla completa, igual se muestra el escenario */ }

    try {
      if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
    } catch (e) { /* opcional */ }

    await cargarFotos();
    montar();

    ultimoT = performance.now();
    ultimoLogo = ultimoT;
    rafId = requestAnimationFrame(frame);
    temporizadores.push(setInterval(cargarFotos, ACTUALIZAR_MS));
  }

  function detener() {
    presentando = false;
    cancelAnimationFrame(rafId);
    temporizadores.forEach((t) => clearInterval(t));
    temporizadores = [];
    carriles = [];
    escenario.querySelectorAll(".item, .sin-fotos").forEach((e) => e.remove());
    escenario.classList.add("oculto");
    if (wakeLock) { try { wakeLock.release(); } catch (e) {} wakeLock = null; }
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }

  // ---------- Eventos ----------
  formLogin.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    mensajeLogin.textContent = "";
    const boton = document.getElementById("boton-login");
    boton.disabled = true;
    try {
      const r = await TPR.api("/api/login", { metodo: "POST", cuerpo: { rol: "presentador", password: inputPassword.value } });
      token = r.token;
      sessionStorage.setItem(CLAVE_TOKEN, token);
      inputPassword.value = "";
      mostrarPanel(true);
      cargarFotos();
    } catch (e) {
      mensajeLogin.textContent = e.message;
    } finally {
      boton.disabled = false;
    }
  });

  document.getElementById("boton-iniciar").addEventListener("click", iniciar);
  document.getElementById("boton-salir-escenario").addEventListener("click", detener);
  document.getElementById("boton-salir-sesion").addEventListener("click", () => cerrarSesion(""));

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && presentando) detener();
  });

  // Si se sale de pantalla completa con el navegador, se cierra la presentación
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && presentando) detener();
  });

  let redimensionTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(redimensionTimer);
    redimensionTimer = setTimeout(() => {
      if (presentando) montar();
    }, 250);
  });

  // El contador del panel se actualiza solo cuando no se está presentando
  setInterval(() => { if (token && !presentando) cargarFotos(); }, ACTUALIZAR_MS);

  // Arranque
  if (token) {
    mostrarPanel(true);
    cargarFotos();
  } else {
    mostrarPanel(false);
  }
})();
