(function () {
  const CLAVE_TOKEN = "tpr_token_admin";
  const vistaLogin = document.getElementById("vista-login");
  const vistaPanel = document.getElementById("vista-panel");
  const formLogin = document.getElementById("form-login");
  const inputPassword = document.getElementById("password");
  const mensajeLogin = document.getElementById("mensaje-login");
  const grilla = document.getElementById("grilla");
  const estado = document.getElementById("estado");

  let token = sessionStorage.getItem(CLAVE_TOKEN);
  let fotos = [];
  let filtro = "pendiente";
  let cargando = false;

  function mostrarPanel(mostrar) {
    vistaLogin.classList.toggle("oculto", mostrar);
    vistaPanel.classList.toggle("oculto", !mostrar);
  }

  function cerrarSesion(mensaje) {
    token = null;
    sessionStorage.removeItem(CLAVE_TOKEN);
    fotos = [];
    mostrarPanel(false);
    mensajeLogin.textContent = mensaje || "";
  }

  function avisar(texto, tipo) {
    estado.textContent = texto;
    estado.className = "mensaje " + (tipo || "ok");
    if (texto) setTimeout(() => { if (estado.textContent === texto) estado.textContent = ""; }, 3500);
  }

  function urlImagen(foto) {
    return "/api/imagen?id=" + encodeURIComponent(foto.id) + "&token=" + encodeURIComponent(token);
  }

  function contar() {
    const c = { pendiente: 0, aprobada: 0, rechazada: 0 };
    fotos.forEach((f) => { if (c[f.estado] !== undefined) c[f.estado]++; });
    document.getElementById("n-pendiente").textContent = c.pendiente;
    document.getElementById("n-aprobada").textContent = c.aprobada;
    document.getElementById("n-rechazada").textContent = c.rechazada;
    document.getElementById("n-todas").textContent = fotos.length;
  }

  function botonesPara(foto) {
    const id = TPR.escapar(foto.id);
    const b = [];
    if (foto.estado !== "aprobada") b.push(`<button class="boton exito" data-accion="moderar" data-estado="aprobada" data-id="${id}">Aprobar</button>`);
    if (foto.estado !== "rechazada") b.push(`<button class="boton peligro" data-accion="moderar" data-estado="rechazada" data-id="${id}">Rechazar</button>`);
    if (foto.estado !== "pendiente") b.push(`<button class="boton secundario" data-accion="moderar" data-estado="pendiente" data-id="${id}">Pendiente</button>`);
    b.push(`<button class="boton secundario" data-accion="eliminar" data-id="${id}" title="Eliminar definitivamente">🗑</button>`);
    return b.join("");
  }

  function render() {
    contar();
    const lista = fotos.filter((f) => filtro === "todas" || f.estado === filtro);
    if (lista.length === 0) {
      grilla.innerHTML = `<div class="vacio">No hay fotos en esta categoría todavía.</div>`;
      return;
    }
    grilla.innerHTML = lista.map((f) => `
      <article class="ficha">
        <img class="foto" loading="lazy" alt="Foto enviada" src="${urlImagen(f)}">
        <div class="cuerpo">
          <span class="chip ${TPR.escapar(f.estado)}">${TPR.escapar(f.estado)}</span>
          <div class="meta"><strong>${TPR.escapar(f.nombre || "Sin nombre")}</strong><br>${TPR.escapar(TPR.fecha(f.fecha))}</div>
          <div class="botones">${botonesPara(f)}</div>
        </div>
      </article>`).join("");
  }

  async function cargar(silencioso) {
    if (!token || cargando) return;
    cargando = true;
    if (!silencioso) avisar("Cargando fotos…", "ok");
    try {
      const r = await TPR.api("/api/admin-fotos", { token });
      fotos = r.fotos || [];
      render();
      if (!silencioso) avisar("Listo", "ok");
    } catch (e) {
      if (e.status === 401) return cerrarSesion("Tu sesión venció. Volvé a ingresar.");
      avisar(e.message, "error");
    } finally {
      cargando = false;
    }
  }

  async function accion(id, datos) {
    try {
      await TPR.api("/api/admin-accion", { metodo: "POST", token, cuerpo: Object.assign({ id }, datos) });
      if (datos.accion === "eliminar") {
        fotos = fotos.filter((f) => f.id !== id);
      } else {
        const f = fotos.find((x) => x.id === id);
        if (f) f.estado = datos.estado;
      }
      render();
    } catch (e) {
      if (e.status === 401) return cerrarSesion("Tu sesión venció. Volvé a ingresar.");
      avisar(e.message, "error");
    }
  }

  // Eventos
  formLogin.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    mensajeLogin.textContent = "";
    const boton = document.getElementById("boton-login");
    boton.disabled = true;
    try {
      const r = await TPR.api("/api/login", { metodo: "POST", cuerpo: { rol: "admin", password: inputPassword.value } });
      token = r.token;
      sessionStorage.setItem(CLAVE_TOKEN, token);
      inputPassword.value = "";
      mostrarPanel(true);
      cargar();
    } catch (e) {
      mensajeLogin.textContent = e.message;
    } finally {
      boton.disabled = false;
    }
  });

  document.querySelectorAll(".pestana").forEach((btn) => {
    btn.addEventListener("click", () => {
      filtro = btn.dataset.filtro;
      document.querySelectorAll(".pestana").forEach((b) => b.classList.toggle("activa", b === btn));
      render();
    });
  });

  grilla.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-accion]");
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.accion === "eliminar") {
      if (!confirm("¿Eliminar esta foto definitivamente?")) return;
      return accion(id, { accion: "eliminar" });
    }
    accion(id, { accion: "moderar", estado: btn.dataset.estado });
  });

  document.getElementById("boton-actualizar").addEventListener("click", () => cargar(false));
  document.getElementById("boton-salir").addEventListener("click", () => cerrarSesion(""));

  // Actualización automática para ver las fotos nuevas que llegan
  setInterval(() => cargar(true), 30000);

  if (token) { mostrarPanel(true); cargar(); } else { mostrarPanel(false); }
})();
