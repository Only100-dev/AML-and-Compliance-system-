import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const createCalendarEventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  eventType: z.enum([
    'regulatory',
    'audit',
    'training',
    'policy',
    'aml',
    'kyc_review',
    'sar_deadline',
    'sanctions_screening',
    'training_expiry',
  ]),
  eventDate: z.string().min(1, 'Event date is required'), // ISO date string
  endDate: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  jurisdiction: z.string().default('CBUAE'), // GCC-aware: accepts any GCC jurisdiction code
  sourceModule: z.string().optional(),
  sourceEntityId: z.string().optional(),
  assignedToId: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  isRecurring: z.boolean().default(false),
  recurringPattern: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'annually']).optional(),
});

const updateCalendarEventSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  status: z.enum(['upcoming', 'in_progress', 'completed', 'overdue', 'cancelled']).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  eventDate: z.string().optional(),
  endDate: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  assignedToId: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

// ─── GET: List Calendar Events ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard();
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;
    const { searchParams } = new URL(request.url);
    const eventType = searchParams.get('eventType');
    const jurisdiction = searchParams.get('jurisdiction');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const priority = searchParams.get('priority');
    const sourceModule = searchParams.get('sourceModule');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const where: Record<string, unknown> = {};

    if (eventType) where.eventType = eventType;
    if (jurisdiction) where.jurisdiction = jurisdiction;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (sourceModule) where.sourceModule = sourceModule;

    if (dateFrom || dateTo) {
      const eventDate: Record<string, Date> = {};
      if (dateFrom) eventDate.gte = new Date(dateFrom);
      if (dateTo) eventDate.lte = new Date(dateTo);
      where.eventDate = eventDate;
    }

    // Exclude cancelled events by default unless explicitly requested
    if (!status) {
      where.status = { not: 'cancelled' };
    }

    const [events, total] = await Promise.all([
      db.calendarEvent.findMany({
        where,
        orderBy: [{ eventDate: 'asc' }, { priority: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.calendarEvent.count({ where }),
    ]);

    // Enrich events with computed status for overdue detection
    const now = new Date();
    const enrichedEvents = events.map(event => {
      const eventDate = new Date(event.eventDate);
      const isOverdue = eventDate < now && event.status === 'upcoming';

      return {
        ...event,
        computedStatus: isOverdue ? 'overdue' : event.status,
        isOverdue,
      };
    });

    return NextResponse.json({
      success: true,
      data: enrichedEvents,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[CALENDAR_GET] Error listing calendar events:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list calendar events' },
      { status: 500 }
    );
  }
}

// ─── POST: Create Calendar Event ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard();
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;
    const body = await request.json();
    const parsed = createCalendarEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const {
      title,
      description,
      eventType,
      eventDate,
      endDate,
      priority,
      jurisdiction,
      sourceModule,
      sourceEntityId,
      assignedToId,
      location,
      notes,
      isRecurring,
      recurringPattern,
    } = parsed.data;

    // Validate recurring events have a pattern
    if (isRecurring && !recurringPattern) {
      return NextResponse.json(
        {
          success: false,
          error: 'Recurring events must specify a recurringPattern',
          code: 'RECURRING_PATTERN_REQUIRED',
        },
        { status: 422 }
      );
    }

    const event = await db.calendarEvent.create({
      data: {
        title,
        description: description || null,
        eventType,
        eventDate: new Date(eventDate),
        endDate: endDate ? new Date(endDate) : null,
        priority,
        jurisdiction,
        status: 'upcoming',
        sourceModule: sourceModule || null,
        sourceEntityId: sourceEntityId || null,
        assignedToId: assignedToId || null,
        location: location || null,
        notes: notes || null,
        isRecurring,
        recurringPattern: recurringPattern || null,
      },
    });

    // ─── Auto-generate related events from other modules ─────────────────
    // When a SAR deadline is created, also create reminder events
    if (eventType === 'sar_deadline') {
      const sarDate = new Date(eventDate);

      // 7-day reminder
      const reminderDate = new Date(sarDate);
      reminderDate.setDate(reminderDate.getDate() - 7);
      if (reminderDate > new Date()) {
        await db.calendarEvent.create({
          data: {
            title: `[Reminder] ${title} — 7 Days Remaining`,
            description: `SAR filing deadline approaching in 7 days. ${description || ''}`,
            eventType: 'sar_deadline',
            eventDate: reminderDate,
            priority: 'high',
            jurisdiction,
            status: 'upcoming',
            sourceModule: 'compliance_calendar',
            sourceEntityId: event.id,
          },
        });
      }

      // 3-day reminder
      const urgentReminderDate = new Date(sarDate);
      urgentReminderDate.setDate(urgentReminderDate.getDate() - 3);
      if (urgentReminderDate > new Date()) {
        await db.calendarEvent.create({
          data: {
            title: `[URGENT] ${title} — 3 Days Remaining`,
            description: `SAR filing deadline approaching in 3 days. IMMEDIATE ACTION REQUIRED. ${description || ''}`,
            eventType: 'sar_deadline',
            eventDate: urgentReminderDate,
            priority: 'urgent',
            jurisdiction,
            status: 'upcoming',
            sourceModule: 'compliance_calendar',
            sourceEntityId: event.id,
          },
        });
      }
    }

    // When a KYC review is scheduled, create a reminder
    if (eventType === 'kyc_review') {
      const kycDate = new Date(eventDate);
      const reminderDate = new Date(kycDate);
      reminderDate.setDate(reminderDate.getDate() - 5);
      if (reminderDate > new Date()) {
        await db.calendarEvent.create({
          data: {
            title: `[Reminder] ${title} — 5 Days Before Review`,
            description: `KYC review approaching. Prepare documentation. ${description || ''}`,
            eventType: 'kyc_review',
            eventDate: reminderDate,
            priority: 'normal',
            jurisdiction,
            status: 'upcoming',
            sourceModule: 'compliance_calendar',
            sourceEntityId: event.id,
          },
        });
      }
    }

    // When training expiry is approaching, create reminders
    if (eventType === 'training_expiry') {
      const trainingDate = new Date(eventDate);
      const reminderDate = new Date(trainingDate);
      reminderDate.setDate(reminderDate.getDate() - 14);
      if (reminderDate > new Date()) {
        await db.calendarEvent.create({
          data: {
            title: `[Reminder] ${title} — 14 Days Before Expiry`,
            description: `Training certification expiring soon. Renewal required. ${description || ''}`,
            eventType: 'training_expiry',
            eventDate: reminderDate,
            priority: 'high',
            jurisdiction,
            status: 'upcoming',
            sourceModule: 'compliance_calendar',
            sourceEntityId: event.id,
          },
        });
      }
    }

    // ─── Audit Log ───────────────────────────────────────────────────────
    await db.auditLog.create({
      data: {
        userId: assignedToId || 'system',
        action: 'CALENDAR_EVENT_CREATED',
        resource: 'CalendarEvent',
        resourceId: event.id,
        details: JSON.stringify({
          title,
          eventType,
          eventDate,
          priority,
          jurisdiction,
          sourceModule: sourceModule || null,
          sourceEntityId: sourceEntityId || null,
        }),
        ipAddress: request.headers.get('x-forwarded-for') || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: event,
      meta: {
        autoRemindersCreated: ['sar_deadline', 'kyc_review', 'training_expiry'].includes(eventType),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[CALENDAR_POST] Error creating calendar event:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create calendar event' },
      { status: 500 }
    );
  }
}

// ─── PUT: Update Calendar Event Status ───────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const auth = await authGuard();
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;
    const body = await request.json();
    const parsed = updateCalendarEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const { eventId, status, title, description, eventDate, endDate, priority, assignedToId, location, notes } = parsed.data;

    // Verify the event exists
    const existingEvent = await db.calendarEvent.findUnique({
      where: { id: eventId },
    });

    if (!existingEvent) {
      return NextResponse.json(
        { success: false, error: `Calendar event with ID "${eventId}" not found` },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (eventDate) updateData.eventDate = new Date(eventDate);
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
    if (priority) updateData.priority = priority;
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId;
    if (location !== undefined) updateData.location = location;
    if (notes !== undefined) updateData.notes = notes;

    const updatedEvent = await db.calendarEvent.update({
      where: { id: eventId },
      data: updateData,
    });

    // ─── Audit Log ───────────────────────────────────────────────────────
    await db.auditLog.create({
      data: {
        userId: assignedToId || 'system',
        action: 'CALENDAR_EVENT_UPDATED',
        resource: 'CalendarEvent',
        resourceId: eventId,
        details: JSON.stringify({
          title: existingEvent.title,
          eventType: existingEvent.eventType,
          changes: Object.keys(updateData),
        }),
        ipAddress: request.headers.get('x-forwarded-for') || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedEvent,
    });
  } catch (error) {
    console.error('[CALENDAR_PUT] Error updating calendar event:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update calendar event' },
      { status: 500 }
    );
  }
}

// ─── DELETE: Cancel Calendar Event (Soft Delete) ─────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const auth = await authGuard();
    if (!auth.authorized) {
      return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'eventId query parameter is required' },
        { status: 400 }
      );
    }

    // Verify the event exists
    const existingEvent = await db.calendarEvent.findUnique({
      where: { id: eventId },
    });

    if (!existingEvent) {
      return NextResponse.json(
        { success: false, error: `Calendar event with ID "${eventId}" not found` },
        { status: 404 }
      );
    }

    if (existingEvent.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: 'Event is already cancelled' },
        { status: 422 }
      );
    }

    // Soft delete by setting status to "cancelled"
    const cancelledEvent = await db.calendarEvent.update({
      where: { id: eventId },
      data: { status: 'cancelled' },
    });

    // ─── Audit Log ───────────────────────────────────────────────────────
    await db.auditLog.create({
      data: {
        userId: 'system',
        action: 'CALENDAR_EVENT_CANCELLED',
        resource: 'CalendarEvent',
        resourceId: eventId,
        details: JSON.stringify({
          title: existingEvent.title,
          eventType: existingEvent.eventType,
          originalStatus: existingEvent.status,
        }),
        ipAddress: request.headers.get('x-forwarded-for') || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: cancelledEvent,
      meta: { action: 'soft_delete', previousStatus: existingEvent.status },
    });
  } catch (error) {
    console.error('[CALENDAR_DELETE] Error cancelling calendar event:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel calendar event' },
      { status: 500 }
    );
  }
}
