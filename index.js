import express from "express"; // Importa o framework Express para criar o servidor web.
import bodyParser from "body-parser"; // Importa o body-parser para analisar os corpos das requisições HTTP.
import pg from "pg"; // Importa o driver do PostgreSQL para interagir com o banco de dados.
import bcrypt from "bcrypt"; // Importa o bcrypt para criptografar senhas.
import passport from "passport"; // Importa o Passport, um middleware de autenticação para Node.js.
import { Strategy } from "passport-local"; // Importa a estratégia de autenticação local (usuário e senha).
import session from "express-session"; // Importa o express-session para gerenciar sessões de usuário.
import "dotenv/config"; // Carrega as variáveis de ambiente do arquivo .env.
import path from "path"; // Importa o módulo 'path' do Node.js para trabalhar com caminhos de arquivos e diretórios.
import GoogleStrategy from "passport-google-oauth2"; // Importa a estratégia de autenticação do Google.
import flash from "connect-flash"; // Importa o connect-flash para exibir mensagens temporárias (flash messages).

const app = express(); // Cria uma instância do aplicativo Express.
// Define a porta em que o servidor irá rodar.
// Para o Heroku, usamos process.env.PORT. Localmente, voltamos para a porta 3000.
const port = process.env.PORT || 3000; // Ajustado para compatibilidade com Heroku
const saltRounds = 10; // Define o número de "salt rounds" para o bcrypt, que afeta a complexidade da criptografia.

// --- Configuração de Middleware ---

// Configura o middleware de sessão.
app.use(
  session({
    secret: process.env.SESSION_SECRET, // Chave secreta para assinar o cookie da sessão, lida das variáveis de ambiente.
    resave: false, // Não salva a sessão se não for modificada.
    saveUninitialized: true, // Salva sessões novas, mesmo que não modificadas.
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // Define a duração do cookie da sessão para 1 dia (em milissegundos).
    },
  })
);
app.use(flash()); // Inicializa o connect-flash para ser usado no aplicativo.

app.set("view engine", "ejs"); // Define o EJS como o motor de visualização (template engine).
app.set("views", path.join(process.cwd(), "views")); // Define o diretório onde os arquivos de visualização (views) estão localizados.
app.use(bodyParser.urlencoded({ extended: true })); // Configura o body-parser para analisar dados de formulários URL-encoded.
app.use(express.static("public")); // Serve arquivos estáticos (CSS, imagens, etc.) a partir do diretório 'public'.

app.use(passport.initialize()); // Inicializa o Passport para autenticação.
app.use(passport.session()); // Habilita o Passport a usar sessões para manter o estado de login.

// --- Configuração do Banco de Dados ---

// Adaptação para o Heroku: Usa DATABASE_URL se disponível, senão usa variáveis locais
const db = new pg.Client({
  connectionString: process.env.DATABASE_URL, // Heroku fornecerá esta variável
  ssl: {
    rejectUnauthorized: false, // Necessário para Heroku Postgres em alguns ambientes
  },
});

db.connect()
  .then(() =>
    console.log("Conexão com o banco de dados estabelecida com sucesso!")
  )
  .catch((err) =>
    console.error("Erro na conexão com o banco de dados:", err.stack)
  );

// --- Rotas da Aplicação ---

// Rota para a página inicial.
app.get("/", (req, res) => {
  res.render("home.ejs"); // Renderiza a view 'home.ejs'.
});

// Rota para a página de login.
app.get("/login", (req, res) => {
  res.render("login.ejs", { messages: req.flash() }); // Renderiza a view 'login.ejs' e passa as mensagens flash (de erro, etc.).
});

// Rota para a página de registro.
app.get("/register", (req, res) => {
  res.render("register.ejs"); // Renderiza a view 'register.ejs'.
});

// Rota para fazer logout.
app.post("/logout", (req, res, next) => {
  req.logout(function (err) {
    // Função do Passport para encerrar a sessão do usuário.
    if (err) {
      // Se houver um erro durante o logout.
      console.error("Erro ao fazer logout:", err); // Exibe o erro no console.
      return next(err); // Passa o erro para o próximo middleware.
    }
    res.redirect("/"); // Redireciona o usuário para a página inicial após o logout.
  });
});

