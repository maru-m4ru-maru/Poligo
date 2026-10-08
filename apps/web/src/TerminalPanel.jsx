import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef
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
        socket.send(
          JSON.stringify({
            type: 'resize',
            cols: terminal.cols,
            rows: terminal.rows
          })
        )
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

      if (socket?.readyState !== WebSocket.OPEN) {
        return
      }

      socket.send(
        JSON.stringify({
          type: 'input',
          data
        })
      )
    })

    return () => {
      dispose.dispose()
    }
  }, [])

  useEffect(() => {
    let cancelled = false

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
      terminal.clear()
      terminal.writeln('\x1b[90mPoligo Terminal\x1b[0m')
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

        socket.addEventListener('open', () => {
          const fit = fitRef.current

          if (fit) {
            try {
              fit.fit()
            } catch {}
          }

          if (socket.readyState === WebSocket.OPEN) {
            socket.send(
              JSON.stringify({
                type: 'resize',
                cols: terminal.cols,
                rows: terminal.rows
              })
            )
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
            terminal.write(
              '\r\n\\x1b[90m[terminal exited]\x1b[0m\r\n'
            )
            return
          }

          if (payload.type === 'error') {
            terminal.write(
              '\r\n\\x1b[31m' +
              String(payload.message || 'terminal error') +
              '\\x1b[0m\r\n'
            )
          }
        })

        socket.addEventListener('error', () => {
          terminal.write(
            '\r\n\\x1b[31m[terminal connection error]\\x1b[0m\r\n'
          )
        })

        socket.addEventListener('close', () => {
          if (!cancelled) {
            terminal.write(
              '\r\n\\x1b[90m[terminal disconnected]\\x1b[0m\r\n'
            )
          }

          socketRef.current = null
        })
      } catch (error) {
        if (!cancelled) {
          terminal.write(
            '\r\n\\x1b[31m' +
            (error instanceof Error
              ? error.message
              : 'terminal connection failed') +
            '\\x1b[0m\r\n'
          )
        }
      } finally {
        connectingRef.current = false
      }
    }

    void connect()

    return () => {
      cancelled = true

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
  }, [apiUrl, projectId])

  return (
    <div
      ref={containerRef}
      className="terminal"
      tabIndex={0}
      onClick={() => terminalRef.current?.focus()}
    />
  )
})

export default TerminalPanel
