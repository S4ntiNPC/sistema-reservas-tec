// server/index.js
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const { Resend } = require('resend'); // 👈 CAMBIO MAESTRO

require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Logs para debug
app.use((req, res, next) => {
    console.log(`📥 Petición recibida: ${req.method} ${req.url}`);
    next();
});

// Inicializamos Resend con la variable de entorno
const resend = new Resend(process.env.RESEND_API_KEY);

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'tec_user',
    password: process.env.DB_PASSWORD || 'tec_password',
    database: process.env.DB_NAME || 'sistema_reservas_tec',
    port: process.env.DB_PORT || 3306,
    dateStrings: true,
    ssl: process.env.DB_HOST === 'localhost' || process.env.DB_HOST === 'db' || process.env.DB_HOST === 'reservas_db' ? false : { rejectUnauthorized: false }
};

// --- FUNCIÓN DE ENVÍO VÍA API (RESEND) ---
// Esto usa HTTP estándar (Puerto 443), NUNCA se bloquea por firewalls.
async function enviarCorreoOmar(detalles) {
    const { titulo, sala, inicio, fin, responsable, requerimientos } = detalles;

    try {
        console.log(`📨 Enviando correo vía Resend API...`);
        
        const data = await resend.emails.send({
            from: 'Sistema Reservas <onboarding@resend.dev>', // 👈 OBLIGATORIO en plan gratis
            to: [process.env.EMAIL_PF], // 👈 Asegúrate que este correo esté verificado en tu cuenta de Resend
            subject: `📢 Nuevo Requerimiento: ${titulo}`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #002F5D; border-bottom: 2px solid #8DBD3E; padding-bottom: 10px;">Nuevo Evento con Requerimientos</h2>
                    <p>Hola Omar,</p>
                    <p>Se ha programado un nuevo evento que requiere apoyo de Planta Física.</p>
                    
                    <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                        <tr style="background-color: #f9f9f9;"><td style="padding: 10px; font-weight: bold;">Evento:</td><td style="padding: 10px;">${titulo}</td></tr>
                        <tr><td style="padding: 10px; font-weight: bold;">Sala:</td><td style="padding: 10px;">${sala}</td></tr>
                        <tr style="background-color: #f9f9f9;"><td style="padding: 10px; font-weight: bold;">Horario:</td><td style="padding: 10px;">${inicio} - ${fin}</td></tr>
                        <tr><td style="padding: 10px; font-weight: bold;">Responsable:</td><td style="padding: 10px;">${responsable}</td></tr>
                    </table>

                    <div style="background-color: #fff3cd; padding: 15px; margin-top: 20px; border-left: 5px solid #ffc107; border-radius: 4px;">
                        <h3 style="margin-top: 0; color: #856404;">🛠 Requerimientos:</h3>
                        <p style="white-space: pre-wrap; margin-bottom: 0;">${requerimientos}</p>
                    </div>
                    
                    <p style="font-size: 12px; color: #777; margin-top: 30px; text-align: center;">Sistema de Gestión de Espacios - Campus Chihuahua</p>
                </div>
            `
        });

        console.log('📧 ¡CORREO ENVIADO EXITOSAMENTE! ID:', data.data?.id);
    } catch (error) {
        console.error('❌ Error enviando correo Resend:', error);
    }
}

// --- RUTAS DE AUTENTICACIÓN ---
app.post('/api/register', async (req, res) => {
    const { nombre, email, password } = req.body;
    if (!email.endsWith('@tecmilenio.mx') && email !== 'admin@tec.mx') {
        return res.status(403).json({ error: 'Acceso denegado: Se requiere correo institucional' });
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
        res.status(201).json({ message: 'Cuenta activada exitosamente' });
    } catch (error) {
        console.error("🔥 ERROR FATAL EN REGISTRO 🔥", error); 
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute('SELECT id, nombre_completo, email FROM usuarios WHERE email = ? AND password = ?', [email, password]);
        await connection.end();
        if (rows.length > 0) { res.json(rows[0]); } else { res.status(401).json({ error: 'Credenciales incorrectas' }); }
    } catch (error) {
        console.error("🔥 ERROR EN LOGIN 🔥", error);
        res.status(500).json({ error: 'Error de servidor' });
    }
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
    if (!sala_id || !titulo || !responsable || !inicio || !fin) return res.status(400).json({ error: 'Faltan datos' });
    if (new Date(inicio) >= new Date(fin)) return res.status(400).json({ error: 'Fecha fin incorrecta' });

    try {
        const connection = await mysql.createConnection(dbConfig);
        const [existentes] = await connection.execute(`
            SELECT * FROM reservaciones WHERE sala_id = ? AND estado = 'confirmada' AND ((fecha_inicio < ? AND fecha_fin > ?))
        `, [sala_id, fin, inicio]);

        if (existentes.length > 0) {
            await connection.end();
            return res.status(409).json({ error: '¡El horario ya está ocupado!' });
        }

        await connection.execute(`
            INSERT INTO reservaciones (sala_id, titulo_evento, responsable, fecha_inicio, fecha_fin, requerimientos_fisicos, estado)
            VALUES (?, ?, ?, ?, ?, ?, 'confirmada')
        `, [sala_id, titulo, responsable, inicio, fin, requerimientos || '']);

        const [salas] = await connection.execute('SELECT nombre FROM salas WHERE id = ?', [sala_id]);
        const nombreSala = salas[0]?.nombre || 'Sala Desconocida';

        if (requerimientos && requerimientos.trim().length > 0) {
            // Enviamos sin await para no trabar al usuario
            enviarCorreoOmar({ titulo, sala: nombreSala, inicio, fin, responsable, requerimientos }); 
        }

        await connection.end();
        res.status(201).json({ message: 'Guardado y notificado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

app.put('/api/reservas/:id', async (req, res) => {
    const { id } = req.params;
    const { sala_id, titulo, inicio, fin, requerimientos } = req.body;
    if (new Date(inicio) >= new Date(fin)) return res.status(400).json({ error: 'Fecha fin incorrecta' });

    try {
        const connection = await mysql.createConnection(dbConfig);
        const [existentes] = await connection.execute(`
            SELECT * FROM reservaciones WHERE sala_id = ? AND estado = 'confirmada' AND id != ? AND ((fecha_inicio < ? AND fecha_fin > ?))
        `, [sala_id, id, fin, inicio]);

        if (existentes.length > 0) {
            await connection.end();
            return res.status(409).json({ error: 'Choque de horarios' });
        }

        await connection.execute(`
            UPDATE reservaciones SET sala_id = ?, titulo_evento = ?, fecha_inicio = ?, fecha_fin = ?, requerimientos_fisicos = ? WHERE id = ?
        `, [sala_id, titulo, inicio, fin, requerimientos, id]);

        await connection.end();
        res.json({ message: 'Actualizado correctamente' });
    } catch (error) { 
        console.error("🔥 Error al actualizar:", error); 
        res.status(500).json({ error: 'Error al actualizar' }); 
    }
});

app.delete('/api/reservas/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const connection = await mysql.createConnection(dbConfig);
        await connection.execute('DELETE FROM reservaciones WHERE id = ?', [id]);
        await connection.end();
        res.json({ message: 'Eliminado correctamente' });
    } catch (error) { 
        console.error("🔥 Error al eliminar:", error); 
        res.status(500).json({ error: 'Error al eliminar' }); 
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT} 🚀`));