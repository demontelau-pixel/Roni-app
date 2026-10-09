# Roni — Bloque 1 funcional: PDF → IA → Wallet → Ask Roni

> **Objetivo:** completar el flujo inicial de pólizas de auto sin simular inteligencia artificial: cuenta autenticada → carga privada de PDF → job persistente → extracción real con Anthropic → Wallet verificable → Ask Roni basado en el PDF.

## Qué reutiliza esta entrega

Esta entrega **no crea ni reemplaza** un proyecto nuevo. Parte del repositorio existente `demontelau-pixel/Roni-app` (base revisada: `2a443c0`) y conserva:

- Next.js 15, React 19 y Tailwind.
- Supabase Auth, RLS, tablas y Storage privado.
- Carga directa a Supabase Storage para PDFs de hasta 15 MB.
- Cola durable `policy_analysis_jobs`, recuperación de trabajos interrumpidos y protección contra duplicados.
- Extracción PDF nativa con Anthropic desde el servidor.

Agrega o corrige:

1. **Ask Roni real.** El servidor descarga únicamente el PDF privado que pertenece a la póliza seleccionada y lo envía a Anthropic como documento PDF. No utiliza coincidencias de palabras como comportamiento de producción.
2. **Respuestas separadas y citadas.** La interfaz diferencia: *What your policy says*, *General explanation* y *What Roni can't determine*. Una afirmación sobre la póliza se bloquea si Roni no puede confirmar que su fragmento aparece en la página citada; las referencias no verificadas se etiquetan como tales.
3. **Resistencia a prompt injection.** El prompt del proveedor especifica que toda instrucción dentro del PDF es texto no confiable y nunca una orden para el sistema.
4. **Historial persistente privado.** La migración `0010_policy_chat_turns.sql` guarda la pregunta y la respuesta estructurada, no el PDF, una URL firmada ni la respuesta cruda del proveedor. RLS y un trigger verifican que cada turno pertenezca al dueño de la póliza.
5. **Campos de auto ampliados.** Esquema `auto.v3` para moneda explícita, prima recurrente, prima total, cuotas/frecuencia, coberturas adicionales, exclusiones, condiciones, endosos y contacto de reclamos. Los campos ausentes quedan en `null` o listas vacías.
6. **Wallet basada en datos efectivos.** Las tarjetas ahora usan los datos extraídos/corregidos, muestran vencimiento y no dependen de columnas de resumen vacías.
7. **Worker sin secreto duplicado.** El workflow pasa de un `CRON_SECRET` compartido a GitHub Actions OIDC: GitHub emite un token de vida corta y Vercel verifica firma, issuer, audience, repositorio y workflow exacto de `main`.

## Por qué cambia la autenticación del worker

El diagnóstico previo ya demostró que el encabezado llega bien, que el formato Bearer es correcto y que los dos valores efectivos de 64 caracteres tienen huellas distintas. Eso confirma un desacople de configuración entre GitHub Actions y Vercel; no prueba un despliegue antiguo ni se arregla regenerando secretos repetidamente.

El nuevo diseño elimina ese punto de fallo para el workflow de GitHub:

```text
GitHub Actions programado
  └─ solicita token OIDC de corta duración (audience: roni-analysis-worker)
       └─ POST /api/cron/process-analysis-jobs con Bearer <OIDC JWT>
            └─ Vercel verifica firma GitHub + issuer + audience + repositorio + workflow@main
                 └─ procesa hasta 3 jobs de análisis
```

- No se transmite ni compara `CRON_SECRET` entre GitHub y Vercel.
- La ruta conserva `CRON_SECRET` **solo** para un scheduler manual o externo legado.
- Un token de otro repositorio, otra rama o cualquier workflow distinto se rechaza con `401`.

## Cambios de base de datos

Si las migraciones `0001`–`0009` ya están aplicadas, aplique únicamente:

```text
supabase/migrations/0010_policy_chat_turns.sql
```

Si está configurado Supabase CLI y el proyecto ya está vinculado, el camino de menor fricción es ejecutar, desde la raíz del repositorio:

```bash
npx supabase db push
```

Esto aplica las migraciones pendientes en orden. No hay `DROP TABLE`, no se eliminan pólizas, documentos ni extracciones existentes.

## Configuración segura requerida

Configure estas variables en **Vercel → Project → Settings → Environment Variables**; no las copie en chat, código ni variables `NEXT_PUBLIC_*`.

| Variable | Alcance | Motivo |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production + Preview según corresponda | Cliente Supabase público. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Production + Preview según corresponda | Cliente Supabase público, protegido por RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | Worker de jobs; nunca exponer al navegador. |
| `ANTHROPIC_API_KEY` | Production | Extracción real y Ask Roni del lado servidor. |
| `ANTHROPIC_EXTRACTION_MODEL` | Opcional | Modelo de extracción; por defecto `claude-sonnet-5`. |
| `ANTHROPIC_ASK_MODEL` | Opcional | Modelo de Ask Roni; por defecto `claude-sonnet-5-5`. |

