//Manejo de fechas
const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const nombresMesesCortos = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const formatoPeriodo = (anio, mes) => `${anio}-${String(mes).padStart(2, "0")}`;

const obtenerPeriodoActual = () => {
    const fecha = new Date();
    return formatoPeriodo(fecha.getFullYear(), fecha.getMonth() + 1);
};

//Fecha de hoy en formato dd/mm/aaaa
const obtenerFechaActual = () => {
    const fecha = new Date();
    return `${String(fecha.getDate()).padStart(2, "0")}/${String(fecha.getMonth() + 1).padStart(2, "0")}/${fecha.getFullYear()}`;
};

const sumarMeses = (periodo, cantidad) => {
    const [anio, mes] = periodo.split("-").map(Number);
    const fecha = new Date(anio, mes - 1 + cantidad, 1);
    return formatoPeriodo(fecha.getFullYear(), fecha.getMonth() + 1);
};

const nombrePeriodo = (periodo) => `${nombresMeses[Number(periodo.slice(5)) - 1]} ${periodo.slice(0, 4)}`;
const nombrePeriodoCorto = (periodo) => `${nombresMesesCortos[Number(periodo.slice(5)) - 1]} ${periodo.slice(2, 4)}`;

const rangoPeriodos = (desde, hasta) => {
    const periodos = [];
    let periodo = desde;
    while (periodo <= hasta) {
        periodos.push(periodo);
        periodo = sumarMeses(periodo, 1);
    }
    return periodos;
};

const mayorPeriodo = (a, b) => a > b ? a : b;
const formatearMonto = (monto) => `$${monto.toLocaleString("es-AR")}`;
const plural = (cantidad, palabra) => `${cantidad} ${palabra}${cantidad === 1 ? "" : "s"}`;

//Convierte "d/m/aaaa" en número para poder ordenar los pagos
const fechaANumero = (fecha) => {
    const [dia, mes, anio] = fecha.split("/").map(Number);
    return new Date(anio, mes - 1, dia).getTime();
};

//Ordena los pagos del más reciente al más antiguo
const ordenarPorFecha = (pagos) => pagos.sort((a, b) => fechaANumero(b.fecha) - fechaANumero(a.fecha));

const nombrePlan = (cantidad) => {
    switch (cantidad) {
        case 1: return "Mensual";
        case 3: return "Trimestral";
        case 6: return "Semestral";
        case 12: return "Anual";
        default: return `${cantidad} meses`;
    }
};

class Socio {
    constructor(nombre, apellido, dni, mail, cuota, alta, fechaInscripcion) {
        this.nombre = nombre;
        this.apellido = apellido;
        this.dni = dni;
        this.mail = mail;
        this.cuota = cuota;
        this.alta = alta;
        this.fechaInscripcion = fechaInscripcion;
        this.periodosPagados = [];
        this.historialPagos = [];
    }
    ultimoPeriodoPagado() { return this.periodosPagados[this.periodosPagados.length - 1] || ""; }

//Desde el alta hasta 12 meses después del mes actual o del último mes pagado
    periodosDelPlan() { 
        return rangoPeriodos(this.alta, sumarMeses(mayorPeriodo(this.ultimoPeriodoPagado(), obtenerPeriodoActual()), 12)); }
    periodosImpagos() {
        return this.periodosDelPlan().filter(periodo => !this.periodosPagados.includes(periodo)); }
    deudas() { 
        return this.periodosImpagos().filter(periodo => periodo <= obtenerPeriodoActual()); }
    estaAlDia() {
         return this.deudas().length === 0; }
    buscarPago(periodo) {
         return this.historialPagos.find(pago => pago.periodos.includes(periodo)); }
    totalPagado() {
         return this.historialPagos.reduce((total, pago) => total + pago.monto, 0); }
    calcularMonto(cantidad, formaPago) {
        const total = this.cuota * cantidad;
        return Math.round(formaPago === "efectivo" ? total * 0.90 : total);
    }
    pagar(periodos, formaPago) {
//No se puede cobrar dos veces el mismo mes
        if (periodos.length === 0 || periodos.some(periodo => this.periodosPagados.includes(periodo))) return 0;
        const cuotas = [...periodos].sort();
        const monto = this.calcularMonto(cuotas.length, formaPago);
        this.periodosPagados.push(...cuotas);
        this.periodosPagados.sort();
        this.historialPagos.push({ fecha: obtenerFechaActual(), periodos: cuotas, cantidad: cuotas.length, monto, formaPago, estado: "Acreditado" });
        return monto;
    }
}

