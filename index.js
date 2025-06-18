import 'dotenv/config';
import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import path from "path";

const app = express();
const port = 3000;


// Configuração da conexão com o banco de dados PostgreSQL
const db = new pg.Client({
  user: process.env.DB_USER,        // usando a  VARIÁVEL DE AMBIENTE
  host: process.env.DB_HOST,        // usando a  VARIÁVEL DE AMBIENTE
  database: process.env.DB_DATABASE,  // usando a  VARIÁVEL DE AMBIENTE
  password: process.env.DB_PASSWORD,  // usando a  VARIÁVEL DE AMBIENTE
  port: process.env.DB_PORT,        // usando a  VARIÁVEL DE AMBIENTE
});


db.connect();


app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));
app.use(express.static("public"));


app.get("/", async (req , res ) => {
    try { 
    const resultado = await db.query("SELECT * FROM tarefas ORDER BY id ASC ");
    const tarefas = resultado.rows;
    res.render("index", { listaDeTarefas: tarefas });
    } catch(erro) {
        console.error("Erro ao buscar tarefas:" , erro);
        res.status(500).send("Erro ao carregar as tarefas do banco de dados.");
    }
})

app.listen(port , ()=> {
    console.log(`Servidor Rodando na porta ${port}` )
})

