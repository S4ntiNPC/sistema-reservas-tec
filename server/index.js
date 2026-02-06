// server/index.js
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const nodemailer = require('nodemailer'); // ¡IMPORTANTE!
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
//checar fallo
app.use((req, res, next) => {
    console.log(`2. Petición recibida en el servidor: ${req.method} ${req.url}`);
    next();
});

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'tec_user',
    password: process.env.DB_PASSWORD || 'tec_password',
    database: process.env.DB_NAME || 'sistema_reservas_tec',
    port: process.env.DB_PORT || 3306,
    ssl: process.env.DB_HOST === 'localhost' || process.env.DB_HOST === 'db' || process.env.DB_HOST === 'reservas_db' ? false : { rejectUnauthorized: false }
};

// --- CONFIGURACIÓN DEL CORREO (El "Robot" que envía) ---
const transporter = nodemailer.createTransport({
    service: 'gmail', // O 'outlook' o 'hotmail'
    auth: {
        user: process.env.EMAIL_USER, // <--- CAMBIA ESTO (Correo del Robot)
        pass: process.env.EMAIL_PASS   // <--- CAMBIA ESTO (No tu pass normal)
    }
});

// Función auxiliar para enviar el correo a Omar
async function enviarCorreoOmar(detalles) {
    const { titulo, sala, inicio, fin, responsable, requerimientos } = detalles;

    const mailOptions = {
        from: `"Sistema de Espacios Tec" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_PF, 
        subject: `📢 Nuevo Requerimiento: ${titulo}`,
        html: `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
                <h2 style="color: #002F5D; border-bottom: 2px solid #8DBD3E; padding-bottom: 10px;">Nuevo Evento con Requerimientos</h2>
                <p>Hola Omar,</p>
                <p>Se ha programado un nuevo evento que requiere apoyo de Planta Física. Aquí están los detalles:</p>
                
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                    <tr style="background-color: #f9f9f9;"><td style="padding: 10px; font-weight: bold;">Evento:</td><td style="padding: 10px;">${titulo}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold;">Sala:</td><td style="padding: 10px;">${sala}</td></tr>
                    <tr style="background-color: #f9f9f9;"><td style="padding: 10px; font-weight: bold;">Horario:</td><td style="padding: 10px;">${inicio} - ${fin}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold;">Responsable:</td><td style="padding: 10px;">${responsable}</td></tr>
                </table>

                <div style="background-color: #fff3cd; padding: 15px; margin-top: 20px; border-left: 5px solid #ffc107; border-radius: 4px;">
                    <h3 style="margin-top: 0; color: #856404;">🛠 Requerimientos Solicitados:</h3>
                    <p style="white-space: pre-wrap; margin-bottom: 0;">${requerimientos}</p>
                </div>
                
                <p style="font-size: 12px; color: #777; margin-top: 30px; text-align: center;">Sistema de Gestión de Espacios - Campus Chihuahua</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('📧 Correo enviado a Omar exitosamente');
    } catch (error) {
        console.error('❌ Error enviando correo:', error);
    }
}

