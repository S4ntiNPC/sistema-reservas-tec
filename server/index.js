// server/index.js
const dns = require('dns');
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const nodemailer = require('nodemailer');

require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.log(`📥 Petición recibida: ${req.method} ${req.url}`);
    next();
});

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'tec_user',
    password: process.env.DB_PASSWORD || 'tec_password',
    database: process.env.DB_NAME || 'sistema_reservas_tec',
    port: process.env.DB_PORT || 3306,
    dateStrings: true,
    ssl: process.env.DB_HOST === 'localhost' || process.env.DB_HOST === 'db' || process.env.DB_HOST === 'reservas_db' ? false : { rejectUnauthorized: false }
};

// --- HELPER: Obtener IP IPv4 Real ---
const getGmailIPv4 = () => {
    return new Promise((resolve) => {
        // Buscamos la IP manual de smtp.gmail.com
        dns.resolve4('smtp.gmail.com', (err, addresses) => {
            if (err || !addresses || addresses.length === 0) {
                console.log("⚠️ Falló DNS, usando IP de respaldo.");
                resolve('142.250.115.108'); // IP de respaldo de Google
            } else {
                console.log(`✅ DNS Resuelto a IPv4: ${addresses[0]}`);
                resolve(addresses[0]);
            }
        });
    });
};

// --- FUNCIÓN DE ENVÍO BLINDADA ---
async function enviarCorreoOmar(detalles) {
    const { titulo, sala, inicio, fin, responsable, requerimientos } = detalles;

    try {
        const gmailIp = await getGmailIPv4();

        // CONFIGURACIÓN GANADORA: IPv4 + Puerto 587
        const transporter = nodemailer.createTransport({
            host: gmailIp,           // Usamos la IP (evita IPv6)
            port: 587,               // Puerto estándar (evita Timeout del 465)
            secure: false,           // FALSE para puerto 587
            servername: 'smtp.gmail.com', // Necesario para que TLS confíe en la IP
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        const mailOptions = {
            from: `"Sistema de Espacios Tec" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_PF, 
            subject: `📢 Nuevo Requerimiento: ${titulo}`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #002F5D; border-bottom: 2px solid #8DBD3E; padding-bottom: 10px;">Nuevo Evento con Requerimientos</h2>
                    <p>Hola Omar,</p>
                    <p>Se ha programado un nuevo evento que requiere apoyo de Planta Física.</p>
                    <ul>
                        <li><b>Evento:</b> ${titulo}</li>
                        <li><b>Sala:</b> ${sala}</li>
                        <li><b>Horario:</b> ${inicio} - ${fin}</li>
                        <li><b>Responsable:</b> ${responsable}</li>
                    </ul>
                    <div style="background-color: #fff3cd; padding: 15px; margin-top: 20px; border-left: 5px solid #ffc107;">
                        <b>🛠 Requerimientos:</b>
                        <p>${requerimientos}</p>
                    </div>
                </div>
            `
        };

        console.log(`📨 Enviando a IP: ${gmailIp} (Puerto 587)...`);
        await transporter.sendMail(mailOptions);
        console.log('📧 ¡CORREO ENVIADO EXITOSAMENTE!');

    } catch (error) {
        console.error('❌ Error enviando correo:', error);
    }
}

// --- RUTAS DE AUTENTICACIÓN ---
app.post('/api/register', async (req, res) => {
    const { nombre, email, password } = req.body;
    if (!email.endsWith('@tecmilenio.mx') && email !== 'admin@tec.mx') return res.status(403).json({ error: 'Correo no permitido' });

    try {
        const connection = await mysql.createConnection(dbConfig);
        const [existentes] = await connection.execute('SELECT * FROM usuarios WHERE email = ?', [email]);
        if (existentes.length > 0) { await connection.end(); return res.status(400).json({ error: 'Correo duplicado' }); }
        
        await connection.execute('INSERT INTO usuarios (nombre_completo, email, password) VALUES (?, ?, ?)', [nombre, email, password]);
        await connection.end();
        res.status(201).json({ message: 'Cuenta creada' });
    } catch (error) { res.status(500).json({ error: 'Error server' }); }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute('SELECT id, nombre_completo, email FROM usuarios WHERE email = ? AND password = ?', [email, password]);
        await connection.end();
        if (rows.length > 0) res.json(rows[0]); else res.status(401).json({ error: 'Credenciales incorrectas' });
    } catch (error) { res.status(500).json({ error: 'Error server' }); }
});

// --- RUTAS DE RESERVAS ---
app.get('/api/reservas', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(`SELECT r.*, s.nombre as nombre_sala FROM reservaciones r JOIN salas s ON r.sala_id = s.id WHERE r.estado = 'confirmada'`);
        await connection.end();
        res.json(rows);
    } catch (error) { res.status(500).json({ error: 'Error BD' }); }
});

