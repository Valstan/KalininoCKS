/**
 * Обёртка запуска standalone-бандла. Она НЕ заменяет shutdown фреймворка, а достраивает его.
 *
 * Что Next 15.4.11 делает сам (next/dist/server/lib/start-server.js:356-359): вешает
 * SIGINT/SIGTERM, зовёт server.close(), дожидается in-flight, потом nextServer.close()
 * и process.exit(0). Это работает, и ломать это нельзя.
 *
 * Чего он в проде не делает — ради этого файл и существует:
 *  1. closeAllConnections/closeIdleConnections стоят под `if (isDev)` (строка 340).
 *     В проде соединение, которое дописало ответ уже ПОСЛЕ начала остановки, остаётся
 *     висеть в keep-alive, и server.close() ждёт его до keepAliveTimeout — у нас это
 *     KEEP_ALIVE_TIMEOUT=65000. Замерено: один такой сокет держит остановку 65 с.
 *     Слушающий сокет при этом уже закрыт, systemd не поднимает новый процесс, а nginx
 *     (upstream-пула нет, каждый запрос — свой коннект) всё это время отдаёт 502.
 *  2. Форс-выхода по таймауту нет вообще, повторный сигнал — no-op (guard, строка 323).
 *     Единственный ограничитель — systemd TimeoutStopSec, по умолчанию 90 с.
 *  3. server.headersTimeout не выставляется нигде: Next трогает только keepAliveTimeout.
 *
 * ЧЕГО ЗДЕСЬ СОЗНАТЕЛЬНО НЕТ:
 *  - своего server.close(): его колбэк и колбэк Next висят на одном событии 'close',
 *    и тот, кто отработает первым, вызовет process.exit — оборвав nextServer.close()
 *    фреймворка. Это и есть «гонка двух cleanup'ов» из амендмента G234;
 *  - периодического closeIdleConnections(): замерено — вызов, попавший в момент сразу
 *    после отдачи ответа, рвёт сокет по RST, и клиент теряет уже полученное тело
 *    (в трёх прогонах подряд — два потерянных ответа). Вместо этого сокет закрывается
 *    по FIN ровно тогда, когда его ответ дописан (см. ниже).
 *
 * Ссылку на http.Server Next наружу не отдаёт ни одним публичным API, а
 * process._getActiveHandles() — приватный и негарантированный. Берём детерминированно:
 * start-server.js:241 зовёт `_http.default.createServer(...)`, где `_http.default` —
 * живой объект модуля http, а свойство резолвится в момент вызова. Значит подмена
 * свойства до импорта server.js гарантированно перехватывает единственный экземпляр.
 */

import { createRequire } from 'node:module'

// Бандл помечен "type": "module", но start-server.js — CJS и делает require("http").
// createRequire отдаёт ровно тот же объект модуля, который увидит Next.
const require = createRequire(import.meta.url)
const http = require('http')

const TAG = '[graceful]'

/** Потолок ожидания текущих ответов. Дальше выходим сами, не дожидаясь SIGKILL от systemd. */
const DRAIN_MS = positiveInt(process.env.SHUTDOWN_DRAIN_MS) ?? 15_000

/** Если http.Server не появился за это время — Next упал ещё до listen. */
const CAPTURE_TIMEOUT_MS = 30_000

