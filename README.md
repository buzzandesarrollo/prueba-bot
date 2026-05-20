# Gacha Discord Bot

Bot de Discord para un sistema de gacha basado en tiradas individuales y de aldea, con premios por rareza, historial de reclamaciones y sistema de permisos configurable.

## Requisitos

- Node.js 18+
- Supabase project
- Discord Bot Token

## Instalacion

```bash
npm install
```

### Variables de entorno

Crea un archivo `.env` basado en `.env.example`:

```env
DISCORD_TOKEN=tu_token_aqui
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_anon_key_aqui
USER_BANNER_URL=https://ejemplo.com/banner-generico.png
```

| Variable | Descripcion |
|---|---|
| `DISCORD_TOKEN` | Token del bot de Discord |
| `SUPABASE_URL` | URL de tu proyecto Supabase |
| `SUPABASE_ANON_KEY` | Clave anonima de Supabase |
| `USER_BANNER_URL` | URL de la imagen banner generica para perfiles de usuario |

## Base de datos

Ejecuta `schema.sql` en el SQL Editor de Supabase:

```sql
-- Ejecutar schema.sql completo
```

Luego aplica las migraciones pendientes:

```sql
-- Columnas nuevas
alter table users add column if not exists last_claim_at timestamptz;
alter table villages add column if not exists banner_url text;
alter table roll_assignments add column if not exists assigned_by_username text;

-- Indices
create index if not exists idx_users_last_claim_at on users(last_claim_at);
create index if not exists idx_roll_assignments_assigned_at on roll_assignments(assigned_at desc);
create index if not exists idx_authorized_roles_discord_role_id on authorized_roles(discord_role_id);
```

### Tablas

| Tabla | Descripcion |
|---|---|
| `villages` | Aldeas con tiradas compartidas y banner |
| `users` | Usuarios registrados con tiradas individuales |
| `rewards` | Pool de premios con rareza y peso |
| `reward_claims` | Historial de premios reclamados |
| `roll_assignments` | Log de auditoria de asignaciones |
| `authorized_roles` | Roles de Discord con permisos especificos |

### Roles autorizados

Agrega los roles que pueden usar comandos administrativos:

```sql
-- Rol admin: asignar tiradas + ver auditoria
insert into authorized_roles (discord_role_id, role_name, can_assign_rolls, can_view_audit)
values ('ROLE_ID', 'Admin', true, true);

-- Rol moderador: solo asignar tiradas
insert into authorized_roles (discord_role_id, role_name, can_assign_rolls, can_view_audit)
values ('ROLE_ID', 'Moderador', true, false);

-- Rol auditor: solo ver log
insert into authorized_roles (discord_role_id, role_name, can_assign_rolls, can_view_audit)
values ('ROLE_ID', 'Auditor', false, true);
```

## Comandos

### Usuarios

| Comando | Descripcion |
|---|---|
| `/registrar [aldea]` | Registra al usuario y asigna aldea opcional |
| `/perfil` | Muestra perfil del usuario con historial individual y banner generico |
| `/perfil_aldea` | Muestra perfil de la aldea con historial de tiradas de aldea y banner de aldea |
| `/reclamar [fuente] [cantidad]` | Consume tiradas y obtiene premios |

**Opciones de `/reclamar`:**

| Opcion | Tipo | Default | Descripcion |
|---|---|---|---|
| `fuente` | `individual` / `village` | Auto | Tipo de tirada a consumir |
| `cantidad` | 1-10 | 1 | Cantidad de premios a reclamar |

**Cooldown:** 5 minutos por usuario entre cada uso de `/reclamar`.

### Administrativos (requieren permiso en `authorized_roles`)

| Comando | Permiso | Descripcion |
|---|---|---|
| `/asignar @usuario cantidad` | `can_assign_rolls` | Asigna tiradas individuales |
| `/asignar_aldea aldea cantidad` | `can_assign_rolls` | Asigna tiradas a una aldea |
| `/auditoria [limite]` | `can_view_audit` | Lista asignaciones con fecha, autor y destino |
| `/banner_aldea aldea url` | `can_assign_rolls` | Establece el banner de una aldea |

## Sistema de rarezas

| Rareza | Peso default | Emoji |
|---|---|---|
| `Comun` | 50 | 🔵 |
| `Raro` | 25 | 🟢 |
| `Epico` | 10 | 🟣 |
| `Legendario` | 3 | 🟡 |
| `Mitico` | 1 | 🔴 |

Los pesos determinan la probabilidad de obtener cada premio. Se pueden configurar por premio individual en la tabla `rewards`.

## Flujo de uso

1. **Registro:** Los usuarios se registran con `/registrar` y se asignan a una aldea
2. **Asignacion:** Un admin/moderador asigna tiradas con `/asignar` o `/asignar_aldea`
3. **Reclamo:** Los usuarios usan `/reclamar` para obtener premios
4. **Consulta:** Los usuarios revisan su historial con `/perfil` o `/perfil_aldea`
5. **Auditoria:** Los authorized roles revisan asignaciones con `/auditoria`

## Prioridad de consumo

Cuando no se especifica `fuente` en `/reclamar`:
1. Primero consume tiradas individuales
2. Si no hay, consume tiradas de aldea

## Desarrollo

```bash
# Compilar TypeScript
npm run build

# Ejecutar bot
npm start

# Deploy slash commands
npm run deploy
```

## Estructura

```
src/
├── commands/
│   ├── asignar.ts          # Asignar tiradas individuales
│   ├── asignar_aldea.ts    # Asignar tiradas a aldea
│   ├── auditoria.ts        # Log de asignaciones
│   ├── banner_aldea.ts     # Banner de aldea
│   ├── perfil.ts           # Perfil de usuario
│   ├── perfil_aldea.ts     # Perfil de aldea
│   ├── reclamar.ts         # Reclamar premios
│   └── registrar.ts        # Registro de usuario
├── events/
│   ├── ready.ts
│   └── interactionCreate.ts
├── handlers/
│   └── commandHandler.ts
├── services/
│   ├── gacha.ts            # Logica de premios ponderados
│   └── supabase.ts         # Cliente Supabase
├── types/
│   └── index.ts
└── utils/
    └── permissions.ts      # Sistema de permisos
```
