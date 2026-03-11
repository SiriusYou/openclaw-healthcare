import { bootstrapTriggers } from "./bootstrap"

async function main() {
  await bootstrapTriggers()
  process.exit(0)
}

main().catch((err) => {
  console.error("Bootstrap failed:", err)
  process.exit(1)
})