const socios = [];
let dniEditando = null;
let dniPagos = "";
let dniHistorial = "";

//Convertir a socio
const reconstruirSocio = ({ nombre, apellido, dni, mail, cuota, alta, fechaInscripcion, periodosPagados, historialPagos }) => {
    const periodoAlta = alta ?? obtenerPeriodoActual();
    const [anioAlta, mesAlta] = periodoAlta.split("-");
    const socio = new Socio(nombre, apellido, dni, mail, Number(cuota), periodoAlta, fechaInscripcion ?? `01/${mesAlta}/${anioAlta}`);
    socio.periodosPagados = [...(periodosPagados ?? [])].sort();
    socio.historialPagos = (historialPagos ?? []).map(pago => ({ ...pago, cantidad: pago.cantidad ?? pago.periodos.length, estado: pago.estado ?? "Acreditado" }));
    return socio;
};

const formulario = document.querySelector("#formulario");
const tituloFormulario = document.querySelector(".titulo-formulario");
const inputs = [".nombre", ".apellido", ".dni", ".mail"].map(clase => document.querySelector(clase));
const [inputNombre, inputApellido, inputDni, inputMail] = inputs;
const buscador = document.querySelector(".buscador");
const botonAgregar = document.querySelector(".btn-agregar");
const selectSocio = document.querySelector(".select-socio");
const planPago = document.querySelector(".plan-pago");
const selectHistorial = document.querySelector(".select-historial");
const historialSocio = document.querySelector(".historial-socio");
const filtroRegistro = document.querySelector(".filtro-registro");
const filtroSocio = document.querySelector(".filtro-socio");

//Mensajes con Toastify
const mostrarMensaje = (texto, esError = false) => Toastify({
    text: texto,
    duration: 3000,
    gravity: "top",
    position: "right",
    offset: { x: 20, y: 120 },
    style: { background: esError ? "#b3261e" : "#154", borderRadius: "8px", fontSize: "22px" }
}).showToast();

//Confirmaciones con SweetAlert
const confirmar = (title, html, confirmButtonText, icon = "warning") => 
    Swal.fire({
    title, html, icon, confirmButtonText, showCancelButton: true, cancelButtonText: "Cancelar",
    confirmButtonColor: icon === "warning" ? "#d82a17" : "#154",
    cancelButtonColor: icon === "warning" ? "#154" : "#d82a17"
});

const armarTabla = (encabezados, filas) => `
    <div class="tabla-scroll"><table>
        <thead><tr>${encabezados.map(titulo => `<th>${titulo}</th>`).join("")}</tr></thead>
        <tbody>${filas.join("")}</tbody>
    </table></div>`;

const vacio = (texto) => `<p class="vacio">${texto}</p>`;
const estadoSocio = (socio) => socio.estaAlDia()
    ? `<strong class="texto-aldia">Al día</strong>`
    : `<strong class="texto-deuda">Debe ${plural(socio.deudas().length, "cuota")}</strong>`;

const pagadoHasta = (socio) => socio.ultimoPeriodoPagado() ? nombrePeriodo(socio.ultimoPeriodoPagado()) : "Sin pagos";

//Resumen
const actualizarResumen = () => {
    document.querySelector(".total-socios").innerText = socios.length;
    document.querySelector(".socios-activos").innerText = socios.filter(socio => socio.estaAlDia()).length;
    document.querySelector(".total-deuda").innerText = socios.reduce((total, socio) => total + socio.deudas().length, 0);
    document.querySelector(".total-recaudado").innerText = formatearMonto(socios.reduce((total, socio) => total + socio.totalPagado(), 0));
};

//Ir al apartado de pagos o al historial con un socio elegido
const irAPagos = (dni, marcarDeudas) => {
    dniPagos = dni;
    mostrarSelect();
    mostrarPlan();
    if (marcarDeudas) planPago.querySelector(".atajo-deudas").click();
    document.querySelector("#pagos").scrollIntoView();
};

const irAHistorial = (dni) => {
    dniHistorial = dni;
    mostrarSelect();
    mostrarHistorial();
    document.querySelector("#historial").scrollIntoView();
};

