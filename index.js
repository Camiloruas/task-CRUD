import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt"; // Para hashing de senhas
import passport from "passport"; // Para autenticação
import { Strategy } from "passport-local"; // Estratégia de autenticação local (usuário/senha)
import session from "express-session"; // Para gerenciar sessões
import 'dotenv/config'; // Para carregar variáveis de ambiente
import path from "path"; // Para manipulação de caminhos de arquivo

const app = express();
const port = 3333;
const saltRounds = 10; // Número de rounds para o hashing do bcrypt (quanto maior, mais seguro, mas mais lento)

// --- Configuração de Middleware ---
app.use(session({
    secret: process.env.SESSION_SECRET, // Chave secreta para assinar o cookie de sessão (do .env)
    resave: false, // Impede que a sessão seja salva novamente no armazenamento se não foi modificada
    saveUninitialized: true, // Salva sessões novas, mas não inicializadas
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 // Duração do cookie da sessão: 1 dia (em milissegundos)
    }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views')); // Garante que o diretório 'views' seja encontrado corretamente
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public")); // Para servir arquivos estáticos (CSS, JS, imagens)

// Inicializa o Passport e a sessão do Passport
app.use(passport.initialize());
app.use(passport.session());

// --- Configuração do Banco de Dados ---
const db = new pg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

db.connect(); // Conecta ao banco de dados

// --- Rotas da Aplicação ---

// Rota para a página inicial (landing page)
app.get("/", (req, res) => {
    res.render("home.ejs");
});

// Rota para exibir o formulário de login
app.get("/login", (req, res) => {
    res.render("login.ejs");
});

// Rota para exibir o formulário de registro
app.get("/register", (req, res) => {
    res.render("register.ejs");
});

// Rota POST para processar o logout do usuário
app.post("/logout", (req, res, next) => {
    req.logout(function (err) {
        if (err) {
            console.error("Erro ao fazer logout:", err);
            return next(err);
        }
        res.redirect("/");
    });
});

// Rota PROTEGIDA para o Dashboard (sua lista de tarefas) - AGORA FILTRANDO POR user_id
app.get("/dashboard", async (req, res) => {
    if (req.isAuthenticated()) {
        try {
            // Consulta APENAS as tarefas associadas ao user_id do usuário logado
            const resultado = await db.query("SELECT * FROM items WHERE user_id = $1 ORDER BY id ASC", [req.user.id]);
            const listItems = resultado.rows;

            res.render("index.ejs", {
                listTitle: "Minhas Tarefas",
                listItems: listItems,
            });
        } catch (erro) {
            console.error("Erro ao buscar tarefas na rota protegida:", erro);
            res.status(500).send("Erro ao carregar as tarefas.");
        }
    } else {
        res.redirect("/login");
    }
});

// --- Rotas POST para Autenticação ---

// Rota POST para processar o registro de novos usuários
app.post("/register", async (req, res) => {
    const { username, password } = req.body;

    try {
        const checkResult = await db.query("SELECT * FROM users WHERE username = $1", [username]);

        if (checkResult.rows.length > 0) {
            res.redirect("/login");
        } else {
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            const result = await db.query(
                "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *",
                [username, hashedPassword]
            );
            const user = result.rows[0];

            req.login(user, (err) => {
                if (err) {
                    console.error("Erro ao logar após registro:", err);
                    return res.redirect("/login");
                }
                res.redirect("/dashboard");
            });
        }
    } catch (err) {
        console.error("Erro ao registrar usuário:", err);
        res.status(500).send("Erro ao registrar usuário.");
    }
});

// Rota POST para processar o login
app.post("/login", passport.authenticate("local", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
}));

// --- Configuração da Estratégia de Autenticação do Passport ---

passport.use(new Strategy(async function verify(username, password, cb) {
    try {
        const result = await db.query("SELECT * FROM users WHERE username = $1", [username]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                return cb(null, user);
            } else {
                return cb(null, false, { message: "Senha incorreta." });
            }
        } else {
            return cb(null, false, { message: "Usuário não encontrado." });
        }
    } catch (err) {
        return cb(err);
    }
}));

passport.serializeUser((user, cb) => {
    cb(null, user.id);
});

passport.deserializeUser(async (id, cb) => {
    try {
        const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            cb(null, user);
        } else {
            cb(new Error("Usuário não encontrado durante desserialização."));
        }
    } catch (err) {
        cb(err);
    }
});


// --- Rotas POST para Operações CRUD (Protegidas por user_id) ---

// Rota POST para adicionar uma nova tarefa
app.post("/add", async (req , res)=> {
    if (!req.isAuthenticated()) {
        return res.redirect("/login");
    }
    const item = req.body.newItem;
    const userId = req.user.id; // Obtém o ID do usuário logado

    try{
        // Insere a nova tarefa associada ao user_id logado
        await db.query("INSERT INTO items (title, user_id) VALUES ($1, $2)", [item, userId]);
        res.redirect("/dashboard");
    } catch(erro) {
        console.error("Erro ao adicionar Tarefa:", erro);
        res.status(500).send("Erro ao adicionar a Tarefa.");
    }
});

// Rota POST para editar uma tarefa existente
app.post("/edit", async (req , res)=> {
    if (!req.isAuthenticated()) {
        return res.redirect("/login");
    }
    const idAtualizar = req.body.updatedItemId;
    const newDescription = req.body.updatedItemTitle;
    const userId = req.user.id; // Obtém o ID do usuário logado

    try{
        // Atualiza a tarefa APENAS se ela pertencer ao user_id logado
        await db.query("UPDATE items SET title = $1 WHERE id = $2 AND user_id = $3;", [newDescription, idAtualizar, userId]);
        res.redirect("/dashboard");
    }
     catch(erro) {
        console.error("Erro ao atualizar Tarefa:", erro);
        res.status(500).send("Erro ao atualizar Tarefa.");
    }
});

// Rota POST para deletar uma tarefa
app.post("/delete", async (req , res)=> {
    if (!req.isAuthenticated()) {
        return res.redirect("/login");
    }
    const idDelete = req.body.deleteItemId;
    const userId = req.user.id; // Obtém o ID do usuário logado

    try{
        // Deleta a tarefa APENAS se ela pertencer ao user_id logado
        await db.query("DELETE FROM items WHERE id = $1 AND user_id = $2;", [idDelete, userId]);
        res.redirect("/dashboard");
    } catch(erro) {
        console.error("Erro ao deletar Tarefa:", erro);
        res.status(500).send("Erro ao deletar Tarefa.");
    }
});

// Inicia o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
