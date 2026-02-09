const express = require('express');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const path = require('path');
const app = express();

// --- CONFIGURACIÓN ---
// Tu Token de PRUEBA (El que empieza con TEST-)
const client = new MercadoPagoConfig({ 
    accessToken: 'APP_USR-6368961490000082-020819-5e91308583a50f068b9c249f7ca349a4-3189205482' 
});

const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '/')));
app.use(express.json());

// MEMORIA TEMPORAL (Aquí guardamos si ya pagaron)
// En un sistema real, esto iría a una base de datos.
let orders = {}; 

// 1. CREAR PREFERENCIA
app.post('/create_preference', async (req, res) => {
    try {
        // Generamos un ID único para esta orden
        const orderId = 'ORD-' + Date.now();
        orders[orderId] = 'pending'; // La marcamos como pendiente

        const body = {
            items: [
                {
                    title: `Carga de Agua - ${req.body.litros} Litros`,
                    quantity: 1,
                    unit_price: Number(req.body.precio),
                    currency_id: 'ARS',
                }
            ],
            // Usamos external_reference para rastrear el pago
            external_reference: orderId,
            back_urls: {
                success: "https://www.google.com",
                failure: "https://www.google.com",
                pending: "https://www.google.com"
            },
            auto_return: "approved",
            // IMPORTANTE: URL para que MP nos avise (Webhook)
            notification_url: `https://${req.get('host')}/webhook`
        };

        const preference = new Preference(client);
        const result = await preference.create({ body });

        res.json({ 
            id: result.id, 
            init_point: result.init_point,
            orderId: orderId // Le mandamos este ID al frontend para que pregunte
        });

    } catch (error) {
        console.error("Error preference:", error);
        res.status(500).send("Error");
    }
});

// 2. WEBHOOK (Donde MP nos avisa que pagaron)
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
                    orders[orderRef] = 'approved'; // ¡MARCAMOS COMO PAGADO!
                    console.log(`✅ Pago confirmado para orden: ${orderRef}`);
                }
            }
        } catch (error) {
            console.error("Error webhook:", error);
        }
    }
    res.sendStatus(200);
});

// 3. CONSULTAR ESTADO (El Frontend pregunta aquí)
app.get('/order_status/:orderId', (req, res) => {
    const status = orders[req.params.orderId] || 'pending';
    res.json({ status: status });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`🟢 Servidor corriendo en puerto ${port}`);
});