// Rota PROTEGIDA para o Dashboard (lista de tarefas).
app.get("/dashboard", async (req, res) => {
  if (req.isAuthenticated()) {
    // Verifica se o usuário está autenticado.
    try {
      // Busca no banco de dados os itens de tarefa associados ao ID do usuário logado.
      const resultado = await db.query(
        "SELECT * FROM items WHERE user_id = $1 ORDER BY id ASC",
        [req.user.id]
      );
      const listItems = resultado.rows; // Armazena os resultados da consulta.

      // Renderiza a view 'index.ejs' (dashboard) e passa os dados do usuário e a lista de tarefas.
      res.render("index.ejs", {
        user: req.user, // Passa o objeto do usuário para o template.
        listTitle: "Minhas Tarefas", // Título da página.
        listItems: listItems, // Lista de tarefas.
      });
    } catch (erro) {
      // Se ocorrer um erro na busca.
      console.error("Erro ao buscar tarefas na rota protegida:", erro); // Exibe o erro no console.
      res.status(500).send("Erro ao carregar as tarefas."); // Envia uma resposta de erro 500.
    }
  } else {
    // Se o usuário não estiver autenticado.
    res.redirect("/login"); // Redireciona para a página de login.
  }
});

// Rota para iniciar a autenticação com o Google.
app.get(
  "/auth/google",
  passport.authenticate("google", {
    // Usa a estratégia 'google' do Passport.
    scope: ["profile", "email"], // Define o escopo de permissões solicitadas ao Google (perfil e email).
  })
);

// Rota de Callback do Google OAuth (para onde o Google redireciona após a autenticação).
app.get(
  "/auth/google/secrets",
  passport.authenticate("google", {
    // Usa a estratégia 'google' para processar a resposta.
    successRedirect: "/dashboard", // Se a autenticação for bem-sucedida, redireciona para o dashboard.
    failureRedirect: "/login", // Se falhar, redireciona para a página de login.
  })
);

// --- Rotas POST para Autenticação ---

// Rota para registrar um novo usuário.
app.post("/register", async (req, res) => {
  const { username, password } = req.body; // Extrai o email (username) e a senha do corpo da requisição.

  try {
    // Verifica se o usuário já existe no banco de dados.
    const checkResult = await db.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );

    if (checkResult.rows.length > 0) {
      // Se o usuário já existe.
      res.redirect("/login"); // Redireciona para a página de login.
    } else {
      // Se o usuário não existe.
      // Criptografa a senha antes de salvar no banco de dados.
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Insere o novo usuário no banco de dados com a senha criptografada.
      const result = await db.query(
        "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *",
        [username, hashedPassword]
      );
      const user = result.rows[0]; // Obtém os dados do usuário recém-criado.

      // Faz o login automático do usuário após o registro.
      req.login(user, (err) => {
        if (err) {
          // Se houver um erro no login.
          console.error("Erro ao logar após registro:", err); // Exibe o erro no console.
          return res.redirect("/login"); // Redireciona para a página de login.
        }
        res.redirect("/dashboard"); // Redireciona para o dashboard após o login bem-sucedido.
      });
    }
  } catch (err) {
    // Se ocorrer um erro durante o processo de registro.
    console.error("Erro ao registrar usuário:", err); // Exibe o erro no console.
    res.status(500).send("Erro ao registrar usuário."); // Envia uma resposta de erro 500.
  }
});

// Rota para fazer login com usuário e senha.
app.post(
  "/login",
  passport.authenticate("local", {
    // Usa a estratégia 'local' do Passport.
    successRedirect: "/dashboard", // Se o login for bem-sucedido, redireciona para o dashboard.
    failureRedirect: "/login", // Se o login falhar, redireciona de volta para a página de login.
    failureFlash: true, // Habilita as mensagens flash para exibir erros de login (ex: "Senha incorreta").
  })
);

