import { callGas } from '@/app/lib/gas'

type FirstTimerPayload = {
  parentName?: string
  contactNumber?: string
  childName?: string
  age?: string
  ageGroup?: string
  serviceSchedule?: string
  notes?: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FirstTimerPayload

    const required = ['parentName', 'contactNumber', 'childName', 'ageGroup', 'serviceSchedule'] as const

    for (const field of required) {
      if (!body[field]) {
        return Response.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    await callGas('submitFirstTimer', {
      parentName:      body.parentName,
      contactNumber:   body.contactNumber,
      childName:       body.childName,
      age:             body.age ?? '',
      ageGroup:        body.ageGroup,
      serviceSchedule: body.serviceSchedule,
      notes:           body.notes ?? '',
    })

    return Response.json({ success: true })
  } catch (error) {
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Unable to submit attendance.' },
      { status: 500 }
    )
  }
}
