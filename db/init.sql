-- database/init.sql

CREATE TABLE IF NOT EXISTS salas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    capacidad INT NOT NULL
);

-- Insertar salas si no existen
INSERT INTO salas (nombre, capacidad) SELECT * FROM (SELECT 'SUM', 100) AS tmp WHERE NOT EXISTS (SELECT nombre FROM salas WHERE nombre = 'SUM') LIMIT 1;
INSERT INTO salas (nombre, capacidad) SELECT * FROM (SELECT 'SAE', 50) AS tmp WHERE NOT EXISTS (SELECT nombre FROM salas WHERE nombre = 'SAE') LIMIT 1;

-- TABLA DE USUARIOS (El control de acceso)
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre_completo VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL
);

-- Usuario Administrador por defecto (Respaldo)
INSERT INTO usuarios (nombre_completo, email, password) 
SELECT * FROM (SELECT 'Administrador Tec', 'admin@tec.mx', '123') AS tmp 
WHERE NOT EXISTS (SELECT email FROM usuarios WHERE email = 'admin@tec.mx') LIMIT 1;

-- TABLA DE RESERVACIONES (Con trazabilidad del responsable)
CREATE TABLE IF NOT EXISTS reservaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sala_id INT,
    titulo_evento VARCHAR(100) NOT NULL,
    responsable VARCHAR(100) NOT NULL, -- Aquí se guarda quién hizo la reserva
    fecha_inicio DATETIME NOT NULL,
    fecha_fin DATETIME NOT NULL,
    requerimientos_fisicos TEXT,
    estado VARCHAR(20) DEFAULT 'confirmada',
    FOREIGN KEY (sala_id) REFERENCES salas(id)
);