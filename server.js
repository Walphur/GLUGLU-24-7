const express = require('express');
const { MercadoPagoConfig, Preference } = require('mercadopago');
const path = require('path');
const app = express();

// --- CONFIGURACIÓN ---
// Tu Access Token REAL configurado
const client = new MercadoPagoConfig({ 
    accessToken: 'APP_USR-43f693a3-c4f2-44b3-a0e9-14a775d88eb9' 
});

const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '/')));
app.use(express.json());

// 1. CREAR PREFERENCIA (Generar el Link de Pago)
app.post('/create_preference', async (req, res) => {
    try {
        const body = {
            items: [
                {
                    title: `Carga de Agua - ${req.body.litros} Litros`,
                    quantity: 1,
                    unit_price: Number(req.body.precio),
                    currency_id: 'ARS',
                }
            ],
            back_urls: {
                success: "https://www.google.com",
                failure: "https://www.google.com",
                pending: "https://www.google.com"
            },
            auto_return: "approved",
        };

        const preference = new Preference(client);
        const result = await preference.create({ body });

        res.json({ 
            id: result.id, 
            init_point: result.init_point 
        });

    } catch (error) {
        console.error("Error al crear preferencia:", error);
        res.status(500).send("Error al crear preferencia");
    }
});

// 2. CONSULTAR ESTADO (Simulado para MVP)
app.get('/order_status/:prefId', async (req, res) => {
    // Aquí luego conectaremos con los Webhooks reales
    res.json({ status: 'pending' }); 
});

// Servir el Frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`🟢 Servidor GluGlu corriendo en puerto ${port}`);
});