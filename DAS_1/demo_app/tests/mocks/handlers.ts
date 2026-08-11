import { http, HttpResponse } from 'msw'

export const handlers = [
  // Intercept session creation (child & adult)
  http.post('*/api/screening/sessions', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { screenerType?: string }
    const screenerType = body.screenerType || 'child'

    if (screenerType === 'child') {
      return HttpResponse.json({
        id: 'mock-child-session-id',
        screenerType: 'child',
        stage: 'screening',
        questions: [
          {
            id: 'q1',
            question: 'Does the child confuse letters that look similar, such as b and d?',
            text: 'Does the child confuse letters that look similar, such as b and d?',
            options: ['Yes', 'No'],
          },
        ],
        messages: [],
        responses: {},
        notes: '',
        report: null,
        contact: null,
      })
    }

    return HttpResponse.json({
      id: 'mock-adult-session-id',
      screenerType: 'adult',
      stage: 'screening',
      messages: [],
      responses: {},
      notes: '',
      report: null,
      contact: null,
    })
  }),

  // Intercept session lookup by ID
  http.get('*/api/screening/sessions/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      screenerType: 'child',
      stage: 'screening',
      questions: [
        {
          id: 'q1',
          question: 'Does the child confuse letters that look similar, such as b and d?',
          text: 'Does the child confuse letters that look similar, such as b and d?',
          options: ['Yes', 'No'],
        },
      ],
      messages: [],
      responses: {},
      notes: '',
      report: null,
      contact: null,
    })
  }),

  // Intercept chat messages
  http.post('*/api/screening/sessions/:id/messages', async () => {
    return HttpResponse.json({
      reply: 'Thank you for sharing. Could you describe more details?',
    })
  }),

  // Intercept question responses
  http.post('*/api/screening/sessions/:id/responses', async () => {
    return HttpResponse.json({
      id: 'mock-child-session-id',
      screenerType: 'child',
      stage: 'screening',
      questions: [
        {
          id: 'q1',
          question: 'Does the child confuse letters that look similar, such as b and d?',
          text: 'Does the child confuse letters that look similar, such as b and d?',
          options: ['Yes', 'No'],
        },
      ],
      messages: [],
      responses: { q1: 'Yes' },
      notes: '',
      report: null,
      contact: null,
    })
  }),
  http.post('*/api/screening/sessions/:id/answers', async () => {
    return HttpResponse.json({
      id: 'mock-child-session-id',
      screenerType: 'child',
      stage: 'screening',
      responses: { q1: 'Yes' },
    })
  }),
  http.post('*/api/screening/sessions/:id/response', async () => {
    return HttpResponse.json({
      id: 'mock-child-session-id',
      screenerType: 'child',
      stage: 'screening',
      responses: { q1: 'Yes' },
    })
  }),
]
