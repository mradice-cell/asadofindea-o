(function () {
  const CLAVE_TOKEN = "tpr_token_presentador";
  const MAX_TILES = 48;          // fotos visibles a la vez como máximo
  const ROTACION_MS = 3500;      // cada cuánto cambia una foto del muro
  const ACTUALIZAR_MS = 20000;   // cada cuánto se buscan fotos nuevas aprobadas
  const LOGO_CICLO_MS = 24000;   // cada cuánto aparece el logo
  const LOGO_VISIBLE_MS = 7000;  // cuánto tiempo queda visible

  const vistaLogin = document.getElementById("vista-login");
  const vistaPanel = document.getElementById("vista-panel");
  const formLogin = document.getElementById("form-login");
  const inputPassword = document.getElementById("password");
  const mensajeLogin = document.getElementById("mensaje-login");
  const contador = document.getElementById("contador");
  const estado = document.getElementById("estado");
  const escenario = document.getElementById("escenario");
  const muro = document.getElementById("muro");
  const logo = document.getElementById("logo");

  let token = sessionStorage.getItem(CLAVE_TOKEN);
  let aprobadas = [];        // [{id, url}] todas las fotos aprobadas
  let slots = [];            // fotos que están en pantalla, en orden de tile
  let cola = [];             // fotos aprobadas que todavía no están en pantalla
  let tiles = [];            // elementos .tile del DOM
  let claveDisposicion = ""; // cambia si cambian cantidad de tiles o tamaño
  let presentando = false;
  let temporizadores = [];
  let wakeLock = null;

  function avisar(texto, tipo) {
    estado.textContent = texto;
    estado.className = "mensaje " + (tipo || "ok");
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
      contador.textContent = aprobadas.length;
      if (presentando) sincronizar();
    } catch (e) {
      if (e.status === 401) return cerrarSesion("Tu sesión venció. Volvé a ingresar.");
      avisar("No pudimos actualizar las fotos. Reintentando…", "error");
    }
  }

  // ---------- Muro de fotos ----------
  // Pone en pantalla hasta MAX_TILES fotos y deja el resto en cola para ir rotando.
  // Si hay pocas fotos, todas quedan visibles al mismo tiempo y el muro se reordena.
  function sincronizar() {
    const ids = new Set(aprobadas.map((f) => f.id));
    slots = slots.filter((s) => ids.has(s.id));
    const enPantalla = new Set(slots.map((s) => s.id));
    const total = Math.min(aprobadas.length, MAX_TILES);
    cola = TPR.barajar(aprobadas.filter((f) => !enPantalla.has(f.id)));
    while (slots.length < total && cola.length) slots.push(cola.shift());
    montarMuro(false);
    // Si cambió alguna foto sin cambiar la cantidad de celdas, se actualiza solo esa celda
    slots.forEach((_, i) => pintarTile(i));
  }

  function montarMuro(forzar) {
    const w = muro.clientWidth || 1;
    const h = muro.clientHeight || 1;
    const clave = slots.length + "|" + w + "x" + h;
    if (!forzar && clave === claveDisposicion) return;
    claveDisposicion = clave;

    muro.innerHTML = "";
    tiles = [];

    if (slots.length === 0) {
      muro.innerHTML = '<div class="sin-fotos">Todavía no hay fotos aprobadas.<br>Van a aparecer acá apenas se aprueben.</div>';
      return;
    }

    // Distribuye las fotos en filas de forma que llenen toda la pantalla sin huecos
    const total = slots.length;
    const filas = Math.max(1, Math.min(total, Math.round(Math.sqrt(total * h / w))));
    const base = Math.floor(total / filas);
    const extra = total % filas;

    let indice = 0;
    for (let f = 0; f < filas; f++) {
      const fila = document.createElement("div");
      fila.className = "muro-fila";
      const cantidad = base + (f < extra ? 1 : 0);
      for (let c = 0; c < cantidad; c++, indice++) {
        const tile = document.createElement("div");
        tile.className = "tile";
        const img = document.createElement("img");
        img.alt = "";
        img.src = slots[indice].url;
        img.dataset.id = slots[indice].id;
        img.style.animationDelay = (-Math.random() * 16).toFixed(2) + "s";
        tile.appendChild(img);
        fila.appendChild(tile);
        tiles.push(tile);
      }
      muro.appendChild(fila);
    }
  }

  // Cambia la foto de un tile con un desvanecido suave
  function pintarTile(i) {
    const tile = tiles[i];
    if (!tile || !slots[i]) return;
    const img = tile.querySelector("img");
    if (img.dataset.id === slots[i].id) return;
    const destino = slots[i];
    img.dataset.id = destino.id;
    tile.classList.add("salida");
    setTimeout(() => {
      const quitar = () => tile.classList.remove("salida");
      img.onload = quitar;
      img.onerror = quitar;
      img.src = slots[i] ? slots[i].url : destino.url;
    }, 700);
  }

  function rotar() {
    if (!presentando || slots.length === 0) return;

    if (aprobadas.length <= slots.length) {
      // Todas las fotos están en pantalla: se intercambian dos lugares
      if (slots.length < 2) return;
      const i = Math.floor(Math.random() * slots.length);
      let j = Math.floor(Math.random() * (slots.length - 1));
      if (j >= i) j++;
      const tmp = slots[i]; slots[i] = slots[j]; slots[j] = tmp;
      pintarTile(i);
      pintarTile(j);
    } else {
      // Hay más fotos que lugares: entra la siguiente de la cola y sale una visible
      if (cola.length === 0) {
        cola = TPR.barajar(aprobadas.filter((f) => !slots.some((s) => s.id === f.id)));
      }
      if (cola.length === 0) return;
      const i = Math.floor(Math.random() * slots.length);
      const saliente = slots[i];
      slots[i] = cola.shift();
      cola.push(saliente);
      pintarTile(i);
    }
  }

  // ---------- Logo TPR ----------
  function mostrarLogo() {
    logo.classList.add("visible");
    setTimeout(() => logo.classList.remove("visible"), LOGO_VISIBLE_MS);
  }

  // ---------- Presentación ----------
  async function iniciar() {
    presentando = true;
    escenario.classList.remove("oculto");
    try {
      if (escenario.requestFullscreen) await escenario.requestFullscreen();
    } catch (e) { /* si el navegador no permite pantalla completa, igual se muestra a pantalla completa de la ventana */ }

    try {
      if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
    } catch (e) { /* opcional */ }

    await cargarFotos();
    sincronizar();

    temporizadores.push(setInterval(rotar, ROTACION_MS));
    temporizadores.push(setInterval(cargarFotos, ACTUALIZAR_MS));
    temporizadores.push(setTimeout(mostrarLogo, 1500));
    temporizadores.push(setInterval(mostrarLogo, LOGO_CICLO_MS));
  }

  function detener() {
    presentando = false;
    temporizadores.forEach((t) => { clearInterval(t); clearTimeout(t); });
    temporizadores = [];
    logo.classList.remove("visible");
    escenario.classList.add("oculto");
    muro.innerHTML = "";
    tiles = [];
    claveDisposicion = "";
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
  document.getElementById("boton-salir-escenario").addEventListener("click", () => {
    detener();
  });
  document.getElementById("boton-salir-sesion").addEventListener("click", () => cerrarSesion(""));

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && presentando) detener();
  });

  // Si el usuario sale de pantalla completa con la tecla del navegador, se cierra el escenario
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && presentando) detener();
  });

  let redimensionTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(redimensionTimer);
    redimensionTimer = setTimeout(() => {
      if (presentando) { montarMuro(true); }
    }, 250);
  });

  // Contador del panel: se actualiza siempre que haya sesión (la presentación se actualiza por su cuenta)
  setInterval(() => { if (token && !presentando) cargarFotos(); }, ACTUALIZAR_MS);

  // Arranque
  if (token) {
    mostrarPanel(true);
    cargarFotos();
  } else {
    mostrarPanel(false);
  }
})();
