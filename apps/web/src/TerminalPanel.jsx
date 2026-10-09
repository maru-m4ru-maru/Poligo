import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

const TerminalPanel = forwardRef(function TerminalPanel(
  {
    apiUrl,
    projectId,
    active
  },
  ref
) {
  const containerRef = useRef(null)
  const terminalRef = useRef(null)
  const fitRef = useRef(null)
  const socketRef = useRef(null)
  const sessionIdRef = useRef('')
  const connectingRef = useRef(false)
  const activeRef = useRef(active)
  const pendingInputRef = useRef('')
  const connectionStatusRef = useRef('connecting')
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const [connectionMessage, setConnectionMessage] = useState('')
  const [connectionAttempt, setConnectionAttempt] = useState(0)

  function updateConnectionStatus(status, message = '') {
    connectionStatusRef.current = status
    setConnectionStatus(status)
    setConnectionMessage(message)
  }

  useImperativeHandle(ref, () => ({
    write(value) {
      terminalRef.current?.write(String(value || ''))
    },

    writeln(value) {
      terminalRef.current?.writeln(String(value || ''))
    },

    clear() {
      terminalRef.current?.clear()
    }
  }), [])

  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    const terminal = new XTerm({
      allowProposedApi: true,
      cursorBlink: true,
      cursorStyle: 'bar',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.25,
      scrollback: 5000,
      convertEol: false,
      theme: {
        background: '#10100e',
        foreground: '#e4e4dd',
        cursor: '#eeeeea',
        selectionBackground: '#34342f',
        black: '#11110e',
        red: '#c97770',
        green: '#91b37b',
        yellow: '#c7aa6b',
        blue: '#7798bd',
        magenta: '#a58db4',
        cyan: '#7ca8a8',
        white: '#d9d9d2',
        brightBlack: '#5f5f59',
        brightRed: '#de8a82',
        brightGreen: '#a8c991',
        brightYellow: '#dbc186',
        brightBlue: '#8aaed8',
        brightMagenta: '#bda4ce',
        brightCyan: '#91c0c0',
        brightWhite: '#f3f3ed'
      }
    })

    const fit = new FitAddon()

    terminal.loadAddon(fit)
    terminal.open(containerRef.current)
    terminalRef.current = terminal
    fitRef.current = fit

    const e2eEnabled = new URLSearchParams(window.location.search).get('e2e') === '1' ||
      sessionStorage.getItem('poligo-e2e') === '1'

    if (e2eEnabled) {
      window.__POLIGO_E2E_TERMINAL__ = {
        readText() {
          const buffer = terminal.buffer.active
          const lines = []

          for (let index = 0; index < buffer.length; index += 1) {
            lines.push(
              buffer.getLine(index)?.translateToString(true) || ''
            )
          }

          return lines.join('\\n')
        },
        focus() {
          terminal.focus()
        },
        status() {
          return {
            status: connectionStatusRef.current,
            socketReadyState: socketRef.current?.readyState ?? -1,
            sessionId: sessionIdRef.current
          }
        }
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      if (!activeRef.current) {
        return
      }

      const container = containerRef.current

      if (!container?.offsetWidth || !container?.offsetHeight) {
        return
      }

      try {
        fit.fit()
      } catch {}

      const socket = socketRef.current

      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'resize',
          cols: terminal.cols,
          rows: terminal.rows
        }))
      }
    })

    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()

      const socket = socketRef.current

      if (socket) {
        socket.close()
      }

      socketRef.current = null
      sessionIdRef.current = ''
      pendingInputRef.current = ''

      if (window.__POLIGO_E2E_TERMINAL__?.status) {
        delete window.__POLIGO_E2E_TERMINAL__
      }

      terminal.dispose()
      terminalRef.current = null
      fitRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!active || !terminalRef.current) {
      return
    }

    const fit = fitRef.current

    if (!fit) {
      return
    }

    window.requestAnimationFrame(() => {
      const container = containerRef.current

      if (!container?.offsetWidth || !container?.offsetHeight) {
        return
      }

      try {
        fit.fit()
      } catch {}
    })
  }, [active])

  useEffect(() => {
    const terminal = terminalRef.current

    if (!terminal) {
      return
    }

    const dispose = terminal.onData(data => {
      const socket = socketRef.current

      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'input',
          data
        }))
        return
      }

      if (socket?.readyState === WebSocket.CONNECTING) {
        if (
          new TextEncoder().encode(pendingInputRef.current + data).byteLength <= 65_536
        ) {
          pendingInputRef.current += data
        } else {
          terminal.write('\r\n\x1b[33m[input buffer full]\x1b[0m\r\n')
        }
      }
    })

    return () => {
      dispose.dispose()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let keepaliveTimer = null
    let syncTimer = null
    let syncInFlight = false

    async function connect() {
      if (
        cancelled ||
        !projectId ||
        !terminalRef.current ||
        connectingRef.current ||
        sessionIdRef.current
      ) {
        return
      }

      connectingRef.current = true
      const terminal = terminalRef.current
      pendingInputRef.current = ''
      updateConnectionStatus('connecting')
      terminal.clear()
      terminal.writeln('\x1b[90mPoligo Terminal\x1b[0m')
      terminal.writeln('Connecting to terminal service...')
      terminal.writeln('')

      try {
        const response = await fetch(
          apiUrl + '/api/terminal/sessions',
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              projectId
            })
          }
        )

        const body = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(
            body?.error ||
            response.status + ' ' + response.statusText
          )
        }

        if (typeof body?.id !== 'string' || !body.id) {
          throw new Error('terminal service returned an invalid session')
        }

        if (cancelled) {
          fetch(
            apiUrl + '/api/terminal/sessions/' +
              encodeURIComponent(body.id),
            {
              method: 'DELETE',
              credentials: 'include',
              keepalive: true
            }
          ).catch(() => {})
          return
        }

        sessionIdRef.current = body.id

        const websocketUrl = (
          apiUrl || window.location.origin
        ).replace(/^http/, 'ws') +
          '/api/terminal/sessions/' +
          encodeURIComponent(body.id)

        const socket = new WebSocket(websocketUrl)
        socket.binaryType = 'arraybuffer'
        socketRef.current = socket

        keepaliveTimer = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
              type: 'ping'
            }))
          }
        }, 25_000)

        syncTimer = window.setInterval(() => {
          const sessionId = sessionIdRef.current

          if (
            cancelled ||
            !sessionId ||
            syncInFlight
          ) {
            return
          }

          syncInFlight = true

          fetch(
            apiUrl + '/api/terminal/sessions/' +
              encodeURIComponent(sessionId) +
              '/sync',
            {
              method: 'POST',
              credentials: 'include'
            }
          )
            .catch(() => {})
            .finally(() => {
              syncInFlight = false
            })
        }, 15_000)

        socket.addEventListener('open', () => {
          if (cancelled) {
            socket.close()
            return
          }

          updateConnectionStatus('connected')
          const fit = fitRef.current

          if (fit) {
            try {
              fit.fit()
            } catch {}
          }

          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
              type: 'resize',
              cols: terminal.cols,
              rows: terminal.rows
            }))

            if (pendingInputRef.current) {
              socket.send(JSON.stringify({
                type: 'input',
                data: pendingInputRef.current
              }))
              pendingInputRef.current = ''
            }
          }
        })

        socket.addEventListener('message', event => {
          if (typeof event.data !== 'string') {
            return
          }

          let payload

          try {
            payload = JSON.parse(event.data)
          } catch {
            terminal.write(event.data)
            return
          }

          if (payload.type === 'output') {
            terminal.write(
              typeof payload.data === 'string'
                ? payload.data
                : ''
            )
            return
          }

          if (payload.type === 'exit') {
            terminal.write('\r\n\x1b[90m[terminal exited]\x1b[0m\r\n')
            updateConnectionStatus('exited', 'The shell session has ended.')
            return
          }

          if (payload.type === 'error') {
            const message = String(payload.message || 'terminal error')
            terminal.write('\r\n\x1b[31m' + message + '\x1b[0m\r\n')
            updateConnectionStatus('error', message)
          }
        })

        socket.addEventListener('error', () => {
          if (cancelled) {
            return
          }

          const message = 'Terminal connection failed.'
          terminal.write('\r\n\x1b[31m[' + message + ']\x1b[0m\r\n')
          updateConnectionStatus('error', message)
        })

        socket.addEventListener('close', () => {
          socketRef.current = null

          if (!cancelled && connectionStatusRef.current !== 'exited') {
            const message = 'Terminal disconnected. Reconnect to start a new session.'
            terminal.write('\r\n\x1b[90m[terminal disconnected]\x1b[0m\r\n')
            updateConnectionStatus('error', message)
          }
        })
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error
            ? error.message
            : 'terminal connection failed'

          terminal.write('\r\n\x1b[31m' + message + '\x1b[0m\r\n')
          updateConnectionStatus('error', message)
        }
      } finally {
        connectingRef.current = false
      }
    }

    void connect()

    return () => {
      cancelled = true

      if (keepaliveTimer !== null) {
        window.clearInterval(keepaliveTimer)
      }

      if (syncTimer !== null) {
        window.clearInterval(syncTimer)
      }

      const socket = socketRef.current
      const sessionId = sessionIdRef.current

      if (socket) {
        socket.close()
      }

      socketRef.current = null

      if (sessionId) {
        fetch(
          apiUrl + '/api/terminal/sessions/' +
            encodeURIComponent(sessionId),
          {
            method: 'DELETE',
            credentials: 'include',
            keepalive: true
          }
        ).catch(() => {})
      }

      sessionIdRef.current = ''
      connectingRef.current = false
    }
  }, [apiUrl, projectId, connectionAttempt])

  return (
    <div className="terminal-host">
      <div
        ref={containerRef}
        className="terminal"
        tabIndex={0}
        onClick={() => terminalRef.current?.focus()}
      />
      {['error', 'exited'].includes(connectionStatus) && (
        <div className="terminal-connection-overlay">
          <div className="terminal-connection-title">
            {connectionStatus === 'exited'
              ? 'Terminal session ended'
              : 'Terminal connection unavailable'}
          </div>
          <div className="terminal-connection-message">
            {connectionMessage || 'Reconnect to start a new terminal session.'}
          </div>
          <button
            type="button"
            onClick={() => {
              updateConnectionStatus('connecting')
              setConnectionAttempt(value => value + 1)
            }}
          >
            再接続
          </button>
        </div>
      )}
    </div>
  )
})

export default TerminalPanel
