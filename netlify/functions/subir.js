import crypto from "node:crypto";
import { respuesta, fotosStore } from "../lib/util.js";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const FORMATO = /^data:(image\/jpeg|image\/png|image\/webp);base64,([A-Za-z0-9+/=]+)$/;

// POST /api/subir  →  pública. Recibe la foto ya comprimida en el navegador.
export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return respuesta(405, { error: "Método no permitido" });
  }

  let datos;
  try {
    datos = JSON.parse(event.body || "{}");
  } catch {
    return respuesta(400, { error: "Solicitud inválida" });
  }

  const coincidencia = FORMATO.exec(datos.imagen || "");
  if (!coincidencia) {
    return respuesta(400, { error: "Subí una foto en formato JPG, PNG o WEBP." });
  }

  const tipo = coincidencia[1];
  const buffer = Buffer.from(coincidencia[2], "base64");
  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    return respuesta(400, { error: "La foto es demasiado grande (máximo 5 MB)." });
  }

  const id = crypto.randomUUID();
  const nombre = String(datos.nombre || "").replace(/[<>]/g, "").trim().slice(0, 60);
  const meta = {
    id,
    estado: "pendiente", // pendiente → aprobada | rechazada
    fecha: new Date().toISOString(),
    tipo,
    nombre,
  };

  const store = fotosStore();
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  await store.set(`img/${id}`, arrayBuffer);
  await store.setJSON(`meta/${id}`, meta);

  return respuesta(201, {
    ok: true,
    mensaje: "¡Gracias! Tu foto fue enviada y será revisada antes de proyectarse.",
  });
};
