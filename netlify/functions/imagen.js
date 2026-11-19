import { respuesta, fotosStore, autorizar, idValido } from "../lib/util.js";

// GET /api/imagen?id=...[&token=...]
// Las fotos aprobadas son públicas (para la presentación).
// Las pendientes/rechazadas solo las ve el admin o el presentador con sesión válida.
export const handler = async (event) => {
  const id = event.queryStringParameters?.id;
  if (!idValido(id)) {
    return respuesta(404, { error: "No encontrada" });
  }

  const store = fotosStore();
  const meta = await store.get(`meta/${id}`, { type: "json" });
  if (!meta) {
    return respuesta(404, { error: "No encontrada" });
  }

  const puedeVerla =
    meta.estado === "aprobada" || autorizar(event, ["admin", "presentador"]);
  if (!puedeVerla) {
    return respuesta(404, { error: "No encontrada" });
  }

  const bytes = await store.get(`img/${id}`, { type: "arrayBuffer" });
  if (!bytes) {
    return respuesta(404, { error: "No encontrada" });
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": meta.tipo || "image/jpeg",
      "Cache-Control": "private, max-age=120",
    },
    body: Buffer.from(bytes).toString("base64"),
    isBase64Encoded: true,
  };
};
