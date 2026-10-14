import { Schema, model, Document, Model } from 'mongoose';
import { TimelineEventType, ITimelineEvent } from '../types';

export type HealthTimelineDocument = Document & ITimelineEvent;

const healthTimelineSchema = new Schema<HealthTimelineDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required for timeline event'],
      index: true
    },
    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: function () {
        return this.userId;
      },
      index: true
    },
    subjectType: {
      type: String,
      enum: ['user', 'family_member'],
      default: 'user',
      index: true
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      default: function () {
        return this.ownerUserId || this.userId;
      },
      index: true
    },
    eventType: {
      type: String,
      required: [true, 'Event type is required'],
      enum: {
        values: Object.values(TimelineEventType),
        message: '{VALUE} is not a valid timeline event type'
      },
      index: true
    },
    title: {
      type: String,
      required: [true, 'Timeline title is required'],
      trim: true,
      maxlength: [200, 'Timeline title cannot exceed 200 characters']
    },
    description: {
      type: String,
      required: [true, 'Timeline description is required'],
      trim: true,
      maxlength: [500, 'Timeline description cannot exceed 500 characters']
    },
    date: {
      type: Date,
      required: [true, 'Event date is required'],
      default: Date.now,
      index: true
    },
    relatedReport: {
      type: Schema.Types.ObjectId,
      ref: 'MedicalReport',
      index: true
    },
    sourceType: {
      type: String,
      default: 'medical_report',
      trim: true
    },
    sourceId: {
      type: String,
      required: [true, 'Source identifier is required'],
      trim: true,
      index: true
    },
    metadata: {
      type: Schema.Types.Mixed
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for user queries, subject queries, chronological sorting, and deduplication
healthTimelineSchema.index({ ownerUserId: 1, subjectId: 1, date: -1 });
healthTimelineSchema.index({ ownerUserId: 1, subjectType: 1, date: -1 });
healthTimelineSchema.index({ ownerUserId: 1, isDeleted: 1 });
healthTimelineSchema.index({ userId: 1, date: -1 });
healthTimelineSchema.index({ userId: 1, eventType: 1 });
healthTimelineSchema.index({ userId: 1, sourceId: 1, isDeleted: 1 });
healthTimelineSchema.index({ userId: 1, relatedReport: 1, isDeleted: 1 });

export const HealthTimeline: Model<HealthTimelineDocument> = model<HealthTimelineDocument>(
  'HealthTimeline',
  healthTimelineSchema,
  'healthTimelines'
);
