const express = require("express");
const { Pool } = require("pg");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

if (!process.env.DATABASE_URL) {
    console.error("ERRO: DATABASE_URL não configurada.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Preparar base de dados
async function iniciarBanco() {

    await pool.query(`
        CREATE TABLE IF NOT EXISTS jogadores (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(120) NOT NULL,
            idade INTEGER NOT NULL,
            sexo VARCHAR(30) NOT NULL,
            nascimento DATE NOT NULL,
            telefone VARCHAR(25) UNIQUE NOT NULL,
            consentimento BOOLEAN NOT NULL,
            estado VARCHAR(20) DEFAULT 'pendente',
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log("Base de dados preparada!");
}

// Página inicial
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Verificar servidor
app.get("/api/status", (req, res) => {
    res.json({
        site: "O MILLENNIUM",
        servidor: "Online",
        banco: "Conectado"
    });
});

// Inscrição
app.post("/api/inscricao", async (req, res) => {

    try {

        const {
            nome,
            idade,
            sexo,
            nascimento,
            telefone,
            consentimento
        } = req.body;

        if (!nome || !idade || !sexo || !nascimento ||
            !telefone || consentimento !== true) {

            return res.status(400).json({
                erro: "Preencha todos os campos."
            });
        }

        const data = new Date(nascimento + "T00:00:00Z");
        const hoje = new Date();

        if (isNaN(data.getTime()) || data > hoje) {
            return res.status(400).json({
                erro: "Data de nascimento inválida."
            });
        }

        let idadeReal =
            hoje.getUTCFullYear() - data.getUTCFullYear();

        const mes = hoje.getUTCMonth() - data.getUTCMonth();

        if (
            mes < 0 ||
            (mes === 0 && hoje.getUTCDate() < data.getUTCDate())
        ) {
            idadeReal--;
        }

        if (idadeReal < 18 || Number(idade) !== idadeReal) {
            return res.status(400).json({
                erro: "É necessário ter pelo menos 18 anos."
            });
        }

        const numero = String(telefone).replace(/[\s()-]/g, "");

        if (!/^\+?[0-9]{8,15}$/.test(numero)) {
            return res.status(400).json({
                erro: "Número de telefone inválido."
            });
        }

        const resultado = await pool.query(
            `INSERT INTO jogadores
            (nome, idade, sexo, nascimento, telefone, consentimento)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, nome, estado`,
            [
                nome.trim(),
                idadeReal,
                sexo,
                nascimento,
                numero,
                true
            ]
        );

        res.status(201).json({
            mensagem: "Inscrição recebida!",
            jogador: resultado.rows[0]
        });

    } catch (erro) {

        console.error("Erro:", erro);

        if (erro.code === "23505") {
            return res.status(409).json({
                erro: "Este número já possui uma inscrição."
            });
        }

        res.status(500).json({
            erro: "Erro ao realizar inscrição."
        });
    }
});

// Iniciar servidor
iniciarBanco()
    .then(() => {

        app.listen(PORT, () => {
            console.log("O MILLENNIUM ativo na porta " + PORT);
        });

    })
    .catch(erro => {
        console.error("Erro na base de dados:", erro);
        process.exit(1);
    });