//Mostrar socios
const mostrarSocios = (lista) => {
    const listaSocios = document.querySelector(".lista-socios");
    listaSocios.innerHTML = lista.length === 0 ? vacio("No se encontraron socios") : lista.map(socio => `
        <div class="socio">
            <h3>${socio.nombre} ${socio.apellido}</h3>
            <p>DNI: ${socio.dni}</p>
            <p>Mail: ${socio.mail}</p>
            <p>Inscripción: ${socio.fechaInscripcion}</p>
            <p>Cuota: ${formatearMonto(socio.cuota)}</p>
            <p>Pagado hasta: ${pagadoHasta(socio)}</p>
            <p>Estado: ${estadoSocio(socio)}</p>
            <button class="pagar${socio.dni}">Gestionar pagos</button>
            <button class="historial${socio.dni}">Ver historial</button>
            <button class="editar${socio.dni}">Editar socio</button>
            <button class="eliminar${socio.dni}">Eliminar socio</button>
        </div>`).join("");
    lista.forEach(socio => {
        const { dni } = socio;
        document.querySelector(".pagar" + dni).addEventListener("click", () => irAPagos(dni, false));
        document.querySelector(".historial" + dni).addEventListener("click", () => irAHistorial(dni));
        document.querySelector(".editar" + dni).addEventListener("click", () => iniciarEdicion(socio));
        document.querySelector(".eliminar" + dni).addEventListener("click", () => eliminarSocio(socio));
    });
};

//Eliminar socio
const eliminarSocio = (socio) => {
    const { nombre, dni } = socio;
    confirmar("¿Estás seguro?", `¿Querés eliminar al socio ${nombre}? También se eliminará su historial de pagos. Esta acción no se puede deshacer.`, "Sí, eliminar")
        .then(({ isConfirmed }) => {
            if (!isConfirmed) return;
            socios.splice(socios.indexOf(socio), 1);
            guardarSocios(socios);
            if (dniPagos === dni) dniPagos = "";
            if (dniHistorial === dni) dniHistorial = "";
            if (dniEditando === dni) salirEdicion();
            mostrarMensaje(`Socio ${nombre} eliminado`);
            actualizarVistas();
        });
};

//Socios al día y socios con deuda
const mostrarEstados = () => {
    const alDia = socios.filter(socio => socio.estaAlDia());
    const conDeuda = socios.filter(socio => !socio.estaAlDia()).sort((a, b) => b.deudas().length - a.deudas().length);
    const botonVer = (dni) => `<button type="button" class="atajo btn-ver" data-dni="${dni}">Ver historial</button>`;
    document.querySelector(".cantidad-aldia").innerText = alDia.length;
    document.querySelector(".cantidad-deuda").innerText = conDeuda.length;
    document.querySelector(".lista-aldia").innerHTML = alDia.length === 0 ? vacio("No hay socios al día") : armarTabla(
        ["Socio", "DNI", "Pagado hasta", ""],
        alDia.map(socio => `<tr><th>${socio.apellido}, ${socio.nombre}</th><td>${socio.dni}</td><td>${pagadoHasta(socio)}</td><td>${botonVer(socio.dni)}</td></tr>`)
    );
    document.querySelector(".lista-deuda").innerHTML = conDeuda.length === 0 ? vacio("No hay socios con deuda") : armarTabla(
        ["Socio", "DNI", "Cuotas adeudadas", ""],
        conDeuda.map(socio => `
            <tr>
                <th>${socio.apellido}, ${socio.nombre}</th><td>${socio.dni}</td><td class="celda-adeudada">${socio.deudas().length}</td>
                <td><button type="button" class="atajo btn-cancelar-deuda" data-dni="${socio.dni}">Cancelar deuda</button></td>
            </tr>`)
    );
    document.querySelectorAll("#estado .btn-ver").forEach(boton => boton.addEventListener("click", () => irAHistorial(boton.dataset.dni)));
    document.querySelectorAll("#estado .btn-cancelar-deuda").forEach(boton => boton.addEventListener("click", () => irAPagos(boton.dataset.dni, true)));
};

//Tabla con los pagos realizados
const armarTablaPagos = (pagos) => {
    if (pagos.length === 0) return vacio("Todavía no hay pagos registrados");
    return armarTabla(
        ["Fecha", "Socio", "Meses abonados", "Forma de pago", "Monto"],
        pagos.map(pago => `
            <tr>
                <td>${pago.fecha}</td><td>${pago.socio}</td>
                <td class="celda-cuotas">${pago.periodos.map(nombrePeriodoCorto).join(", ")}</td>
                <td>${pago.formaPago}</td><td>${formatearMonto(pago.monto)}</td>
            </tr>`)
    );
};