function positiveInt(raw) {
  const value = Number.parseInt(raw ?? '', 10)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

let captured = null
let shuttingDown = false

// Не отказ, а тревога: сайт должен подняться в любом случае, но в журнале обязана
// остаться причина, почему drain вдруг не работает (например, апгрейд Next сменил
// способ создания сервера).
const captureGuard = setTimeout(() => {
  console.warn(`${TAG} http.Server не перехвачен за ${CAPTURE_TIMEOUT_MS} мс — drain НЕ установлен`)
}, CAPTURE_TIMEOUT_MS)
captureGuard.unref()

function adopt(server) {
  captured = server
  clearTimeout(captureGuard)

  // keepAliveTimeout Next присваивает сразу после createServer (строки 242-244),
  // поэтому читаем его на 'listening' — иначе увидели бы дефолт Node, а не значение
  // из KEEP_ALIVE_TIMEOUT. headersTimeout держим строго больше: при инверсии
  // (headers < keepAlive) сокет на части версий Node отваливается раньше срока,
  // и прокси получает обрыв на ровном месте.
  server.once('listening', () => {
    if (server.keepAliveTimeout > 0) {
      server.headersTimeout = server.keepAliveTimeout + 1_000
    }
    console.info(
      `${TAG} listening: keepAliveTimeout=${server.keepAliveTimeout}мс ` +
        `headersTimeout=${server.headersTimeout}мс drain=${DRAIN_MS}мс`,
    )
  })

  // Ключевая часть. Сокет берём из req: к моменту 'finish' у res он уже отвязан
  // (res.socket === null — проверено), а end() вместо destroy() шлёт FIN после
  // фактического слива тела, поэтому ответ доезжает целиком. Пока остановка не
  // началась, хук не делает ничего.
  server.on('request', (req, res) => {
    const socket = req.socket
    res.on('finish', () => {
      if (shuttingDown && socket && !socket.destroyed) socket.end()
    })
  })

  // Сигналы вешаем только после перехвата: свой листенер отменяет дефолтное
  // завершение процесса, а до появления сервера ронять его как раз надо мгновенно.
  process.on('SIGTERM', () => onSignal('SIGTERM'))
  process.on('SIGINT', () => onSignal('SIGINT'))
}

function onSignal(signal) {
  if (shuttingDown) return
  shuttingDown = true

  const server = captured

  // Сигнал между createServer и listen: своих обработчиков у Next ещё нет (он вешает
  // их внутри колбэка 'listening'), отдавать нечего. Без явного выхода процесс завис бы.
  if (!server || !server.listening) {
    console.info(`${TAG} ${signal} до listen — выходим немедленно`)
    process.exit(0)
    return
  }

  // Считаем листенеры В МОМЕНТ СИГНАЛА, а не на старте: колбэк 'listening' у Next
  // асинхронный, на старте регистрация могла ещё не случиться. Больше одного (нашего)
  // — фреймворковый обработчик жив, close() за ним. Это проверка ФАКТА, а не строки
  // в бандле, чего и требует амендмент G234; заодно это видно в журнале при каждой
  // остановке, так что апгрейд Next, сломавший допущение, обнаружится сам.
  const frameworkOwnsClose = process.listenerCount(signal) > 1

  console.info(
    `${TAG} ${signal}: drain до ${DRAIN_MS} мс; close() ` +
      (frameworkOwnsClose
        ? 'за Next (обработчик фреймворка активен)'
        : 'за нами (обработчик Next не найден)'),
  )

  setTimeout(() => {
    console.warn(`${TAG} drain не уложился в ${DRAIN_MS} мс — принудительный выход`)
    // Выходим нулём: для systemd это штатная остановка. Ненулевой код дал бы
    // Result=exit-code на каждом затянувшемся деплое и зашумил бы мониторинг,
    // а сам факт форс-выхода ищется в журнале по строке выше.
    process.exit(0)
  }, DRAIN_MS)

  // Разовый вызов безопасен: соединение, у которого ответ ещё не отдан, Node idle-ным
  // не считает (проверено на пяти точках внутри обработки запроса). На Node >= 19
  // то же самое делает и сам server.close(), так что это страховка для Node 18.
  server.closeIdleConnections()

  if (frameworkOwnsClose) return

  // Резервный путь: NEXT_MANUAL_SIG_HANDLE выставлен извне либо апгрейд Next убрал
  // фреймворковый обработчик. Иначе сервер не закрыл бы никто и мы досидели бы до
  // форс-выхода.
  server.close(() => {
    console.info(`${TAG} все соединения закрыты, выходим`)
    process.exit(0)
  })
}

const createServerOriginal = http.createServer
http.createServer = function gracefulCreateServer(...args) {
  const server = createServerOriginal.apply(this, args)
  // Патч одноразовый: в прод-пути http.Server ровно один (render-server.js:99 передаёт
  // вниз тот же экземпляр), а снятый патч не может задеть ничего стороннего.
  http.createServer = createServerOriginal
  adopt(server)
  return server
}

console.info(`${TAG} обёртка активна, запускаем server.js`)

// Резолвим от URL модуля, а не от cwd: server.js внутри делает process.chdir,
// полагаться на текущий каталог нельзя.
try {
  await import(new URL('./server.js', import.meta.url).href)
} catch (error) {
  console.error(`${TAG} не удалось запустить server.js`, error)
  // Ненулевой код обязателен: иначе Restart=on-failure не поднимет сервис и сайт ляжет молча.
  process.exit(1)
}
