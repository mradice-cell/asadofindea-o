// Utilidades compartidas por las tres páginas (sin módulos, para funcionar en cualquier navegador)
var TPR = {
  async api(ruta, opciones) {
    const o = opciones || {};
    const cabeceras = {};
    if (o.cuerpo) cabeceras["Content-Type"] = "application/json";
    if (o.token) cabeceras["Authorization"] = "Bearer " + o.token;

    const r = await fetch(ruta, {
      method: o.metodo || "GET",
      headers: cabeceras,
      body: o.cuerpo ? JSON.stringify(o.cuerpo) : undefined,
    });

    let datos = {};
    try { datos = await r.json(); } catch (e) { /* respuesta sin JSON */ }

    if (!r.ok) {
      const error = new Error(datos.error || "No pudimos completar la acción. Intentá de nuevo.");
      error.status = r.status;
      throw error;
    }
    return datos;
  },

  escapar(texto) {
    return String(texto).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  },

  fecha(iso) {
    try {
      return new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "";
    }
  },

  barajar(lista) {
    const a = lista.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  },
};