// --- Configuração da Estratégia de Autenticação do Passport ---

// Estratégia Local (autenticação com username/password).
passport.use(
  new Strategy(async function verify(username, password, cb) {
    // Define a função de verificação.
    try {
      // Procura o usuário no banco de dados pelo email (username).
      const result = await db.query("SELECT * FROM users WHERE username = $1", [
        username,
      ]);
      if (result.rows.length > 0) {
        // Se o usuário for encontrado.
        const user = result.rows[0]; // Armazena os dados do usuário.
        // Compara a senha fornecida com a senha criptografada no banco de dados.
        const match = await bcrypt.compare(password, user.password);
        if (match) {
          // Se as senhas corresponderem.
          return cb(null, user); // Autenticação bem-sucedida, retorna o objeto do usuário.
        } else {
          // Se as senhas não corresponderem.
          return cb(null, false, { message: "Senha incorreta." }); // Falha na autenticação, retorna uma mensagem de erro.
        }
      } else {
        // Se o usuário não for encontrado.
        return cb(null, false, { message: "Usuário não encontrado." }); // Falha na autenticação, retorna uma mensagem de erro.
      }
    } catch (err) {
      // Se ocorrer um erro no banco de dados.
      return cb(err); // Retorna o erro.
    }
  })
);

// Estratégia Google OAuth2.
passport.use(
  "google",
  new GoogleStrategy(
    {
      // Configura a estratégia do Google.
      clientID: process.env.GOOGLE_CLIENT_ID, // ID do cliente OAuth do Google, das variáveis de ambiente.
      clientSecret: process.env.GOOGLE_CLIENT_SECRET, // Chave secreta do cliente OAuth do Google.
      callbackURL: process.env.GOOGLE_CALLBACK_URL, // URL para onde o Google redireciona após a autenticação.
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo", // URL para obter informações do perfil do usuário.
    },
    async (accessToken, refreshToken, profile, cb) => {
      // Função de verificação chamada após a autenticação do Google.
      try {
        // Verifica se o usuário já existe no banco de dados usando o ID do Google.
        const checkResult = await db.query(
          "SELECT * FROM users WHERE google_id = $1",
          [profile.id]
        );

        if (checkResult.rows.length > 0) {
          // Se o usuário do Google já existe.
          // Atualiza o nome, foto e email do usuário no banco de dados e RETORNA o usuário atualizado.
          const updatedUserResult = await db.query(
            "UPDATE users SET username = $1, picture = $2, email = $3 WHERE google_id = $4 RETURNING *",
            [
              profile.displayName,
              profile.photos && profile.photos.length > 0
                ? profile.photos[0].value
                : null,
              profile.emails && profile.emails.length > 0
                ? profile.emails[0].value
                : null,
              profile.id,
            ]
          );
          return cb(null, updatedUserResult.rows[0]);
        } else {
          // Se o usuário do Google não existe, cria um novo.
          const newUser = await db.query(
            "INSERT INTO users (username, password, google_id, email, picture) VALUES ($1, $2, $3, $4, $5) RETURNING *", // CORREÇÃO AQUI: Adicionado 'email'
            [
              profile.displayName, // Nome de exibição do Google.
              "google-auth", // Senha placeholder, já que a autenticação é via Google.
              profile.id, // ID do Google.
              profile.emails && profile.emails.length > 0
                ? profile.emails[0].value
                : null, // Email do Google.
              profile.photos && profile.photos.length > 0
                ? profile.photos[0].value
                : null, // Foto do perfil do Google.
            ]
          );
          return cb(null, newUser.rows[0]); // Retorna o novo usuário para o Passport.
        }
      } catch (err) {
        // Se ocorrer um erro.
        console.error("Erro na estratégia Google OAuth:", err); // Exibe o erro no console.
        return cb(err); // Retorna o erro.
      }
    }
  )
);

