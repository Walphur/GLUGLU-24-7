//'APP_USR-6368961490000082-020819-5e91308583a50f068b9c249f7ca349a4-3189205482' 
const express = require('express');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const path = require('path');
const app = express();

// --- CONFIGURACIÓN ---
// Tu Token REAL o de PRUEBA (el que estés usando)
const client = new MercadoPagoConfig({ 
    accessToken: 'APP_USR-6368961490000082-020819-5e91308583a50f068b9c249f7ca349a4-3189205482' 
});

const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '/')));
app.use(express.json());

// MEMORIA
let orders = {};           // Historial de pagos
let colaDeCarga = null;    // El "Buzón" para el ESP32 (Guarda la última carga pendiente)

// 1. CREAR PREFERENCIA
app.post('/create_preference', async (req, res) => {
    try {
        const orderId = 'ORD-' + Date.now();
        orders[orderId] = 'pending';

        const body = {
            items: [{
                title: `Carga de Agua - ${req.body.litros} Litros`,
                quantity: 1,
                unit_price: Number(req.body.precio),
                currency_id: 'ARS',
            }],
            external_reference: orderId,
            back_urls: {
                success: "https://www.google.com",
                failure: "https://www.google.com",
                pending: "https://www.google.com"
            },
            auto_return: "approved",
            notification_url: `https://${req.get('host')}/webhook`
        };

        const preference = new Preference(client);
        const result = await preference.create({ body });

        res.json({ id: result.id, init_point: result.init_point, orderId: orderId });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error");
    }
});

// 2. WEBHOOK MP
app.post('/webhook', async (req, res) => {
    const paymentId = req.query['data.id'] || req.query.id;
    const type = req.query.type;

    if (type === 'payment' && paymentId) {
        try {
            const payment = new Payment(client);
            const pay = await payment.get({ id: paymentId });
            
            if (pay.status === 'approved') {
                const orderRef = pay.external_reference;
                if (orderRef && orders[orderRef]) {
                    orders[orderRef] = 'approved';
                    console.log(`✅ PAGO CONFIRMADO: ${orderRef}`);
                }
            }
        } catch (error) { console.error(error); }
    }
    res.sendStatus(200);
});

// 3. CONSULTAR ESTADO (Frontend)
app.get('/order_status/:orderId', (req, res) => {
    const status = orders[req.params.orderId] || 'pending';
    res.json({ status: status });
});

// --- NUEVO: PUENTE CON ESP32 ---

// A. El Frontend avisa: "Ya pagaron, activá la máquina"
app.post('/activar_maquina', (req, res) => {
    const { litros } = req.body;
    console.log(`🔌 ACTIVANDO MÁQUINA POR: ${litros} Litros`);
    
    // Ponemos el mensaje en el buzón para el ESP32
    colaDeCarga = { 
        activo: true, 
        litros: Number(litros),
        timestamp: Date.now()
    };
    
    res.json({ success: true });
});

// B. El ESP32 pregunta: "¿Tengo que trabajar?"
app.get('/check_maquina', (req, res) => {
    if (colaDeCarga && colaDeCarga.activo) {
        // Le damos la orden al ESP32
        res.json({ disp: true, l: colaDeCarga.litros });
        
        // Vaciamos el buzón para no cargar dos veces lo mismo
        // (Ojo: en un sistema más complejo, esperamos confirmación del ESP32 antes de borrar)
        colaDeCarga = null; 
    } else {
        res.json({ disp: false });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`🟢 Servidor corriendo en puerto ${port}`);
});