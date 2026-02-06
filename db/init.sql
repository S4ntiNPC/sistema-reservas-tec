CREATE TABLE IF NOT EXISTS salas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    capacidad INT NOT NULL
);

INSERT INTO salas (nombre, capacidad) SELECT * FROM (SELECT 'SUM', 100) AS tmp WHERE NOT EXISTS (SELECT nombre FROM salas WHERE nombre = 'SUM') LIMIT 1;
INSERT INTO salas (nombre, capacidad) SELECT * FROM (SELECT 'SAE', 50) AS tmp WHERE NOT EXISTS (SELECT nombre FROM salas WHERE nombre = 'SAE') LIMIT 1;

CREATE TABLE IF NOT EXISTS reservaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sala_id INT,
    titulo_evento VARCHAR(100) NOT NULL,
    responsable VARCHAR(100),  -- ¡NUEVA COLUMNA!
    fecha_inicio DATETIME NOT NULL,
    fecha_fin DATETIME NOT NULL,
    requerimientos_fisicos TEXT,
    estado VARCHAR(20) DEFAULT 'confirmada',
    FOREIGN KEY (sala_id) REFERENCES salas(id)
);