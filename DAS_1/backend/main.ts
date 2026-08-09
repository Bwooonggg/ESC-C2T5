import { port } from './config.ts'
import { createApp } from './app.ts'

const app = createApp()

app.listen(port, () => {
  console.log(`Dev server running at http://localhost:${port}`)
})
