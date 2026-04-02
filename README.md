# CTIA03

Plataforma privada de estudos com autenticação restrita, conteúdo em Markdown, artefatos interativos e integração com Gemini.

## Stack de produção

- `app`: Node.js + Express servindo frontend e backend na mesma aplicação
- `db`: PostgreSQL 16 com volume persistente
- `docker-compose.yml`: publica apenas a aplicação no host

## Porta escolhida para deploy

Depois da auditoria da VPS, a porta pública escolhida para esta stack foi `3010`.

Motivo:

- `80`, `443`, `3000`, `3300`, `6379`, `8000`, `8025`, `8089` e `8100` já estavam ocupadas
- `3010` estava livre e mantém o serviço próximo do range web sem conflitar com Dokploy

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```bash
cp .env.example .env
```

Obrigatórias:

- `APP_PORT`
- `PORT`
- `APP_URL`
- `GEMINI_API_KEY`
- `APP_OWNER_EMAIL`
- `APP_OWNER_PASSWORD`
- `APP_MEMBER_EMAIL`
- `APP_MEMBER_PASSWORD`
- `SESSION_SECRET`
- `DATABASE_SSL`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`

## Subir localmente com Docker Compose

```bash
docker compose up --build
```

Aplicação:

- `http://localhost:3010`

Healthcheck:

- `http://localhost:3010/healthz`

## Deploy posterior na VPS

Quando você decidir subir no servidor:

```bash
docker compose up -d --build
```

## Observações

- o banco não é publicado no host
- a aplicação usa `3010:3000`
- a sessão é privada e renovada por atividade
- o login continua restrito aos dois usuários definidos no `.env`
