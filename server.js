const express = require("express");
const { Pool } = require("pg");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Criar tabela de jogadores
async function iniciarBanco() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS jogadores (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(120) NOT NULL,
            idade INTEGER NOT NULL,
            sexo VARCHAR(30) NOT NULL,
            nascimento DATE NOT NULL,
            telefone VARCHAR(25) NOT NULL UNIQUE,
            consentimento BOOLEAN NOT NULL,
            estado VARCHAR(20) DEFAULT 'pendente',
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log("Base de dados preparada!");
}

// Página inicial
app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "index.html")
    );
});

// Verificar servidor
app.get("/api/status", (req, res) => {
    res.json({
        site: "O MILLENNIUM",
        servidor: "Online"
    });
});

// Registar jogador
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

        if (
            !nome ||
            !idade ||
            !sexo ||
            !nascimento ||
            !telefone ||
            consentimento !== true
        ) {
            return res.status(400).json({
                erro: "Preencha todos os campos e aceite a política de dados."
            });
        }

        const data = new Date(nascimento + "T12:00:00Z");
        const hoje = new Date();

        if (isNaN(data.getTime()) || data > hoje) {
            return res.status(400).json({
                erro: "Data de nascimento inválida."
            });
        }

        let idadeReal = hoje.getUTCFullYear() - data.getUTCFullYear();

        const aniversario =
            new Date(Date.UTC(
                hoje.getUTCFullYear(),
                data.getUTCMonth(),
                data.getUTCDate()
            ));

        if (hoje < aniversario) idadeReal--;

        if (idadeReal < 18 || Number(idade) !== idadeReal) {
            return res.status(400).json({
                erro: "É necessário ter pelo menos 18 anos e informar a idade correta."
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
            mensagem: "Inscrição recebida com sucesso!",
            jogador: resultado.rows[0]
        });

    } catch (erro) {

        if (erro.code === "23505") {
            return res.status(409).json({
                erro: "Este número já possui uma inscrição."
            });
        }

        console.error("Erro na inscrição:", erro);

        res.status(500).json({
            erro: "Não foi possível concluir a inscrição."
        });
    }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;

iniciarBanco()
    .then(() => {
        app.listen(PORT, () => {
            console.log(
                `O MILLENNIUM ativo na porta ${PORT}`
            );
        });
    })
    .catch(erro => {
        console.error("Erro na base de dados:", erro);
        process.exit(1);
    });