// Serializa o usuário para armazená-lo na sessão.
passport.serializeUser((user, cb) => {
  // Armazena apenas o ID do usuário na sessão para mantê-la leve.
  cb(null, user.id);
});

// Desserializa o usuário para recuperá-lo da sessão a cada requisição.
passport.deserializeUser(async (id, cb) => {
  try {
    // Busca o usuário completo no banco de dados usando o ID armazenado na sessão.
    const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
    if (result.rows.length > 0) {
      // Se o usuário for encontrado.
      const user = result.rows[0];
      cb(null, user); // Retorna o objeto do usuário, que será anexado a `req.user`.
    } else {
      // Se o usuário não for encontrado.
      cb(new Error("Usuário não encontrado durante desserialização.")); // Retorna um erro.
    }
  } catch (err) {
    // Se ocorrer um erro no banco de dados.
    cb(err); // Retorna o erro.
  }
});

// --- Rotas POST para Operações CRUD (Protegidas por user_id) ---

// Rota para adicionar uma nova tarefa.
app.post("/add", async (req, res) => {
  if (!req.isAuthenticated()) {
    // Verifica se o usuário está autenticado.
    return res.redirect("/login"); // Se não, redireciona para o login.
  }
  const item = req.body.newItem; // Pega o texto da nova tarefa do formulário.
  const userId = req.user.id; // Pega o ID do usuário logado.

  try {
    // Insere a nova tarefa no banco de dados, associando-a ao usuário.
    await db.query("INSERT INTO items (title, user_id) VALUES ($1, $2)", [
      item,
      userId,
    ]);
    res.redirect("/dashboard"); // Redireciona de volta para o dashboard.
  } catch (erro) {
    // Se ocorrer um erro.
    console.error("Erro ao adicionar Tarefa:", erro); // Exibe o erro no console.
    res.status(500).send("Erro ao adicionar a Tarefa."); // Envia uma resposta de erro 500.
  }
});

// Rota para editar uma tarefa existente.
app.post("/edit", async (req, res) => {
  if (!req.isAuthenticated()) {
    // Verifica se o usuário está autenticado.
    return res.redirect("/login"); // Se não, redireciona para o login.
  }
  const idAtualizar = req.body.updatedItemId; // Pega o ID da tarefa a ser atualizada.
  const newDescription = req.body.updatedItemTitle; // Pega o novo texto da tarefa.
  const userId = req.user.id; // Pega o ID do usuário logado.

  try {
    // Atualiza a tarefa no banco de dados, garantindo que a tarefa pertence ao usuário logado.
    await db.query(
      "UPDATE items SET title = $1 WHERE id = $2 AND user_id = $3;",
      [newDescription, idAtualizar, userId]
    );
    res.redirect("/dashboard"); // Redireciona de volta para o dashboard.
  } catch (erro) {
    // Se ocorrer um erro.
    console.error("Erro ao atualizar Tarefa:", erro); // Exibe o erro no console.
    res.status(500).send("Erro ao atualizar Tarefa."); // Envia uma resposta de erro 500.
  }
});

// Rota para deletar uma tarefa.
app.post("/delete", async (req, res) => {
  if (!req.isAuthenticated()) {
    // Verifica se o usuário está autenticado.
    return res.redirect("/login"); // Se não, redireciona para o login.
  }
  const idDelete = req.body.deleteItemId; // Pega o ID da tarefa a ser deletada.
  const userId = req.user.id; // Pega o ID do usuário logado.

  try {
    // Deleta a tarefa do banco de dados, garantindo que a tarefa pertence ao usuário logado.
    await db.query("DELETE FROM items WHERE id = $1 AND user_id = $2;", [
      idDelete,
      userId,
    ]);
    res.redirect("/dashboard"); // Redireciona de volta para o dashboard.
  } catch (erro) {
    // Se ocorrer um erro.
    console.error("Erro ao deletar Tarefa:", erro); // Exibe o erro no console.
    res.status(500).send("Erro ao deletar Tarefa."); // Envia uma resposta de erro 500.
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`); // Inicia o servidor e o faz escutar na porta definida.
});
