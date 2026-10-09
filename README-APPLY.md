# Aplicar Roni Bloque 1

Este ZIP es un **overlay** preparado sobre el commit base `2a443c01e9f615dfe46fc3262c02c56f98b0a5d0` de `demontelau-pixel/Roni-app`.

1. Cree una rama de respaldo del proyecto actual.
2. Extraiga este ZIP en la raíz del repositorio Roni, preservando las carpetas:

   ```bash
   unzip -o Roni-block1-functional-overlay.zip -d /ruta/a/Roni-app
   cd /ruta/a/Roni-app
   npm ci
   npm run lint
   npm run build
   ```

3. Aplique la migración nueva con `npx supabase db push` si su proyecto está vinculado al CLI, o ejecute `supabase/migrations/0010_policy_chat_turns.sql` en el SQL Editor de Supabase.
4. Configure las variables de Vercel mediante su interfaz segura y despliegue. Consulte `docs/BLOCK-1-DEPLOY.md` para el procedimiento completo; no pegue secretos en archivos ni en chat.

El ZIP no contiene `node_modules`, `.next`, `.git`, `.env.local`, ni secretos.
