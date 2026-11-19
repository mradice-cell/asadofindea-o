import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

// Las contraseñas se leen SIEMPRE desde variables de entorno de Netlify (nunca van en el código).
const VARIABLE_POR_ROL = {
  admin: "ADMIN_PASSWORD",
  presentador: "PRESENTER_PASSWORD",
};

const HORAS_SESION = 12;

export function respuesta(statusCode, datos) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(datos),
  };
}

export function fotosStore() {
  return getStore({ name: "fotos-evento", consistency: "strong" });
}

function secretoSesion() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("Falta configurar SESSION_SECRET en Netlify (mínimo 16 caracteres).");
  }
  return s;
}

function firmar(payload) {
  return crypto.createHmac("sha256", secretoSesion()).update(payload).digest("base64url");
}

export function passwordValida(rol, intento) {
  const variable = VARIABLE_POR_ROL[rol];
  const real = variable ? process.env[variable] : undefined;
  if (!real || typeof intento !== "string") return false;
  // Comparación en tiempo constante, con hashes de igual largo
  const a = crypto.createHash("sha256").update(intento).digest();
  const b = crypto.createHash("sha256").update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

export function crearToken(rol) {
  const payload = Buffer.from(
    JSON.stringify({ rol, exp: Date.now() + HORAS_SESION * 3600 * 1000 })
  ).toString("base64url");
  return `${payload}.${firmar(payload)}`;
}

export function verificarToken(token, rolesPermitidos) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [payload, firma] = token.split(".");
  const esperada = firmar(payload);
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let datos;
  try {
    datos = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!datos || typeof datos.exp !== "number" || datos.exp < Date.now()) return null;
  if (rolesPermitidos && !rolesPermitidos.includes(datos.rol)) return null;
  return datos;
}

// Lee el token desde "Authorization: Bearer ..." o, para <img>, desde ?token=
export function autorizar(event, roles) {
  const cabecera = event.headers?.authorization || event.headers?.Authorization || "";
  const token = cabecera.startsWith("Bearer ")
    ? cabecera.slice(7)
    : event.queryStringParameters?.token;
  return verificarToken(token, roles);
}

export function idValido(id) {
  return typeof id === "string" && /^[a-f0-9-]{36}$/i.test(id);
}

export async function listarMetas(store) {
  const metas = [];
  for await (const pagina of store.list({ prefix: "meta/", paginate: true })) {
    for (const { key } of pagina.blobs) {
      const meta = await store.get(key, { type: "json" });
      if (meta) metas.push(meta);
    }
  }
  return metas.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}
