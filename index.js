
import 'dotenv/config';
import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import path from "path";


const app = express();
const port = 3333;

app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

// Configuração da conexão com o banco de dados PostgreSQL
const db = new pg.Client({
  user: process.env.DB_USER,        // usando a  VARIÁVEL DE AMBIENTE
  host: process.env.DB_HOST,        // usando a  VARIÁVEL DE AMBIENTE
  database: process.env.DB_DATABASE,  // usando a  VARIÁVEL DE AMBIENTE
  password: process.env.DB_PASSWORD,  // usando a  VARIÁVEL DE AMBIENTE
  port: process.env.DB_PORT,        // usando a  VARIÁVEL DE AMBIENTE
});


db.connect();


// let items = [
//   { id: 1, title: "Buy milk" },
//   { id: 2, title: "Finish homework" },
// ];

app.get("/", async (req, res) => {
  try {
    const resultado = await db.query("SELECT * FROM items ORDER BY id ASC ");
    const listItems = resultado.rows;
    res.render("index.ejs", {
      listTitle: "Hoje",
      listItems: listItems,
    });
  } catch (erro) {
    console.error("Erro ao buscar tarefas:", erro);
    res.status(500).send("Erro ao carregar as tarefas do banco de dados.");
  }
});

app.post("/add", async (req , res)=> {
  const item = req.body.newItem;
     try{
        await db.query("INSERT INTO items (title) VALUES ($1)", [item] ) 
        res.redirect("/");

    } catch(erro) {
        console.error("Erro ao adicionar Tarefa:", erro);
        res.status(500).send("Erro ao adicionar a Tarefa.")
    }
})


app.post("/edit", async (req , res)=> {

   const idAtualizar = req.body.updatedItemId;
   const newDescription = req.body.updatedItemTitle;

    try{
        await db.query("UPDATE items SET title = $1 WHERE id = $2;", [newDescription, idAtualizar]);
        res.redirect("/");

    } catch(erro) {
        console.error("Erro ao atualizar Tarefa:", erro);
        res.status(500).send("Erro ao atualizar Tarefa.")
    }
})

app.post("/delete", async (req , res)=> {

   const idDelete = req.body.deleteItemId;
    try{
        await db.query("DELETE FROM items WHERE id = $1;", [idDelete] ) 
        res.redirect("/");

    } catch(erro) {
        console.error("Erro ao deletar Tarefa:", erro);
        res.status(500).send("Erro ao deletar Tarefa.")
    }
})

app.post("/delete", (req, res) => {});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});