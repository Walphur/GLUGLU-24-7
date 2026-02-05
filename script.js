// --- CONSTANTES SVG ---
const ICONS = {
    PLAY: `<svg class="icon-btn" style="fill:#051937" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
    PAUSE: `<svg class="icon-large" style="fill:#ffeb3b" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
    STOP_HAND: `<svg class="icon-large" style="fill:#ff4d4d" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
    TRASH: `<svg class="icon-btn" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`
};

// --- ESTADO ---
let cargaSeleccionada = { litros: 0, precio: 0 };
let litrosCargados = 0;
let loopCarga;
let sensorBidonDetectado = true; 

// --- NAVEGACIÓN SEGURA ---
function mostrarPantalla(idPantalla) {
    document.querySelectorAll('.vista').forEach(el => el.classList.add('oculto'));
    document.getElementById(idPantalla).classList.remove('oculto');
}

// --- 1. SELECCIÓN Y PAGO ---
function seleccionar(litros, precio) {
    cargaSeleccionada = { litros, precio };
    document.getElementById('detalle-pago').innerHTML = `<b>${litros} Litros</b> <br> Total: $${precio}`;
    mostrarPantalla('pantalla-pago');
    iniciarPagoReal(litros, precio);
}

async function iniciarPagoReal(litros, precio) {
    const qrImage = document.getElementById('qr-image');
    const msgPago = document.getElementById('msg-pago');

    qrImage.style.opacity = '0.3';
    msgPago.innerText = "Conectando con Mercado Pago...";
    msgPago.classList.remove('blink');

    await new Promise(resolve => setTimeout(resolve, 1500)); 

    qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=0f203e&data=MP_ORDEN_${Math.floor(Math.random()*99999)}`;
    qrImage.style.opacity = '1';
    msgPago.innerText = "¡Escanee el QR para pagar!";

    console.log("[BACKEND] Esperando webhook...");
    setTimeout(() => {
        msgPago.innerText = "¡Pago Aprobado!";
        msgPago.classList.add('blink');
        setTimeout(procesarPostPago, 1500);
    }, 4000); 
}

function procesarPostPago() {
    if (cargaSeleccionada.litros >= 10) {
        configurarPantallaLavado();
        mostrarPantalla('pantalla-lavado');
    } else {
        irALlenado(false);
    }
}

// --- 2. LAVADO ---
function configurarPantallaLavado() {
    document.getElementById('titulo-lavado').innerText = "¿Desea enjuagar el bidón?";
    document.getElementById('botones-lavado').classList.remove('oculto');
}

function ejecutarEnjuague() {
    if (!sensorBidonDetectado) {
        mostrarAlerta("No se detecta el bidón. Colóquelo boca abajo.", "Error Sensor");
        return;
    }
    document.getElementById('titulo-lavado').innerText = "Enjuagando...";
    document.getElementById('botones-lavado').classList.add('oculto');
    setTimeout(() => { mostrarConfirmacionParaLlenar(); }, 3000);
}

function mostrarConfirmacionParaLlenar() {
    document.getElementById('titulo-lavado').innerText = "¡Enjuague listo!";
    const btns = document.getElementById('botones-lavado');
    btns.innerHTML = `
        <button onclick="irALlenado(false)" class="btn-destacado btn-row-flex" style="grid-column: span 2; width:100%;">
            ${ICONS.PLAY} INICIAR CARGA
        </button>`;
    btns.classList.remove('oculto');
}

// --- 3. LLENADO ---
function irALlenado(esReanudacion) {
    if (!esReanudacion) litrosCargados = 0;
    mostrarPantalla('pantalla-llenado');
    document.getElementById('txt-llenando').innerText = esReanudacion ? "Reanudando..." : "Cargando Agua Pura...";
    iniciarLoopDeCarga();
}

function iniciarLoopDeCarga() {
    clearInterval(loopCarga);
    loopCarga = setInterval(() => {
        if (litrosCargados < cargaSeleccionada.litros) {
            litrosCargados += 0.05;
            actualizarBarra();
        } else {
            finalizar(true);
        }
    }, 50);
}

