(function () {
  const form = document.getElementById("form-subida");
  const archivo = document.getElementById("archivo");
  const vista = document.getElementById("vista-previa");
  const nombre = document.getElementById("nombre");
  const boton = document.getElementById("boton-enviar");
  const mensaje = document.getElementById("mensaje");

  let imagenComprimida = null;

  function mostrar(texto, tipo) {
    mensaje.textContent = texto;
    mensaje.className = "mensaje " + (tipo || "");
  }

  // Redimensiona y comprime la foto en el navegador para que la subida sea rápida
  function cargarImagen(file) {
    return new Promise((resolver, rechazar) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolver(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error("No pudimos leer esa imagen.")); };
      img.src = url;
    });
  }

  async function comprimir(file, ladoMaximo, calidad) {
    const img = await cargarImagen(file);
    const escala = Math.min(1, ladoMaximo / Math.max(img.width, img.height));
    const ancho = Math.round(img.width * escala);
    const alto = Math.round(img.height * escala);
    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(img, 0, 0, ancho, alto);
    return canvas.toDataURL("image/jpeg", calidad);
  }

  archivo.addEventListener("change", async () => {
    imagenComprimida = null;
    boton.disabled = true;
    mostrar("");
    const file = archivo.files && archivo.files[0];
    if (!file) { vista.classList.add("oculto"); return; }

    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      vista.classList.add("oculto");
      mostrar("Ese formato no está permitido. Usá JPG, PNG o WEBP.", "error");
      archivo.value = "";
      return;
    }

    try {
      mostrar("Preparando tu foto…");
      imagenComprimida = await comprimir(file, 1600, 0.85);
      vista.src = imagenComprimida;
      vista.classList.remove("oculto");
      boton.disabled = false;
      mostrar("");
    } catch (e) {
      vista.classList.add("oculto");
      mostrar(e.message, "error");
    }
  });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!imagenComprimida) {
      mostrar("Primero elegí una foto.", "error");
      return;
    }

    boton.disabled = true;
    mostrar("Enviando tu foto…");
    try {
      const r = await TPR.api("/api/subir", {
        metodo: "POST",
        cuerpo: { imagen: imagenComprimida, nombre: nombre.value.trim() },
      });
      mostrar(r.mensaje || "¡Gracias! Tu foto fue enviada.", "ok");
      form.reset();
      vista.classList.add("oculto");
      imagenComprimida = null;
    } catch (e) {
      mostrar(e.message, "error");
      boton.disabled = false;
    }
  });
})();
