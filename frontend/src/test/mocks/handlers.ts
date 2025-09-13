import { HttpResponse, http } from 'msw'

export const handlers = [
  // Health check endpoint
  http.get('/api/health', () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: 'connected',
      app_mode: 'demo',
    })
  }),

  // Version endpoint
  http.get('/api/version', () => {
    return HttpResponse.json({
      version: '1.0.0',
      build: 'test-build',
      timestamp: new Date().toISOString(),
    })
  }),

  // Authentication error for testing
  http.get('/api/protected', () => {
    return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }),

  // Generic API error for testing
  http.get('/api/error', () => {
    return HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }),
]
