const express = require('express');
const path = require('path');
const app = express();

// Render nos asigna un puerto automáticamente, o usamos el 3000 localmente
const port = process.env.PORT || 3000;

// Le decimos a Express que sirva todos los archivos de esta carpeta (CSS, JS, IMGs)
app.use(express.static(path.join(__dirname, '/')));

// Cuando alguien entre a la web, le mandamos el index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Arrancar el servidor
app.listen(port, () => {
    console.log(`🟢 Servidor GluGlu corriendo en http://localhost:${port}`);
});