import { respuesta, fotosStore, autorizar, listarMetas } from "../lib/util.js";

// GET /api/admin-fotos  →  solo admin. Lista todas las fotos con su estado.
export const handler = async (event) => {
  if (!autorizar(event, ["admin"])) {
    return respuesta(401, { error: "Sesión no válida. Volvé a iniciar sesión." });
  }
  const fotos = await listarMetas(fotosStore());
  return respuesta(200, { fotos });
};
