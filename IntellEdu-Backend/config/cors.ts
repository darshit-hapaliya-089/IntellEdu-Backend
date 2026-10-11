import { defineConfig } from '@adonisjs/cors'

/*
|--------------------------------------------------------------------------
| CORS Configuration
|--------------------------------------------------------------------------
| Allow the IntellEdu frontend (Vite dev server on :5173) to
| communicate with this API.
*/
const corsConfig = defineConfig({
  enabled: true,
  origin: ['https://intell-edu.vercel.app', 'http://localhost:5173'],
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  headers: true,
  exposeHeaders: [],
  credentials: true,
  maxAge: 90,
})

export default corsConfig
