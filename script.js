/* ============================================================
   Manual de Winget — Lógica de interacción
   · Toggle de tema (claro/oscuro) con persistencia
   · Buscador/filtro de comandos en tiempo real
   · Copiar comando al portapapeles
   · Scrollspy: resalta sección activa en la tabla de contenidos
   ============================================================ */
(function () {
    "use strict";

    /* ---------- 1. Toggle de tema ---------- */
    const CLAVE_TEMA = "winget-manual-tema";
    const html = document.documentElement;
    const toggle = document.getElementById("theme-toggle");
    const icono = toggle ? toggle.querySelector(".theme-toggle__icono") : null;

    function aplicarTema(tema) {
        html.setAttribute("data-theme", tema);
        if (toggle) {
            toggle.setAttribute("aria-pressed", String(tema === "light"));
            if (icono) icono.textContent = tema === "light" ? "☀️" : "🌙";
        }
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute("content", tema === "light" ? "#eef4f8" : "#0a1018");
        }
    }

    // Tema inicial: preferencia guardada > preferencia del SO > oscuro
    let temaInicial = localStorage.getItem(CLAVE_TEMA);
    if (!temaInicial) {
        const prefiereClaro = window.matchMedia("(prefers-color-scheme: light)").matches;
        temaInicial = prefiereClaro ? "light" : "dark";
    }
    aplicarTema(temaInicial);

    if (toggle) {
        toggle.addEventListener("click", function () {
            const actual = html.getAttribute("data-theme") || "dark";
            const siguiente = actual === "dark" ? "light" : "dark";
            aplicarTema(siguiente);
            localStorage.setItem(CLAVE_TEMA, siguiente);
        });
    }

    /* ---------- 2. Buscador de comandos ---------- */
    const input = document.getElementById("buscar-comandos");
    const comandos = Array.from(document.querySelectorAll("article.comando"));
    const sinResultados = document.getElementById("sin-resultados");
    const sinResultadosTermino = document.getElementById("sin-resultados-termino");

    function textoComando(articulo) {
        // Combina el título h3, la descripción p y el atributo data-cmd
        const h3 = articulo.querySelector("h3");
        const p = articulo.querySelector("p");
        const cmd = articulo.getAttribute("data-cmd") || "";
        return [cmd, h3 ? h3.textContent : "", p ? p.textContent : ""]
            .join(" ")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    // Índice precalculado
    comandos.forEach(function (cmd) {
        cmd._texto = textoComando(cmd);
    });

    function filtrar() {
        const q = (input.value || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();

        let visibles = 0;
        comandos.forEach(function (cmd) {
            const coincide = !q || cmd._texto.indexOf(q) !== -1;
            cmd.style.display = coincide ? "" : "none";
            if (coincide) visibles++;
        });

        // Si una sección se queda sin comandos visibles (y la sección
        // contiene <article> de comando), se oculta para no dejar huecos.
        document.querySelectorAll("section.seccion").forEach(function (sec) {
            const hijosCmd = sec.querySelectorAll("article.comando");
            if (hijosCmd.length === 0) return; // secciones sin cards se mantienen
            const algunoVisible = Array.from(hijosCmd).some(function (c) {
                return c.style.display !== "none";
            });
            sec.style.display = algunoVisible ? "" : "none";
        });

        if (sinResultados) {
            const mostrar = q && visibles === 0;
            sinResultados.hidden = !mostrar;
            if (mostrar && sinResultadosTermino) {
                sinResultadosTermino.textContent = input.value.trim();
            }
        }
    }

    if (input) {
        input.addEventListener("input", filtrar);
        input.addEventListener("keydown", function (e) {
            if (e.key === "Escape") {
                input.value = "";
                filtrar();
            }
        });
    }

    /* ---------- 3. Copiar al portapapeles ---------- */
    document.querySelectorAll(".copiar").forEach(function (boton) {
        boton.addEventListener("click", async function () {
            const pre = boton.closest("pre");
            if (!pre) return;
            const code = pre.querySelector("code");
            const texto = code ? code.textContent : pre.textContent;
            try {
                await navigator.clipboard.writeText(texto);
            } catch (err) {
                // Fallback para contextos no seguros
                const tmp = document.createElement("textarea");
                tmp.value = texto;
                tmp.setAttribute("readonly", "");
                tmp.style.position = "absolute";
                tmp.style.left = "-9999px";
                document.body.appendChild(tmp);
                tmp.select();
                try {
                    document.execCommand("copy");
                } catch (_) {}
                document.body.removeChild(tmp);
            }
            const original = boton.textContent;
            boton.textContent = "¡Copiado!";
            boton.classList.add("copiado");
            boton.setAttribute("aria-label", "Comando copiado al portapapeles");
            setTimeout(function () {
                boton.textContent = original;
                boton.classList.remove("copiado");
                boton.setAttribute("aria-label", "Copiar comando al portapapeles");
            }, 1400);
        });
    });

    /* ---------- 4. Scrollspy en la tabla de contenidos ---------- */
    const enlacesToc = Array.from(document.querySelectorAll(".toc__lista a"));
    const seccionesToc = enlacesToc
        .map(function (a) {
            const id = a.getAttribute("href").slice(1);
            return document.getElementById(id);
        })
        .filter(Boolean);

    if ("IntersectionObserver" in window && seccionesToc.length) {
        const observer = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    const id = entry.target.id;
                    enlacesToc.forEach(function (enlace) {
                        const activo = enlace.getAttribute("href") === "#" + id;
                        enlace.classList.toggle("activo", activo);
                    });
                });
            },
            {
                rootMargin: "-30% 0px -60% 0px",
                threshold: 0
            }
        );
        seccionesToc.forEach(function (sec) {
            observer.observe(sec);
        });
    }

    /* ---------- 5. Scroll suave y descuento de altura de cabecera ---------- */
    enlacesToc.forEach(function (enlace) {
        enlace.addEventListener("click", function (e) {
            const destino = enlace.getAttribute("href");
            if (!destino || !destino.startsWith("#")) return;
            const objetivo = document.querySelector(destino);
            if (!objetivo) return;
            e.preventDefault();
            objetivo.scrollIntoView({ behavior: "smooth", block: "start" });
            // Actualiza el focus accesible
            objetivo.setAttribute("tabindex", "-1");
            objetivo.focus({ preventScroll: true });
        });
    });
})();
