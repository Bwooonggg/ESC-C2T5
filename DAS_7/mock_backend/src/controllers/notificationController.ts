import * as notifierModel from '../models/notifierModel.js'
import type { EmailNotification, Student } from '../types/domain.js'

// `NotificationController` from the Notify Parent sequence diagram.
//
// NOTE (plan gap 3.2): there is deliberately no Express handler in this file.
// In the PM2 diagram, Notify Parent begins at a Clock actor calling
// timerExpired() — the parent never triggers it. So this controller is invoked
// by utils/clock.ts, not by a route. No REST endpoint, no button, no UI.
// If you find yourself wanting to POST to /api/notify, re-read the diagram.

export async function notifyParent(
  student: Student,
  recipientEmail: string,
): Promise<EmailNotification | null> {
  const notification = await notifierModel.notifyParent(student, recipientEmail)

  if (notification?.sent) {
    console.log(`[NotificationController] parentNotified student=${student.studentId}`)
  } else {
    console.log(`[NotificationController] notificationFailed student=${student.studentId}`)
  }

  return notification
}