// --- RUTAS DE AUTENTICACIÓN (Igual que antes) ---
// server/index.js
app.post('/api/register', async (req, res) => {
    const { nombre, email, password } = req.body;

    // Validación rápida
    if (!email.endsWith('@tecmilenio.mx') && email !== 'admin@tec.mx') {
        console.log("❌ Error: Dominio no permitido");
        return res.status(403).json({ error: 'Acceso denegado: Se requiere correo institucional' });
    }

    try {
        // Imprimimos la config (OJO: no mostrar password real en producción)
        console.log(`   -> Host: ${dbConfig.host}, User: ${dbConfig.user}, DB: ${dbConfig.database}`);
        
        const connection = await mysql.createConnection(dbConfig);

        const [existentes] = await connection.execute('SELECT * FROM usuarios WHERE email = ?', [email]);
        
        if (existentes.length > 0) {
            console.log("❌ Error: Usuario duplicado");
            await connection.end();
            return res.status(400).json({ error: 'Este correo ya está registrado' });
        }

        await connection.execute(
            'INSERT INTO usuarios (nombre_completo, email, password) VALUES (?, ?, ?)',
            [nombre, email, password]
        );
        
        await connection.end();
        console.log("✅ 8. Todo listo. Enviando respuesta al Frontend.");
        res.status(201).json({ message: 'Cuenta activada exitosamente' });

    } catch (error) {
        console.error("🔥 ERROR FATAL EN EL SERVIDOR 🔥");
        console.error(error); // ESTO NOS DIRÁ LA CAUSA EXACTA
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    // Veamos qué datos llegan (OJO: en producción no imprimas passwords)
    console.log(`🔑 2. Datos recibidos -> Email: '${email}', Password: '${password}'`);

    try {
        const connection = await mysql.createConnection(dbConfig);
        
        // Consulta exacta
        const [rows] = await connection.execute(
            'SELECT id, nombre_completo, email FROM usuarios WHERE email = ? AND password = ?',
            [email, password]
        );
        
        await connection.end();

        if (rows.length > 0) {
            res.json(rows[0]); 
        } else {            
            // Vamos a hacer una búsqueda extra para ver si el correo al menos existe
            // Esto es solo para depurar y ayudarte a saber si falló el pass o el email
            const connection2 = await mysql.createConnection(dbConfig);
            const [checkEmail] = await connection2.execute('SELECT * FROM usuarios WHERE email = ?', [email]);
            await connection2.end();
            
            if (checkEmail.length > 0) {
                console.log("   ⚠️ PISTA: El correo SÍ existe, pero la contraseña no coincide.");
                // Compara visualmente en la consola qué password tiene la BD vs la que mandaste
                console.log(`   ⚠️ BD tiene: '${checkEmail[0].password}' vs Recibido: '${password}'`);
            } else {
                console.log("   ⚠️ PISTA: El correo NO existe en la base de datos.");
            }

            res.status(401).json({ error: 'Credenciales incorrectas' });
        }
    } catch (error) {
        console.error("🔥 ERROR EN LOGIN 🔥", error);
        res.status(500).json({ error: 'Error de servidor' });
    }
});
// --- RUTAS DE RESERVAS ---

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

// POST: Crear reserva + NOTIFICACIÓN
app.post('/api/reservas', async (req, res) => {
    const { sala_id, titulo, responsable, inicio, fin, requerimientos } = req.body;
    
    if (!sala_id || !titulo || !responsable || !inicio || !fin) return res.status(400).json({ error: 'Faltan datos' });

    try {
        const connection = await mysql.createConnection(dbConfig);
        const [existentes] = await connection.execute(`
            SELECT * FROM reservaciones 
            WHERE sala_id = ? AND estado = 'confirmada'
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

        // --- MAGIA: ENVIAR CORREO SI HAY REQUERIMIENTOS ---
        // Obtenemos el nombre de la sala para el correo (porque solo tenemos el ID)
        const [salas] = await connection.execute('SELECT nombre FROM salas WHERE id = ?', [sala_id]);
        const nombreSala = salas[0]?.nombre || 'Sala Desconocida';

        // Solo molestamos a Omar si realmente pidieron algo
        if (requerimientos && requerimientos.trim().length > 0) {
            // No usamos 'await' aquí para no hacer esperar al usuario en el frontend
            enviarCorreoOmar({
                titulo, 
                sala: nombreSala, 
                inicio, 
                fin, 
                responsable, 
                requerimientos
            }); 
        }
        // --------------------------------------------------

        await connection.end();
        res.status(201).json({ message: 'Guardado y notificado' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// --- RUTAS PUT Y DELETE (RESTAURADAS) ---

// EDITAR RESERVA (PUT)
app.put('/api/reservas/:id', async (req, res) => {
    const { id } = req.params;
    const { sala_id, titulo, inicio, fin, requerimientos } = req.body;

    console.log(`📝 Petición de edición para ID: ${id}`);

    try {
        const connection = await mysql.createConnection(dbConfig);
        
        // 1. Validar choque (EXCLUYENDO la reserva actual con "AND id != ?")
        // Esto es vital: si no pones "id != ?", el sistema pensará que choca consigo misma.
        const [existentes] = await connection.execute(`
            SELECT * FROM reservaciones 
            WHERE sala_id = ? AND estado = 'confirmada' AND id != ?
            AND ((fecha_inicio < ? AND fecha_fin > ?))
        `, [sala_id, id, fin, inicio]);

        if (existentes.length > 0) {
            console.log("❌ Choque de horario al editar");
            await connection.end();
            return res.status(409).json({ error: '¡El nuevo horario choca con otro evento!' });
        }

        // 2. Actualizar
        await connection.execute(`
            UPDATE reservaciones 
            SET sala_id = ?, titulo_evento = ?, fecha_inicio = ?, fecha_fin = ?, requerimientos_fisicos = ?
            WHERE id = ?
        `, [sala_id, titulo, inicio, fin, requerimientos, id]);

        await connection.end();
        console.log("✅ Edición exitosa");
        res.json({ message: 'Actualizado correctamente' });

    } catch (error) { 
        console.error("🔥 Error al actualizar:", error); 
        res.status(500).json({ error: 'Error al actualizar' }); 
    }
});

// ELIMINAR RESERVA (DELETE)
app.delete('/api/reservas/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`🗑️ Petición de eliminar para ID: ${id}`);

    try {
        const connection = await mysql.createConnection(dbConfig);
        
        await connection.execute('DELETE FROM reservaciones WHERE id = ?', [id]);
        
        await connection.end();
        console.log("✅ Eliminación exitosa");
        res.json({ message: 'Eliminado correctamente' });

    } catch (error) { 
        console.error("🔥 Error al eliminar:", error); 
        res.status(500).json({ error: 'Error al eliminar' }); 
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT} 🚀`));