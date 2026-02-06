// server/index.js
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

// --- AUTENTICACIÓN ---
app.post('/api/register', async (req, res) => {
    const { nombre, email, password } = req.body;
    if (!email.endsWith('@tecmilenio.mx') && email !== 'admin@tec.mx') {
        return res.status(403).json({ error: 'Acceso denegado: Se requiere correo institucional (@tecmilenio.mx)' });
    }
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [existentes] = await connection.execute('SELECT * FROM usuarios WHERE email = ?', [email]);
        if (existentes.length > 0) {
            await connection.end();
            return res.status(400).json({ error: 'Este correo ya está registrado' });
        }
        await connection.execute('INSERT INTO usuarios (nombre_completo, email, password) VALUES (?, ?, ?)', [nombre, email, password]);
        await connection.end();
        res.status(201).json({ message: 'Cuenta activada' });
    } catch (error) { res.status(500).json({ error: 'Error al registrar' }); }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute('SELECT id, nombre_completo, email FROM usuarios WHERE email = ? AND password = ?', [email, password]);
        await connection.end();
        if (rows.length > 0) res.json(rows[0]);
        else res.status(401).json({ error: 'Credenciales incorrectas' });
    } catch (error) { res.status(500).json({ error: 'Error de servidor' }); }
});

// --- RESERVAS ---

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
    } catch (error) { res.status(500).json({ error: 'Error BD' }); }
});

app.post('/api/reservas', async (req, res) => {
    const { sala_id, titulo, responsable, inicio, fin, requerimientos } = req.body;
    if (!sala_id || !titulo || !responsable || !inicio || !fin) return res.status(400).json({ error: 'Faltan datos' });

    try {
        const connection = await mysql.createConnection(dbConfig);
        const [existentes] = await connection.execute(`
            SELECT * FROM reservaciones WHERE sala_id = ? AND estado = 'confirmada'
            AND ((fecha_inicio < ? AND fecha_fin > ?))
        `, [sala_id, fin, inicio]);

        if (existentes.length > 0) {
            await connection.end();
            return res.status(409).json({ error: '¡El horario ya está ocupado!' });
        }
        await connection.execute(`
            INSERT INTO reservaciones (sala_id, titulo_evento, responsable, fecha_inicio, fecha_fin, requerimientos_fisicos, estado)
            VALUES (?, ?, ?, ?, ?, ?, 'confirmada')
        `, [sala_id, titulo, responsable, inicio, fin, requerimientos || '']);
        await connection.end();
        res.status(201).json({ message: 'Guardado' });
    } catch (error) { res.status(500).json({ error: 'Error interno' }); }
});

// --- NUEVO: EDITAR RESERVA (PUT) ---
app.put('/api/reservas/:id', async (req, res) => {
    const { id } = req.params;
    const { sala_id, titulo, inicio, fin, requerimientos } = req.body;

    try {
        const connection = await mysql.createConnection(dbConfig);
        
        // Validar choque (EXCLUYENDO la reserva actual con "AND id != ?")
        // Esto permite editar tu propio evento sin que el sistema diga "ya existe uno ahí" (que eres tú mismo)
        const [existentes] = await connection.execute(`
            SELECT * FROM reservaciones WHERE sala_id = ? AND estado = 'confirmada' AND id != ?
            AND ((fecha_inicio < ? AND fecha_fin > ?))
        `, [sala_id, id, fin, inicio]);

        if (existentes.length > 0) {
            await connection.end();
            return res.status(409).json({ error: '¡El nuevo horario choca con otro evento!' });
        }

        await connection.execute(`
            UPDATE reservaciones 
            SET sala_id = ?, titulo_evento = ?, fecha_inicio = ?, fecha_fin = ?, requerimientos_fisicos = ?
            WHERE id = ?
        `, [sala_id, titulo, inicio, fin, requerimientos, id]);

        await connection.end();
        res.json({ message: 'Actualizado correctamente' });
    } catch (error) { console.error(error); res.status(500).json({ error: 'Error al actualizar' }); }
});

// --- NUEVO: ELIMINAR RESERVA (DELETE) ---
app.delete('/api/reservas/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const connection = await mysql.createConnection(dbConfig);
        await connection.execute('DELETE FROM reservaciones WHERE id = ?', [id]);
        await connection.end();
        res.json({ message: 'Eliminado correctamente' });
    } catch (error) { console.error(error); res.status(500).json({ error: 'Error al eliminar' }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT} 🚀`));