function pausarCarga(esEmergencia) {
    clearInterval(loopCarga);
    const icono = esEmergencia ? ICONS.STOP_HAND : ICONS.PAUSE;
    const titulo = esEmergencia ? "PARADA DE EMERGENCIA" : "PAUSADO";
    const color = esEmergencia ? "#ff4d4d" : "#ffeb3b";

    const divError = document.getElementById('pantalla-error');
    divError.innerHTML = `
        ${icono}
        <h2 style="color:${color}">${titulo}</h2>
        <p style="margin-bottom:20px">Llevas cargados: <b>${litrosCargados.toFixed(2)} L</b>.<br>Acomoda el bidón y continúa.</p>
        
        <div class="grid-botones" style="display:flex; flex-direction:column; gap:15px; width:100%;">
            <button onclick="irALlenado(true)" class="btn-destacado btn-row-flex" style="width:100%">
                ${ICONS.PLAY} CONTINUAR
            </button>
            <button onclick="cancelarDefinitivo()" class="btn-danger btn-row-flex">
                ${ICONS.TRASH} Finalizar
            </button>
        </div>
    `;
    mostrarPantalla('pantalla-error');
}

// --- 4. FINALIZAR / CANCELAR ---
function finalizar(esExito) {
    clearInterval(loopCarga);
    if (esExito) {
        mostrarAlerta("Carga completada exitosamente.", "¡Listo!");
        setTimeout(() => location.reload(), 3000);
    }
}

function cancelarDefinitivo() {
    let saldo = cargaSeleccionada.litros - litrosCargados;
    let codigo = `REF-${Math.floor(Math.random()*9000)+1000}`;
    
    let htmlCodigo = `<div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:10px; margin-top:15px; font-family:monospace; font-size:1.4rem; letter-spacing:2px; border: 2px dashed var(--highlight-green);">${codigo}</div>`;
    
    mostrarAlerta(`
        Operación cancelada.<br>Saldo pendiente: ${saldo.toFixed(2)}L.<br>${htmlCodigo}<br>
        <button onclick="location.reload()" class="btn-alert-ok" style="background:white; color:#051937; margin-top:15px">🔄 Reiniciar Ahora</button>
    `, "Finalizado");
    
    setTimeout(() => location.reload(), 8000);
}

function cancelar() {
    mostrarPantalla('pantalla-principal');
}

function actualizarBarra() {
    const p = (litrosCargados / cargaSeleccionada.litros) * 100;
    document.getElementById('barra-progreso').style.width = `${p}%`;
    document.getElementById('litros-contador').innerText = `${litrosCargados.toFixed(2)} / ${cargaSeleccionada.litros.toFixed(2)} L`;
}

// --- ADMIN & ALERTAS ---
let tapC = 0, tapT;
function checkSecretMenu() {
    tapC++; clearTimeout(tapT);
    tapT = setTimeout(() => tapC=0, 1000);
    if(tapC >= 5) { mostrarPantalla('admin-panel'); tapC=0; }
}

function verificarAdmin() {
    if(document.getElementById('admin-pass').value === '1234') {
        document.getElementById('admin-login-view').classList.add('oculto');
        document.getElementById('admin-dashboard-view').classList.remove('oculto');
    } else {
        const err = document.getElementById('admin-error');
        err.innerText = "Contraseña incorrecta";
        setTimeout(() => err.innerText = "", 2000);
    }
}
function cerrarAdmin() { mostrarPantalla('pantalla-principal'); }
function cerrarAlerta() { document.getElementById('custom-alert-overlay').classList.add('oculto'); }

function mostrarAlerta(msg, titulo) {
    document.getElementById('alert-title').innerText = titulo || "Información";
    document.getElementById('alert-msg').innerHTML = msg;
    
    const footerBtn = document.querySelector('.alert-footer .btn-alert-ok');
    if (msg.includes('<button')) {
        footerBtn.style.display = 'none';
    } else {
        footerBtn.style.display = 'block';
    }
    
    document.getElementById('custom-alert-overlay').classList.remove('oculto');
}

function accionAdmin(t) { mostrarAlerta("Acción simulada: " + t, "Admin"); }