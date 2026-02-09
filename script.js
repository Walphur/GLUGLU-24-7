// --- CONSTANTES ---
const TIEMPO_ESPERA_PAGO = 180; // 3 minutos en segundos para pagar
const TIEMPO_INACTIVIDAD = 60;  // 1 minuto en menú principal para volver al screensaver
const ICONS = {
    PLAY: `<svg class="icon-btn" style="fill:#051937" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
    PAUSE: `<svg class="icon-large" style="fill:#ffeb3b" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
    STOP_HAND: `<svg class="icon-large" style="fill:#ff4d4d" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
    TRASH: `<svg class="icon-btn" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`,
};

// --- ESTADO ---
let cargaSeleccionada = { litros: 0, precio: 0 };
let litrosCargados = 0;
let loopCarga;
let intervaloChequeo; // Para el pago
let timerCuentaRegresiva; // Para el reloj visual de 3 min
let timerInactividad; // Para volver al screensaver

// --- SCREENSAVER Y GESTIÓN DE PANTALLAS ---
function despertarApp() {
    document.getElementById('screensaver').classList.add('oculto');
    resetTimerInactividad(); // Arranca el contador de inactividad
}

function mostrarPantalla(idPantalla) {
    document.querySelectorAll('.vista').forEach(el => el.classList.add('oculto'));
    document.getElementById(idPantalla).classList.remove('oculto');
    
    // Si estamos en el menú principal, activamos el timer para volver al screensaver
    if (idPantalla === 'pantalla-principal') {
        resetTimerInactividad();
    } else {
        // Si estamos pagando o cargando, desactivamos el screensaver automático
        clearTimeout(timerInactividad);
    }
}

function resetTimerInactividad() {
    clearTimeout(timerInactividad);
    timerInactividad = setTimeout(() => {
        // Si nadie toca nada por X tiempo, vuelve el screensaver
        document.getElementById('screensaver').classList.remove('oculto');
        mostrarPantalla('pantalla-principal'); // Reseteamos vistas por debajo
    }, TIEMPO_INACTIVIDAD * 1000);
}

// Detectar toques para resetear inactividad (solo si no está el screensaver)
document.addEventListener('click', () => {
    if (document.getElementById('screensaver').classList.contains('oculto')) {
        // Solo reseteamos si estamos en menú principal (para no interrumpir pagos o cargas)
        if(!document.getElementById('pantalla-principal').classList.contains('oculto')) {
            resetTimerInactividad();
        }
    }
});


// --- SELECCIÓN Y PAGO ---
function seleccionar(litros, precio) {
    cargaSeleccionada = { litros, precio };
    document.getElementById('detalle-pago').innerHTML = `<b>${litros} Litros</b> <br> Total: $${precio}`;
    mostrarPantalla('pantalla-pago');
    iniciarPagoReal(litros, precio);
}

async function iniciarPagoReal(litros, precio) {
    const qrImage = document.getElementById('qr-image');
    const msgPago = document.getElementById('msg-pago');
    const timerDisplay = document.getElementById('timer-cuenta-regresiva');

    qrImage.style.opacity = '0.3';
    msgPago.innerText = "Conectando con Mercado Pago...";
    msgPago.classList.remove('blink');
    
    // INICIAR CUENTA REGRESIVA VISUAL
    let segundosRestantes = TIEMPO_ESPERA_PAGO;
    clearInterval(timerCuentaRegresiva);
    
    timerCuentaRegresiva = setInterval(() => {
        segundosRestantes--;
        let min = Math.floor(segundosRestantes / 60);
        let sec = segundosRestantes % 60;
        timerDisplay.innerText = `${min < 10 ? '0'+min : min}:${sec < 10 ? '0'+sec : sec}`;
        
        if (segundosRestantes <= 0) {
            cancelar(); // SE ACABÓ EL TIEMPO
        }
    }, 1000);

    try {
        const response = await fetch('/create_preference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ litros, precio })
        });
        const data = await response.json();
        
        qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=0f203e&data=${encodeURIComponent(data.init_point)}`;
        
        qrImage.onload = () => {
            qrImage.style.opacity = '1';
            msgPago.innerText = "¡Escanee el QR para pagar!";
            
            if (intervaloChequeo) clearInterval(intervaloChequeo);
            
            intervaloChequeo = setInterval(async () => {
                try {
                    const resEstado = await fetch(`/order_status/${data.orderId}`);
                    const jsonEstado = await resEstado.json();

                    if (jsonEstado.status === 'approved') {
                        clearInterval(intervaloChequeo);
                        clearInterval(timerCuentaRegresiva); // Paramos el reloj
                        
                        msgPago.innerText = "¡Pago Aprobado!";
                        msgPago.style.color = "#1effa5";
                        msgPago.classList.add('blink');
                        timerDisplay.innerText = ""; 
                        
                        setTimeout(procesarPostPago, 1500); 
                    }
                } catch (err) { console.error(err); }
            }, 3000);
        };
    } catch (e) {
        console.error(e);
        msgPago.innerText = "Error de conexión";
    }
}

function cancelar() {
    clearInterval(intervaloChequeo);
    clearInterval(timerCuentaRegresiva);
    mostrarPantalla('pantalla-principal');
    // Forzamos inactividad rápida para que si se fue el cliente, aparezca el screensaver pronto
    resetTimerInactividad(); 
}

// ... (Resto de funciones: procesarPostPago, lavado, llenado, admin, etc. IGUAL QUE ANTES) ...

function procesarPostPago() {
    if (cargaSeleccionada.litros >= 10) {
        configurarPantallaLavado();
        mostrarPantalla('pantalla-lavado');
    } else {
        irALlenado(false);
    }
}

function configurarPantallaLavado() {
    document.getElementById('titulo-lavado').innerText = "¿Desea enjuagar el bidón?";
    document.getElementById('botones-lavado').classList.remove('oculto');
}

function ejecutarEnjuague() {
    // Simulamos sensor siempre true por ahora
    let sensorBidonDetectado = true; 
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

function finalizar(esExito) {
    clearInterval(loopCarga);
    if (esExito) {
        mostrarAlerta("Carga completada exitosamente.", "¡Listo!");
        setTimeout(() => location.reload(), 3000);
    }
}

function cancelarDefinitivo() {
    let saldo = cargaSeleccionada.litros - litrosCargados;
    mostrarAlerta(`Operación cancelada.<br>Saldo pendiente: ${saldo.toFixed(2)}L.`, "Finalizado");
    setTimeout(() => location.reload(), 5000);
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
    document.getElementById('custom-alert-overlay').classList.remove('oculto');
}

function accionAdmin(t) { mostrarAlerta("Acción simulada: " + t, "Admin"); }