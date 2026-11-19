import { respuesta, fotosStore, autorizar, listarMetas } from "../lib/util.js";

// GET /api/fotos-aprobadas  →  presentador (o admin). Devuelve solo las fotos aprobadas.
export const handler = async (event) => {
  if (!autorizar(event, ["presentador", "admin"])) {
    return respuesta(401, { error: "Sesión no válida. Volvé a iniciar sesión." });
  }

  const metas = await listarMetas(fotosStore());
  const fotos = metas
    .filter((m) => m.estado === "aprobada")
    .map((m) => ({ id: m.id, url: `/api/imagen?id=${encodeURIComponent(m.id)}` }));

  return respuesta(200, { fotos });
};
