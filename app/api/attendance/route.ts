type AttendancePayload = {
    parentName?: string
    contactNumber?: string
    childName?: string
    age?: string
    ageGroup?: string
    serviceSchedule?: string
    firstTime?: string
    notes?: string
    source?: string
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as AttendancePayload

        const requiredFields = [
            'parentName',
            'contactNumber',
            'childName',
            'ageGroup',
            'serviceSchedule',
            'firstTime',
        ] as const

        for (const field of requiredFields) {
            if (!body[field]) {
                return Response.json(
                    {
                        success: false,
                        error: `Missing required field: ${field}`,
                    },
                    { status: 400 }
                )
            }
        }

        const googleScriptUrl = process.env.GOOGLE_SCRIPT_URL
        const attendanceSecret = process.env.ATTENDANCE_SECRET

        if (!googleScriptUrl || !attendanceSecret) {
            return Response.json(
                {
                    success: false,
                    error: 'Server environment variables are missing.',
                },
                { status: 500 }
            )
        }

        const response = await fetch(googleScriptUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                secret: attendanceSecret,
                parentName: body.parentName,
                contactNumber: body.contactNumber,
                childName: body.childName,
                age: body.age || '',
                ageGroup: body.ageGroup,
                serviceSchedule: body.serviceSchedule,
                firstTime: body.firstTime,
                notes: body.notes || '',
                source: body.source || 'QR Attendance Form',
            }),
        })

        const responseText = await response.text()

        let result: {
            success?: boolean
            message?: string
            error?: string
        }

        try {
            result = JSON.parse(responseText)
        } catch {
            return Response.json(
                {
                    success: false,
                    error: 'Google Apps Script did not return a valid JSON response.',
                    details: responseText,
                },
                { status: 502 }
            )
        }

        if (!response.ok || !result.success) {
            return Response.json(
                {
                    success: false,
                    error: result.error || 'Google Apps Script submission failed.',
                },
                { status: 502 }
            )
        }

        return Response.json({
            success: true,
            message: 'Attendance recorded successfully.',
        })
    } catch (error) {
        return Response.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : 'Unable to submit attendance.',
            },
            { status: 500 }
        )
    }
}