app.post('/api/reservas', async (req, res) => {
    const { sala_id, titulo, responsable, inicio, fin, requerimientos } = req.body;
    if (new Date(inicio) >= new Date(fin)) return res.status(400).json({ error: 'Horas inválidas' });

    try {
        const connection = await mysql.createConnection(dbConfig);
        const [existentes] = await connection.execute(`SELECT * FROM reservaciones WHERE sala_id = ? AND estado = 'confirmada' AND ((fecha_inicio < ? AND fecha_fin > ?))`, [sala_id, fin, inicio]);

        if (existentes.length > 0) { await connection.end(); return res.status(409).json({ error: 'Horario ocupado' }); }

        await connection.execute(`INSERT INTO reservaciones (sala_id, titulo_evento, responsable, fecha_inicio, fecha_fin, requerimientos_fisicos, estado) VALUES (?, ?, ?, ?, ?, ?, 'confirmada')`, [sala_id, titulo, responsable, inicio, fin, requerimientos || '']);

        // Recuperar nombre sala
        const [salas] = await connection.execute('SELECT nombre FROM salas WHERE id = ?', [sala_id]);
        const nombreSala = salas[0]?.nombre || 'Sala';

        if (requerimientos && requerimientos.trim().length > 0) {
            enviarCorreoOmar({ titulo, sala: nombreSala, inicio, fin, responsable, requerimientos }); 
        }

        await connection.end();
        res.status(201).json({ message: 'Guardado' });
    } catch (error) { console.error(error); res.status(500).json({ error: 'Error interno' }); }
});

app.put('/api/reservas/:id', async (req, res) => {
    const { id } = req.params;
    const { sala_id, titulo, inicio, fin, requerimientos } = req.body;
    if (new Date(inicio) >= new Date(fin)) return res.status(400).json({ error: 'Horas inválidas' });

    try {
        const connection = await mysql.createConnection(dbConfig);
        const [existentes] = await connection.execute(`SELECT * FROM reservaciones WHERE sala_id = ? AND estado = 'confirmada' AND id != ? AND ((fecha_inicio < ? AND fecha_fin > ?))`, [sala_id, id, fin, inicio]);

        if (existentes.length > 0) { await connection.end(); return res.status(409).json({ error: 'Choque horarios' }); }

        await connection.execute(`UPDATE reservaciones SET sala_id = ?, titulo_evento = ?, fecha_inicio = ?, fecha_fin = ?, requerimientos_fisicos = ? WHERE id = ?`, [sala_id, titulo, inicio, fin, requerimientos, id]);
        await connection.end();
        res.json({ message: 'Actualizado' });
    } catch (error) { res.status(500).json({ error: 'Error actualizar' }); }
});

app.delete('/api/reservas/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const connection = await mysql.createConnection(dbConfig);
        await connection.execute('DELETE FROM reservaciones WHERE id = ?', [id]);
        await connection.end();
        res.json({ message: 'Eliminado' });
    } catch (error) { res.status(500).json({ error: 'Error eliminar' }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT} 🚀`));