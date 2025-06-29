# Task CRUD

Um simples gerenciador de tarefas (CRUD - Create, Read, Update, Delete) com autenticação de usuários.

## Visão Geral

Este projeto é uma aplicação web desenvolvida para permitir que os usuários se registrem, façam login e gerenciem suas próprias listas de tarefas. A aplicação oferece tanto a autenticação local (email e senha) quanto a autenticação via Google.

**Acesse a aplicação em produção aqui:**   [Gerenciador de Tarefas](https://task-crud-camilo-70504f57f090.herokuapp.com/)

## Funcionalidades

*   **Autenticação de Usuário:**
    *   Registro de novos usuários com email e senha.
    *   Login com credenciais locais.
    *   Login integrado com contas Google (OAuth 2.0).
    *   Sessões de usuário persistentes.
*   **Gerenciamento de Tarefas (CRUD):**
    *   **Criar:** Adicionar novas tarefas à lista.
    *   **Ler:** Visualizar a lista de tarefas.
    *   **Atualizar:** Editar o conteúdo de tarefas existentes.
    *   **Deletar:** Remover tarefas da lista.

## Tecnologias Utilizadas

*   **Back-end:**
    *   [Node.js](https://nodejs.org/)
    *   [Express.js](https://expressjs.com/)
*   **Front-end:**
    *   [EJS](https://ejs.co/) (Embedded JavaScript templates)
*   **Banco de Dados:**
    *   [PostgreSQL](https://www.postgresql.org/)
*   **Autenticação:**
    *   [Passport.js](http://www.passportjs.org/)
        *   `passport-local`
        *   `passport-google-oauth2`
*   **Segurança:**
    *   [bcrypt](https://www.npmjs.com/package/bcrypt) para hashing de senhas.

## Como Executar Localmente

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/Camiloruas/task-CRUD.git
    cd task-CRUD
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    ```

3.  **Configure as variáveis de ambiente:**
    Crie um arquivo `.env` na raiz do projeto e adicione as seguintes variáveis (substitua pelos seus próprios valores):
    ```
    DATABASE_URL=postgresql://user:password@host:port/database
    SESSION_SECRET=sua_chave_secreta_de_sessao
    GOOGLE_CLIENT_ID=seu_google_client_id
    GOOGLE_CLIENT_SECRET=seu_google_client_secret
    GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/secrets
    ```

4.  **Inicie o servidor:**
    ```bash
    npm start
    ```
    A aplicação estará disponível em `http://localhost:3000`.
