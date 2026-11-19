import { respuesta, passwordValida, crearToken } from "../lib/util.js";

// POST /api/login  { rol: "admin" | "presentador", password }
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

  const rol = datos.rol;
  if (rol !== "admin" && rol !== "presentador") {
    return respuesta(400, { error: "Rol inválido" });
  }

  if (!passwordValida(rol, datos.password)) {
    // Pausa breve para dificultar la prueba de contraseñas
    await new Promise((r) => setTimeout(r, 800));
    return respuesta(401, { error: "Contraseña incorrecta" });
  }

  return respuesta(200, { token: crearToken(rol), rol });
};
