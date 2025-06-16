import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;


const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "task_crud_db",
    password: "123456",
    port: 5432,
})

db.connect();



app.get("/", (req , res ) => {
    res.send(("Olá, Task-CRUD está funcionando! "))
})

app.listen(port , ()=> {
    console.log(`Servidor Rodando na porta ${port}` )
})

