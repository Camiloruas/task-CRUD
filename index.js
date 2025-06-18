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
app.use(bodyParser.urlencoded({ extended: true }));


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

app.post("/adicionar-tarefa", async (req , res)=> {

   const input = req.body.novaTarefa;
    try{
        await db.query("INSERT INTO tarefas (descricao) VALUES ($1)", [input] ) 
        res.redirect("/");

    } catch(erro) {
        console.error("Erro ao adicionar Tarefa:", erro);
        res.status(500).send("Erro ao adicionar a Tarefa.")
    }
})


app.post("/excluir-tarefa", async (req , res)=> {

   const idDelete = req.body.idTarefa;
    try{
        await db.query("DELETE FROM tarefas WHERE id = $1;", [idDelete] ) 
        res.redirect("/");

    } catch(erro) {
        console.error("Erro ao deletar Tarefa:", erro);
        res.status(500).send("Erro ao deletar Tarefa.")
    }
})


app.post("/atualizar-tarefa", async (req , res)=> {

   const idAtualizar = req.body.idTarefa;
   const newDescription = req.body.novaDescricao;

    try{
        await db.query("UPDATE tarefas SET descricao = $1 WHERE id = $2;", [newDescription, idAtualizar]);
        res.redirect("/");

    } catch(erro) {
        console.error("Erro ao deletar Tarefa:", erro);
        res.status(500).send("Erro ao deletar Tarefa.")
    }
})



app.listen(port , ()=> {
    console.log(`Servidor Rodando na porta ${port}` )
})