//Select con todos los socios
const llenarSelect = (select, textoInicial, valor) => {
    select.innerHTML = `<option value="">${textoInicial}</option>` +
        socios.map(({ nombre, apellido, dni }) => `<option value="${dni}">${apellido}, ${nombre} (DNI ${dni})</option>`).join("");
    select.value = socios.some(socio => socio.dni === valor) ? valor : "";
};

const mostrarSelect = () => {
    llenarSelect(selectSocio, "Elegí un socio", dniPagos);
    llenarSelect(selectHistorial, "Elegí un socio", dniHistorial);
    llenarSelect(filtroSocio, "Todos los socios", filtroSocio.value);
};

//Plan de pago del socio seleccionado
const socioEnPagos = () => socios.find(socio => socio.dni === dniPagos);
const inputCantidad = planPago.querySelector(".cantidad-meses");
const errorCantidad = planPago.querySelector(".error-cantidad");
const formaPago = planPago.querySelector(".forma-pago");
const textosPeriodo = { pagada: "Pagada", adeudada: "Adeudada", adelanto: "Adelanto" };

const mostrarErrorCantidad = (texto) => {
    inputCantidad.classList.toggle("invalido", texto !== "");
    errorCantidad.textContent = texto;
};

const mostrarPlan = () => {
    const socio = socioEnPagos();
    planPago.hidden = !socio;
    document.querySelector(".plan-vacio").hidden = Boolean(socio);
    if (!socio) return;

    const { nombre, apellido, dni, cuota } = socio;
    const actual = obtenerPeriodoActual();
    const deudas = socio.deudas().length;
    planPago.querySelector(".plan-resumen").innerHTML = `
        <h3>${nombre} ${apellido} - DNI ${dni}</h3>
        <p>Cuota mensual: ${formatearMonto(cuota)}</p>
        <p>Cuotas adeudadas: ${deudas} (${formatearMonto(deudas * cuota)})</p>
        <p>Pagado hasta: ${pagadoHasta(socio)}</p>`;
    planPago.querySelector(".plan-periodos").innerHTML = socio.periodosDelPlan().map(periodo => {
        const pagada = socio.periodosPagados.includes(periodo);
        const estado = pagada ? "pagada" : periodo <= actual ? "adeudada" : "adelanto";
        return `
            <label class="periodo ${estado}">
                <input type="checkbox" value="${periodo}" ${pagada ? "checked disabled" : ""}>
                <span>${nombrePeriodo(periodo)}<small>${textosPeriodo[estado]}</small></span>
            </label>`;
    }).join("");
    inputCantidad.value = "";
    formaPago.value = "efectivo";
    mostrarErrorCantidad("");
    actualizarTotal();
};

const obtenerElegidos = () => [...planPago.querySelectorAll(".periodo input:not(:disabled):checked")].map(input => input.value);
const actualizarTotal = () => {
    const socio = socioEnPagos();
    if (!socio) return;
    const elegidos = obtenerElegidos();
    const monto = socio.calcularMonto(elegidos.length, formaPago.value);
    planPago.querySelector(".plan-total").innerText = `Cuotas elegidas: ${elegidos.length} - Total a pagar: ${formatearMonto(monto)}`;
};

const marcarPeriodos = (lista, textoVacio) => {
    if (lista.length === 0 && textoVacio) mostrarMensaje(textoVacio);
    planPago.querySelectorAll(".periodo input:not(:disabled)").forEach(input => input.checked = lista.includes(input.value));
    actualizarTotal();
};

//Elige una cantidad de cuotas consecutivas desde la primera sin pagar
const elegirCantidad = (cantidad) => marcarPeriodos(socioEnPagos().periodosImpagos().slice(0, cantidad));

planPago.querySelector(".atajo-deudas").addEventListener("click", () =>
    marcarPeriodos(socioEnPagos().deudas(), "El socio no tiene cuotas adeudadas"));

planPago.querySelector(".atajo-limpiar").addEventListener("click", () => marcarPeriodos([]));
planPago.querySelectorAll(".atajo-cantidad").forEach(boton => boton.addEventListener("click", () => elegirCantidad(Number(boton.dataset.cantidad))));

