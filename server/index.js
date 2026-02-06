const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'tec_user',
    password: process.env.DB_PASSWORD || 'tec_password',
    database: process.env.DB_NAME || 'sistema_reservas_tec',
    port: process.env.DB_PORT || 3306 
};

// GET: Obtener reservas (Incluyendo responsable y requerimientos)
app.get('/api/reservas', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(`
            SELECT r.*, s.nombre as nombre_sala 
            FROM reservaciones r
            JOIN salas s ON r.sala_id = s.id
            WHERE r.estado = 'confirmada'
        `);
        await connection.end();
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error BD' });
    }
});

// POST: Guardar reserva (Con responsable)
app.post('/api/reservas', async (req, res) => {
    const { sala_id, titulo, responsable, inicio, fin, requerimientos } = req.body;
    
    if (!sala_id || !titulo || !responsable || !inicio || !fin) {
        return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    try {
        const connection = await mysql.createConnection(dbConfig);

        // Validar Choques
        const [existentes] = await connection.execute(`
            SELECT * FROM reservaciones 
            WHERE sala_id = ? AND estado = 'confirmada'
            AND ((fecha_inicio < ? AND fecha_fin > ?))
        `, [sala_id, fin, inicio]);

        if (existentes.length > 0) {
            await connection.end();
            return res.status(409).json({ error: '¡Horario ocupado!' });
        }

        // Insertar con Responsable
        await connection.execute(`
            INSERT INTO reservaciones (sala_id, titulo_evento, responsable, fecha_inicio, fecha_fin, requerimientos_fisicos, estado)
            VALUES (?, ?, ?, ?, ?, ?, 'confirmada')
        `, [sala_id, titulo, responsable, inicio, fin, requerimientos || '']);

        await connection.end();
        res.status(201).json({ message: 'Guardado' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server en puerto ${PORT}`));