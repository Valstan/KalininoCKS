import { createRequire } from 'node:module'

// Безопасный revalidatePath/Tag (паттерн перенесён из GONBA).
// Тихо ничего не делает вне Next-рантайма (тесты, скрипты, сборка без сервера),
// где модуль next/cache недоступен или вызов вне контекста запроса бросает.

type NextCacheModule = {
  revalidatePath?: (path: string, type?: 'layout' | 'page') => void
  revalidateTag?: (tag: string) => void
}

const require = createRequire(import.meta.url)
let cachedModule: NextCacheModule | null | undefined

const getNextCacheModule = (): NextCacheModule | null => {
  if (cachedModule !== undefined) return cachedModule
  try {
    cachedModule = require('next/cache') as NextCacheModule
  } catch {
    cachedModule = null
  }
  return cachedModule
}

export const safeRevalidatePath = (path: string, type?: 'layout' | 'page') => {
  const mod = getNextCacheModule()
  if (!mod?.revalidatePath) return
  try {
    mod.revalidatePath(path, type)
  } catch {
    // вне Next-рантайма — игнорируем
  }
}