//Cualquier cambio en las cuotas o en la forma de pago recalcula el total
planPago.addEventListener("change", actualizarTotal);

//Cantidad de meses a elección
planPago.querySelector(".atajo-personalizado").addEventListener("click", () => {
    const valor = inputCantidad.value.trim();
    const valida = /^\d+$/.test(valor) && Number(valor) >= 1 && Number(valor) <= 12;
    mostrarErrorCantidad(valida ? "" : "La cantidad de meses debe ser un número entero entre 1 y 12");
    if (valida) elegirCantidad(Number(valor));
});

inputCantidad.addEventListener("input", () => mostrarErrorCantidad(""));

//Registrar pago
planPago.querySelector(".btn-registrar-pago").addEventListener("click", () => {
    const socio = socioEnPagos();
    const elegidos = obtenerElegidos();
    if (elegidos.length === 0) {
        mostrarMensaje("Elegí al menos una cuota para pagar", true);
        return;
    }
    const monto = socio.calcularMonto(elegidos.length, formaPago.value);
    const detalle = `<p>Cuotas: ${elegidos.map(nombrePeriodoCorto).join(", ")}</p>
                     <p>Cantidad: ${elegidos.length} (${nombrePlan(elegidos.length)})</p>
                     <p>Total: ${formatearMonto(monto)} en ${formaPago.value}</p>`;
    confirmar(`Confirmar pago de ${socio.nombre}`, detalle, "Confirmar pago", "question").then(({ isConfirmed }) => {
        if (!isConfirmed) return;
        if (socio.pagar(elegidos, formaPago.value) === 0) {
            mostrarMensaje("No se pudo registrar el pago: alguna de las cuotas ya estaba pagada", true);
        } else {
            guardarSocios(socios);
            const texto = `${socio.nombre} pagó ${plural(elegidos.length, "cuota")} (${formatearMonto(monto)}) en ${formaPago.value}.`;
            Swal.fire({ title: "Pago registrado", text: texto, icon: "success", confirmButtonColor: "#154" });
        }
        actualizarVistas();
    });
});

selectSocio.addEventListener("change", () => {
    dniPagos = selectSocio.value;
    mostrarPlan();
});

//Historial individual de un socio
const socioEnHistorial = () => socios.find(socio => socio.dni === dniHistorial);

const mostrarHistorial = () => {
    const socio = socioEnHistorial();
    historialSocio.hidden = !socio;
    document.querySelector(".historial-vacio").hidden = Boolean(socio);
    if (!socio) return;

    const actual = obtenerPeriodoActual();
    const filas = [];
    let anioAnterior = "";
    for (const periodo of rangoPeriodos(socio.alta, mayorPeriodo(socio.ultimoPeriodoPagado(), actual))) {
        const anio = periodo.slice(0, 4);
        if (anio !== anioAnterior) {
            filas.push(`<tr class="fila-anio"><th colspan="4">${anio}</th></tr>`);
            anioAnterior = anio;
        }
        const pago = socio.buscarPago(periodo);
        let estado = "Pendiente";
        let clase = "celda-sin-alta";
        if (socio.periodosPagados.includes(periodo)) {
            estado = periodo > actual ? "Adelantado" : "Pagado";
            clase = "celda-pagada";
        } else if (periodo <= actual) {
            estado = "Adeudado";
            clase = "celda-adeudada";
        }
        filas.push(`
            <tr>
                <th>${nombrePeriodo(periodo)}</th><td class="${clase}">${estado}</td><td>${pago?.fecha ?? "-"}</td>
                <td>${pago ? formatearMonto(Math.round(pago.monto / pago.periodos.length)) : "-"}</td>
            </tr>`);
    }
    historialSocio.querySelector(".ficha-socio").innerHTML = `
        <h3>${socio.nombre} ${socio.apellido}</h3>
        <p>DNI ${socio.dni} - Inscripción: ${socio.fechaInscripcion} - Estado: ${estadoSocio(socio)}</p>`;
    historialSocio.querySelector(".tabla-meses").innerHTML = armarTabla(["Mes", "Estado", "Fecha de pago", "Importe"], filas);
};

historialSocio.querySelector(".historial-pagar").addEventListener("click", () => irAPagos(dniHistorial, false));

