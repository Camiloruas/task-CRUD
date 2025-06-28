import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import session from "express-session";
import 'dotenv/config';
import path from "path";
import GoogleStrategy from "passport-google-oauth2"; // Importação correta do GoogleStrategy

// import { access } from "fs"; // Esta importação não está sendo usada, pode ser removida

const app = express();
const port = 3000;
const saltRounds = 10;

// --- Configuração de Middleware ---
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24
    }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

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

db.connect();

// --- Rotas da Aplicação ---

app.get("/", (req, res) => {
    res.render("home.ejs");
});

app.get("/login", (req, res) => {
    res.render("login.ejs");
});

app.get("/register", (req, res) => {
    res.render("register.ejs");
});

app.post("/logout", (req, res, next) => {
    req.logout(function (err) {
        if (err) {
            console.error("Erro ao fazer logout:", err);
            return next(err);
        }
        res.redirect("/");
    });
});

// Rota PROTEGIDA para o Dashboard (sua lista de tarefas)
app.get("/dashboard", async (req, res) => {
    if (req.isAuthenticated()) {
        try {
            const resultado = await db.query("SELECT * FROM items WHERE user_id = $1 ORDER BY id ASC", [req.user.id]);
            const listItems = resultado.rows;

            res.render("index.ejs", {
                user: req.user, // Passa o objeto do usuário para o template
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

// Rota para iniciar a autenticação com Google
app.get("/auth/google", passport.authenticate("google", {
    scope: ["profile", "email"], // Define quais informações estamos pedindo ao Google
}));

// Rota de Callback do Google OAuth (para onde o Google redireciona após a autenticação)
app.get("/auth/google/secrets", passport.authenticate("google", {
    successRedirect: "/dashboard", // Se a autenticação for bem-sucedida, redireciona para o dashboard
    failureRedirect: "/login",     // Se falhar, redireciona para o login
}));


// --- Rotas POST para Autenticação ---

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

app.post("/login", passport.authenticate("local", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
}));


// --- Configuração da Estratégia de Autenticação do Passport ---

// Estratégia Local (username/password)
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

// Estratégia Google OAuth2
passport.use("google", new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
}, async (accessToken, refreshToken, profile, cb) => {
    try {
        const checkResult = await db.query("SELECT * FROM users WHERE google_id = $1", [profile.id]);

        if (checkResult.rows.length > 0) {
            // Usuário do Google já existe no seu DB, atualiza nome e foto e loga ele
            const user = checkResult.rows[0];
            await db.query(
                "UPDATE users SET username = $1, picture = $2 WHERE google_id = $3",
                [profile.displayName, profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null, profile.id]
            );
            // Retorna o usuário atualizado
            const updatedUserResult = await db.query("SELECT * FROM users WHERE google_id = $1", [profile.id]);
            return cb(null, updatedUserResult.rows[0]);
        } else {
            // Usuário do Google não existe, cria um novo usuário no seu DB
            const newUser = await db.query(
                "INSERT INTO users (username, password, google_id, email, picture) VALUES ($1, $2, $3, $4, $5) RETURNING *",
                [
                    profile.displayName,
                    "google-auth",
                    profile.id,
                    profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null,
                    profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null
                ]
            );
            return cb(null, newUser.rows[0]);
        }
    } catch (err) {
        console.error("Erro na estratégia Google OAuth:", err);
        return cb(err);
    }
}));


passport.serializeUser((user, cb) => {
    // Você pode serializar pelo ID do seu DB ou pelo Google ID,
    // mas para manter a consistência, o ID do seu DB é melhor.
    cb(null, user.id);
});

passport.deserializeUser(async (id, cb) => {
    try {
        // Busca o usuário pelo ID do seu DB
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

app.post("/add", async (req , res)=> {
    if (!req.isAuthenticated()) {
        return res.redirect("/login");
    }
    const item = req.body.newItem;
    const userId = req.user.id;

    try{
        await db.query("INSERT INTO items (title, user_id) VALUES ($1, $2)", [item, userId]);
        res.redirect("/dashboard");
    } catch(erro) {
        console.error("Erro ao adicionar Tarefa:", erro);
        res.status(500).send("Erro ao adicionar a Tarefa.");
    }
});

app.post("/edit", async (req , res)=> {
    if (!req.isAuthenticated()) {
        return res.redirect("/login");
    }
    const idAtualizar = req.body.updatedItemId;
    const newDescription = req.body.updatedItemTitle;
    const userId = req.user.id;

    try{
        await db.query("UPDATE items SET title = $1 WHERE id = $2 AND user_id = $3;", [newDescription, idAtualizar, userId]);
        res.redirect("/dashboard");
    }
     catch(erro) {
        console.error("Erro ao atualizar Tarefa:", erro);
        res.status(500).send("Erro ao atualizar Tarefa.");
    }
});

app.post("/delete", async (req , res)=> {
    if (!req.isAuthenticated()) {
        return res.redirect("/login");
    }
    const idDelete = req.body.deleteItemId;
    const userId = req.user.id;

    try{
        await db.query("DELETE FROM items WHERE id = $1 AND user_id = $2;", [idDelete, userId]);
        res.redirect("/dashboard");
    } catch(erro) {
        console.error("Erro ao deletar Tarefa:", erro);
        res.status(500).send("Erro ao deletar Tarefa.");
    }
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