Para el workflow OIDC no hace falta configurar una clave. Estos valores no secretos tienen defaults seguros para este repositorio, pero pueden declararse en Vercel si se desea explicitar la configuración:

```text
GITHUB_ACTIONS_OIDC_AUDIENCE=roni-analysis-worker
GITHUB_ACTIONS_OIDC_REPOSITORY=demontelau-pixel/Roni-app
GITHUB_ACTIONS_OIDC_WORKFLOW_REF=demontelau-pixel/Roni-app/.github/workflows/process-analysis-jobs.yml@refs/heads/main
```

En GitHub Actions conserve o cree únicamente `RONI_APP_URL` con:

```text
https://roni-app-ivory.vercel.app
```

El archivo `.github/workflows/process-analysis-jobs.yml` ya solicita `id-token: write`. El secreto de GitHub `CRON_SECRET` deja de ser necesario para este workflow y puede retirarse cuando el primer run OIDC sea exitoso.

## Aplicación del ZIP y despliegue

1. Descomprima el paquete en una copia de trabajo del repositorio actual, preservando la estructura de carpetas.
2. Revise los cambios y las migraciones pendientes.
3. Ejecute:

   ```bash
   npm ci
   npm run lint
   npm run build
   ```

4. Aplique la migración de Supabase indicada arriba.
5. Configure las variables de Vercel usando su interfaz segura y despliegue desde `main`.
6. En GitHub, abra **Actions → Procesar polizas Roni → Run workflow** para disparar una prueba manual del worker OIDC.

No se debe subir `.env.local`, claves de Anthropic, claves service-role ni secretos de Vercel a GitHub.

## Prueba de aceptación con un PDF sintético

Use una póliza ficticia sin datos personales para probar producción:

1. Cree una cuenta de prueba e inicie sesión.
2. Suba un PDF de auto de hasta 15 MB.
3. Confirme que el documento abre únicamente para esa cuenta y que la Wallet muestra **Queued/Processing**.
4. Espere el próximo workflow de cinco minutos, o ejecútelo manualmente.
5. Confirme que aparecen aseguradora, fechas, prima, vehículos, límites, deducibles y las referencias de página que el documento sustente. Los campos no presentes deben seguir como **Not determined**.
6. Edite un dato manualmente y vuelva a ejecutar el análisis: la corrección manual debe prevalecer en la vista efectiva.
7. Abra **Ask Roni about this policy** y pruebe:

   - `What's my collision deductible?`
   - `When does this policy expire?`
   - `What does this policy cover and exclude?`
   - `Do I have coverage if another person drives?`

8. Verifique que la respuesta separe lo que dice la póliza de lo que no se puede determinar y que no garantice la cobertura de un reclamo incompleto.
9. Cree una segunda cuenta de prueba y verifique que no puede abrir la URL de la póliza, PDF, análisis ni historial de la primera cuenta.

## Costos y límites reales

| Concepto | ¿Obligatorio para el flujo real? | Nota |
|---|---:|---|
| Supabase | Sí | Auth, Postgres y Storage privado. Puede iniciar dentro de límites gratuitos, sujetos al plan de Supabase. |
| Vercel | Sí | Hosting y ruta del worker. El workflow externo evita requerir Vercel Cron frecuente en Hobby. |
| Anthropic API | Sí | Cada extracción PDF y cada pregunta de Ask Roni consume API; no debe prometerse que sea gratuito. |
| GitHub Actions OIDC | Sí para el scheduler incluido | No requiere guardar una copia de `CRON_SECRET`; su disponibilidad depende de los límites del plan de GitHub. |
| Vercel Pro / cron nativo | No | Solo opción futura si se prefiere Vercel Cron. |

Restricciones iniciales explícitas:

- Solo PDF, con límite de 15 MB en Storage.
- El modelo recibe el PDF para interpretación; no hay un motor propio de OCR/IA entrenado desde cero.
- Documentos escaneados o tablas complejas pueden terminar como **Requires review** si el modelo no puede sustentarlos con seguridad.
- La extracción y el dashboard admiten múltiples vehículos y conductores. El formulario manual inicial permite corregir un vehículo y un conductor; úselo para correcciones puntuales, no para reorganizar una lista de varios elementos hasta que se incorpore la edición multi-fila.
- El flujo actual es de pólizas de auto; no inventa cotizaciones, planes ni comparaciones de mercado.

## Validación realizada en esta entrega

- `npm run lint` terminó correctamente después de las correcciones finales.
- `npm run build` terminó correctamente después de las correcciones finales, con verificación de tipos y 28 rutas generadas.
- Prueba local de la ruta worker:
  - sin encabezado → `401`;
  - Bearer inválido → `401`;
  - Bearer legado correcto → supera autenticación y falla de forma segura con `500` al faltar intencionalmente las credenciales Supabase locales.

No se ejecutó una extracción ni pregunta real contra Anthropic, ni una migración contra Supabase de producción, porque esta sesión no tiene acceso a las credenciales ni a los proyectos Vercel/Supabase/GitHub. Esas verificaciones siguen pendientes después de configurar los secretos por la interfaz segura y desplegar.
