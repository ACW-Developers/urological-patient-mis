import { supabase } from '@/integrations/supabase/client';

type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface NotificationPayload {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

// Create a notification for a specific user
export async function createNotification(payload: NotificationPayload) {
  const { error } = await supabase.from('notifications').insert({
    user_id: payload.userId,
    title: payload.title,
    message: payload.message,
    type: payload.type || 'info',
    related_entity_type: payload.relatedEntityType,
    related_entity_id: payload.relatedEntityId,
  });

  if (error) {
    console.error('Failed to create notification:', error);
  }
  return { error };
}

// Notify all users with a specific role
export async function notifyByRole(
  role: 'admin' | 'nurse' | 'doctor' | 'lab_technician' | 'pharmacist',
  notification: Omit<NotificationPayload, 'userId'>
) {
  // Get all users with the specified role
  const { data: userRoles, error: roleError } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', role);

  if (roleError) {
    console.error('Failed to fetch users by role:', roleError);
    return { error: roleError };
  }

  if (!userRoles || userRoles.length === 0) {
    return { error: null };
  }

  // Create notifications for all users with this role
  const notifications = userRoles.map((ur) => ({
    user_id: ur.user_id,
    title: notification.title,
    message: notification.message,
    type: notification.type || 'info',
    related_entity_type: notification.relatedEntityType,
    related_entity_id: notification.relatedEntityId,
  }));

  const { error } = await supabase.from('notifications').insert(notifications);

  if (error) {
    console.error('Failed to create bulk notifications:', error);
  }
  return { error };
}

// Notify a specific doctor about an appointment
export async function notifyDoctor(
  doctorId: string,
  notification: Omit<NotificationPayload, 'userId'>
) {
  return createNotification({
    userId: doctorId,
    ...notification,
  });
}

// Notify all pharmacists about a new prescription
export async function notifyPharmacists(prescriptionId: string, patientName: string) {
  return notifyByRole('pharmacist', {
    title: 'New Prescription',
    message: `A new prescription for ${patientName} is ready for dispensing.`,
    type: 'info',
    relatedEntityType: 'prescription',
    relatedEntityId: prescriptionId,
  });
}

// Notify all lab technicians about a new lab order
export async function notifyLabTechnicians(testId: string, patientName: string, testName: string, priority: string) {
  const isUrgent = priority === 'urgent' || priority === 'stat';
  return notifyByRole('lab_technician', {
    title: isUrgent ? `Urgent Lab Order: ${testName}` : `New Lab Order: ${testName}`,
    message: `Lab test ordered for ${patientName}. Priority: ${priority.toUpperCase()}`,
    type: isUrgent ? 'warning' : 'info',
    relatedEntityType: 'lab_test',
    relatedEntityId: testId,
  });
}

// Notify doctor about completed lab results
export async function notifyDoctorLabResults(doctorId: string, testId: string, patientName: string, testName: string, hasAbnormal: boolean) {
  return createNotification({
    userId: doctorId,
    title: hasAbnormal ? `Abnormal Lab Results: ${testName}` : `Lab Results Ready: ${testName}`,
    message: hasAbnormal 
      ? `Lab results for ${patientName} contain abnormal values. Please review.`
      : `Lab results for ${patientName} are now available.`,
    type: hasAbnormal ? 'warning' : 'success',
    relatedEntityType: 'lab_test',
    relatedEntityId: testId,
  });
}