selectHistorial.addEventListener("change", () => {
    dniHistorial = selectHistorial.value;
    mostrarHistorial();
});

//Registro de los últimos 12 meses de todos los socios
const mostrarRegistro = () => {
    const actual = obtenerPeriodoActual();
    const periodos = rangoPeriodos(sumarMeses(actual, -11), actual);
    const filtro = filtroRegistro.value;
    const lista = socios.filter(socio => filtro === "todos" || (filtro === "deuda" ? !socio.estaAlDia() : socio.estaAlDia()));
    document.querySelector(".tabla-registro").innerHTML = lista.length === 0 ? vacio("No hay socios para mostrar") : armarTabla(
        ["Socio", ...periodos.map(nombrePeriodoCorto), "Deuda"],
        lista.map(socio => {
            const celdas = periodos.map(periodo => {
                if (periodo < socio.alta) return `<td class="celda-sin-alta">-</td>`;
                return socio.periodosPagados.includes(periodo) ? `<td class="celda-pagada">✔</td>` : `<td class="celda-adeudada">✘</td>`;
            }).join("");
            return `<tr><th>${socio.apellido}, ${socio.nombre}</th>${celdas}<td>${socio.deudas().length}</td></tr>`;
        })
    );
    mostrarPagosGenerales();
};

filtroRegistro.addEventListener("change", mostrarRegistro);

//Registro general de pagos: todos los socios o uno solo
const mostrarPagosGenerales = () => {
    const lista = socios.filter(socio => filtroSocio.value === "" || socio.dni === filtroSocio.value);
    const pagos = lista.flatMap(socio => [...socio.historialPagos].reverse().map(pago => ({ ...pago, socio: `${socio.nombre} ${socio.apellido}` })));
    document.querySelector(".tabla-pagos").innerHTML = armarTablaPagos(ordenarPorFecha(pagos));
};

filtroSocio.addEventListener("change", mostrarPagosGenerales);

//Actualizar todas las vistas
const actualizarVistas = () => {
    actualizarResumen();
    buscarSocios();
    mostrarEstados();
    mostrarSelect();
    mostrarPlan();
    mostrarHistorial();
    mostrarRegistro();
};

//Errores del formulario
const mostrarError = (input, texto) => {
    input.classList.toggle("invalido", texto !== "");
    input.nextElementSibling.textContent = texto;
};

const limpiarErrores = () => inputs.forEach(input => mostrarError(input, ""));
inputs.forEach(input => input.addEventListener("input", () => mostrarError(input, "")));

const validarTexto = (valor, etiqueta) => {
    if (valor === "") return `El ${etiqueta} no puede estar vacío`;
    if (!/^[a-záéíóúñü ]+$/i.test(valor)) return `El ${etiqueta} solo puede tener letras y espacios`;
    if (valor.length < 2) return `El ${etiqueta} debe tener al menos 2 letras`;
    return "";
};

const validarDni = (dni) => {
    if (dni === "") return "El DNI no puede estar vacío";
    if (!/^\d+$/.test(dni)) return "El DNI debe contener un número válido, sin puntos, letras ni espacios";
    if (dni.length !== 8) return `El DNI debe tener 8 números y vos ingresaste ${dni.length}`;
    return "";
};

const validarMail = (mail) => {
    if (mail === "") return "El correo electrónico no puede estar vacío";
    if (!mail.includes("@")) return "Al correo electrónico le falta el @";
    if (!/^\S+@\S+\.\S+$/.test(mail)) return "El correo electrónico tiene un formato incorrecto, por ejemplo: nombre@dominio.com";
    return "";
};

//Edición del formulario
const iniciarEdicion = (socio) => {
    dniEditando = socio.dni;
    [socio.nombre, socio.apellido, socio.dni, socio.mail].forEach((valor, i) => inputs[i].value = valor);
    limpiarErrores();
    formulario.classList.add("editando");
    tituloFormulario.textContent = `Editar socio: ${socio.nombre} ${socio.apellido}`;
    botonAgregar.textContent = "Guardar cambios";
    document.querySelector("#asociate").scrollIntoView();
};

const salirEdicion = () => {
    dniEditando = null;
    formulario.reset();
    limpiarErrores();
    formulario.classList.remove("editando");
    tituloFormulario.textContent = "Asociate";
    botonAgregar.textContent = "Agregar socio";
};

