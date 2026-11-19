import { respuesta, fotosStore, autorizar, idValido } from "../lib/util.js";

const ESTADOS = ["pendiente", "aprobada", "rechazada"];

// POST /api/admin-accion
//   { id, accion: "moderar", estado: "aprobada" | "rechazada" | "pendiente" }
//   { id, accion: "eliminar" }
// Solo admin.
export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return respuesta(405, { error: "Método no permitido" });
  }
  if (!autorizar(event, ["admin"])) {
    return respuesta(401, { error: "Sesión no válida. Volvé a iniciar sesión." });
  }

  let datos;
  try {
    datos = JSON.parse(event.body || "{}");
  } catch {
    return respuesta(400, { error: "Solicitud inválida" });
  }

  if (!idValido(datos.id)) {
    return respuesta(400, { error: "Foto inválida" });
  }

  const store = fotosStore();
  const meta = await store.get(`meta/${datos.id}`, { type: "json" });
  if (!meta) {
    return respuesta(404, { error: "La foto ya no existe" });
  }

  if (datos.accion === "eliminar") {
    await store.delete(`img/${datos.id}`);
    await store.delete(`meta/${datos.id}`);
    return respuesta(200, { ok: true });
  }

  if (datos.accion === "moderar" && ESTADOS.includes(datos.estado)) {
    meta.estado = datos.estado;
    meta.revisada = new Date().toISOString();
    await store.setJSON(`meta/${datos.id}`, meta);
    return respuesta(200, { ok: true, meta });
  }

  return respuesta(400, { error: "Acción inválida" });
};