document.querySelector(".btn-cancelar").addEventListener("click", () => {
    salirEdicion();
    mostrarMensaje("Edición cancelada");
});

//Agregar o editar socio
botonAgregar.addEventListener("click", () => {
    const [nombre, apellido, dni, mailIngresado] = inputs.map(input => input.value.trim());
    const mail = mailIngresado.toLowerCase();
    const socioEditado = socios.find(socio => socio.dni === dniEditando);
    const repetido = (campo, valor) => socios.some(socio => socio !== socioEditado && socio[campo] === valor);
    const errores = [
        { input: inputNombre, etiqueta: "Nombre", texto: validarTexto(nombre, "nombre") },
        { input: inputApellido, etiqueta: "Apellido", texto: validarTexto(apellido, "apellido") },
        { input: inputDni, etiqueta: "DNI", texto: validarDni(dni) || (repetido("dni", dni) ? "El socio ya se encuentra registrado con ese DNI" : "") },
        { input: inputMail, etiqueta: "Mail", texto: validarMail(mail) || (repetido("mail", mail) ? "Ya existe un socio con ese correo electrónico" : "") }
    ];
    errores.forEach(({ input, texto }) => mostrarError(input, texto));
    const conError = errores.filter(({ texto }) => texto !== "").map(({ etiqueta }) => etiqueta);
    if (conError.length > 0) {
        mostrarMensaje(`Revisá estos campos: ${conError.join(", ")}`, true);
        return;
    }

//Al editar se modifican los datos del mismo socio, su historial de pagos no se toca
    if (socioEditado) {
        Object.assign(socioEditado, { nombre, apellido, dni, mail });
        if (dniPagos === dniEditando) dniPagos = dni;
        if (dniHistorial === dniEditando) dniHistorial = dni;
        salirEdicion();
        mostrarMensaje(`Datos de ${nombre} actualizados, su historial de pagos se mantiene`);
    } else {
        socios.push(new Socio(nombre, apellido, dni, mail, 50000, obtenerPeriodoActual(), obtenerFechaActual()));
        formulario.reset();
        mostrarMensaje(`Socio ${nombre} ${apellido} agregado`);
    }
    guardarSocios(socios);
    actualizarVistas();
});

//Buscador
const buscarSocios = () => {
    const texto = buscador.value.toLowerCase().trim();
    mostrarSocios(socios.filter(({ nombre, apellido, dni }) => `${nombre} ${apellido}`.toLowerCase().includes(texto) || dni.includes(texto)));
};

buscador.addEventListener("input", buscarSocios);

//Traer datos desde db
const urlSocios = "./db/data.json";
const mensajeCarga = document.querySelector(".mensaje");
const esperar = (milisegundos) => new Promise(resolve => setTimeout(resolve, milisegundos));

const traerSociosDelJson = async () => {
    const response = await fetch(urlSocios);
    if (!response.ok) throw new Error("No se encontró el archivo");
    return response.json();
};

async function obtenerSocios() {
    mensajeCarga.textContent = "Cargando socios...";
    mensajeCarga.style.display = "block";
    try {
        await esperar(500);
        const datos = cargarSociosGuardados() || await traerSociosDelJson();
        socios.push(...datos.map(reconstruirSocio));
        actualizarVistas();
    } catch (err) {
        mostrarMensaje("No se pudieron cargar los socios", true);
    } finally {
        mensajeCarga.style.display = "none";
    }
}

//Mostrar recordatorio de cuotas adeudadas
const mostrarRecordatorio = () => {
    const conDeuda = socios.filter(socio => !socio.estaAlDia()).length;
    if (conDeuda > 0) mostrarMensaje(`Recordatorio: hay ${plural(conDeuda, "socio")} con cuotas adeudadas`);
};

obtenerSocios().then(() => setTimeout(mostrarRecordatorio, 1000));

//Restablecer datos
document.querySelector(".btn-restablecer").addEventListener("click", () => {
    confirmar("¿Restablecer datos?", "Se borrarán los cambios y se cargarán los socios originales.", "Sí, restablecer")
        .then(async ({ isConfirmed }) => {
            if (!isConfirmed) return;
            vaciarStorage();
            socios.length = 0;
            buscador.value = "";
            dniPagos = "";
            dniHistorial = "";
            salirEdicion();
            await obtenerSocios();
            mostrarMensaje("Socios restablecidos");
        });
});