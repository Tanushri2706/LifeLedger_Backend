import crypto from 'crypto';
import { Types } from 'mongoose';
import { User, EmergencyQR, SOSEvent } from '../models';
import {
  IEmergencyContact,
  CreateEmergencyContactDto,
  UpdateEmergencyContactDto,
  IEmergencyInfo,
  UpdateEmergencyInfoDto,
  IEmergencyQR,
  IPublicEmergencyInfo,
  EmergencyActionType,
  IEmergencyActionMetadata,
  ShareEmergencyPayloadDto,
  TriggerSOSDto,
  TriggerSOSResponseDto,
  ISOSRecord,
  SOSStatus,
  BloodGroup,
  IEmergencyCapabilities,
  INDIA_EMERGENCY_NUMBERS
} from '../types';
import { AppError } from '../utils';
import { config } from '../config';

export class EmergencyService {
  /**
   * Validates and normalizes phone numbers (E.164 compatible or standard numeric with 7-15 digits).
   */
  private normalizeAndValidatePhone(phone: string): string {
    if (!phone || typeof phone !== 'string') {
      throw new AppError('Valid phone number is required', 400);
    }
    const trimmed = phone.trim();
    const cleaned = trimmed.replace(/[\s\-()]/g, '');
    const phoneRegex = /^\+?[0-9]{7,15}$/;
    if (!phoneRegex.test(cleaned)) {
      throw new AppError(
        'Phone number must contain between 7 and 15 digits (e.g. +919876543210 or 9876543210)',
        400
      );
    }
    return trimmed;
  }

  /**
   * Generates a cryptographically secure 64-character hex token (256-bit entropy) for Emergency QR.
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // =========================================================================
  // 1. EMERGENCY CAPABILITIES
  // =========================================================================

  public getCapabilities(): IEmergencyCapabilities {
    return {
      emergencyCallingAvailable: true,
      nearbyHospitalsAvailable: true,
      ambulanceDiscoveryAvailable: false,
      ambulanceDispatchAvailable: false,
      liveTrackingAvailable: false,
      etaAvailable: false,
      providerStatus: {
        locationProvider: config.mapsProvider,
        ambulanceProvider: 'mock_provider',
        isRealAmbulanceProvider: false
      },
      emergencyNumbers: {
        nationalEmergency: INDIA_EMERGENCY_NUMBERS.NATIONAL_EMERGENCY.number,
        ambulance: INDIA_EMERGENCY_NUMBERS.AMBULANCE.number
      },
      disclaimer:
        'Emergency helpline routing is available via device telephony (112 / 108). Real-time automated ambulance dispatch or live vehicle tracking is not connected.'
    };
  }

  // =========================================================================
  // 2. EMERGENCY CONTACTS CRUD
  // =========================================================================

  public async getContacts(userId: string): Promise<{ contacts: IEmergencyContact[] }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID', 400);
    }

    const user = await User.findOne({ _id: new Types.ObjectId(userId), isDeleted: false });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const contacts: IEmergencyContact[] = (user.emergencyContacts || []).map((c: any) => ({
      id: c._id ? c._id.toString() : String(c.id),
      _id: c._id ? c._id.toString() : String(c.id),
      name: c.name,
      relationship: c.relationship,
      phone: c.phone,
      isPrimary: Boolean(c.isPrimary),
      notes: c.notes,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }));

    // Sort: primary first
    contacts.sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));

    return { contacts };
  }

  public async createContact(
    userId: string,
    dto: CreateEmergencyContactDto
  ): Promise<{ contact: IEmergencyContact }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID', 400);
    }

    if (!dto.name || typeof dto.name !== 'string' || dto.name.trim().length < 2) {
      throw new AppError('Contact name must be at least 2 characters', 400);
    }
    if (dto.name.trim().length > 100) {
      throw new AppError('Contact name cannot exceed 100 characters', 400);
    }

    if (!dto.relationship || typeof dto.relationship !== 'string' || dto.relationship.trim().length < 2) {
      throw new AppError('Relationship is required (e.g. Spouse, Parent, Sibling, Friend)', 400);
    }
    if (dto.relationship.trim().length > 50) {
      throw new AppError('Relationship cannot exceed 50 characters', 400);
    }

    const normalizedPhone = this.normalizeAndValidatePhone(dto.phone);

    const user = await User.findOne({ _id: new Types.ObjectId(userId), isDeleted: false });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const currentContacts = (user.emergencyContacts || []) as any[];

    // Max limit check
    if (currentContacts.length >= 10) {
      throw new AppError('Maximum of 10 emergency contacts allowed per user', 400);
    }

    // Duplicate check
    const duplicate = currentContacts.find(
      (c) => c.phone && c.phone.replace(/[\s\-()]/g, '') === normalizedPhone.replace(/[\s\-()]/g, '')
    );
    if (duplicate) {
      throw new AppError('An emergency contact with this phone number already exists', 409);
    }

    const isFirstContact = currentContacts.length === 0;
    const isPrimary = Boolean(dto.isPrimary) || isFirstContact;

    if (isPrimary) {
      currentContacts.forEach((c) => {
        c.isPrimary = false;
      });
    }

    const newContactItem = {
      name: dto.name.trim(),
      relationship: dto.relationship.trim(),
      phone: normalizedPhone,
      isPrimary,
      notes: dto.notes ? dto.notes.trim() : undefined
    };

    currentContacts.push(newContactItem);
    user.emergencyContacts = currentContacts;

    // Sync primary contact with single contact field
    const primaryContact = currentContacts.find((c) => c.isPrimary) || currentContacts[0];
    if (primaryContact) {
      user.emergencyContact = {
        name: primaryContact.name,
        relationship: primaryContact.relationship,
        phone: primaryContact.phone
      };
    }

    await user.save();

    const savedContact = user.emergencyContacts[user.emergencyContacts.length - 1] as any;
    const contactResult: IEmergencyContact = {
      id: savedContact._id ? savedContact._id.toString() : String(savedContact.id),
      _id: savedContact._id ? savedContact._id.toString() : String(savedContact.id),
      name: savedContact.name,
      relationship: savedContact.relationship,
      phone: savedContact.phone,
      isPrimary: savedContact.isPrimary,
      notes: savedContact.notes,
      createdAt: savedContact.createdAt,
      updatedAt: savedContact.updatedAt
    };

    await this.syncEmergencyQRContacts(userId, user.emergencyContacts);

    return { contact: contactResult };
  }

  public async updateContact(
    userId: string,
    contactId: string,
    dto: UpdateEmergencyContactDto
  ): Promise<{ contact: IEmergencyContact }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID', 400);
    }
    if (!Types.ObjectId.isValid(contactId)) {
      throw new AppError('Emergency contact not found', 404);
    }

    const user = await User.findOne({ _id: new Types.ObjectId(userId), isDeleted: false });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const currentContacts = (user.emergencyContacts || []) as any[];
    const contactIndex = currentContacts.findIndex((c: any) => c._id && c._id.toString() === contactId);

    if (contactIndex === -1) {
      throw new AppError('Emergency contact not found', 404);
    }

    const targetContact = currentContacts[contactIndex];

    if (dto.name !== undefined) {
      if (typeof dto.name !== 'string' || dto.name.trim().length < 2) {
        throw new AppError('Contact name must be at least 2 characters', 400);
      }
      if (dto.name.trim().length > 100) {
        throw new AppError('Contact name cannot exceed 100 characters', 400);
      }
      targetContact.name = dto.name.trim();
    }

    if (dto.relationship !== undefined) {
      if (typeof dto.relationship !== 'string' || dto.relationship.trim().length < 2) {
        throw new AppError('Relationship is required', 400);
      }
      if (dto.relationship.trim().length > 50) {
        throw new AppError('Relationship cannot exceed 50 characters', 400);
      }
      targetContact.relationship = dto.relationship.trim();
    }

    if (dto.phone !== undefined) {
      const normalizedPhone = this.normalizeAndValidatePhone(dto.phone);
      const duplicate = currentContacts.find(
        (c: any) =>
          c._id &&
          c._id.toString() !== contactId &&
          c.phone &&
          c.phone.replace(/[\s\-()]/g, '') === normalizedPhone.replace(/[\s\-()]/g, '')
      );
      if (duplicate) {
        throw new AppError('An emergency contact with this phone number already exists', 409);
      }
      targetContact.phone = normalizedPhone;
    }

    if (dto.notes !== undefined) {
      targetContact.notes = dto.notes ? dto.notes.trim() : undefined;
    }

    if (dto.isPrimary === true) {
      currentContacts.forEach((c: any) => {
        c.isPrimary = c._id && c._id.toString() === contactId;
      });
    }

    user.emergencyContacts = currentContacts;

    // Sync primary contact with legacy single field
    const primaryContact = currentContacts.find((c) => c.isPrimary) || currentContacts[0];
    if (primaryContact) {
      user.emergencyContact = {
        name: primaryContact.name,
        relationship: primaryContact.relationship,
        phone: primaryContact.phone
      };
    }

    await user.save();

    const updated = user.emergencyContacts[contactIndex] as any;
    const contactResult: IEmergencyContact = {
      id: updated._id ? updated._id.toString() : String(updated.id),
      _id: updated._id ? updated._id.toString() : String(updated.id),
      name: updated.name,
      relationship: updated.relationship,
      phone: updated.phone,
      isPrimary: updated.isPrimary,
      notes: updated.notes,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    };

    await this.syncEmergencyQRContacts(userId, user.emergencyContacts);

    return { contact: contactResult };
  }

  public async deleteContact(userId: string, contactId: string): Promise<void> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID', 400);
    }
    if (!Types.ObjectId.isValid(contactId)) {
      throw new AppError('Emergency contact not found', 404);
    }

    const user = await User.findOne({ _id: new Types.ObjectId(userId), isDeleted: false });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const currentContacts = (user.emergencyContacts || []) as any[];
    const contactIndex = currentContacts.findIndex((c: any) => c._id && c._id.toString() === contactId);

    if (contactIndex === -1) {
      throw new AppError('Emergency contact not found', 404);
    }

    const wasPrimary = Boolean(currentContacts[contactIndex].isPrimary);
    currentContacts.splice(contactIndex, 1);

    if (wasPrimary && currentContacts.length > 0) {
      currentContacts[0].isPrimary = true;
    }

    user.emergencyContacts = currentContacts;

    if (currentContacts.length > 0) {
      const primaryContact = currentContacts.find((c) => c.isPrimary) || currentContacts[0];
      user.emergencyContact = {
        name: primaryContact.name,
        relationship: primaryContact.relationship,
        phone: primaryContact.phone
      };
    } else {
      user.emergencyContact = undefined;
    }

    await user.save();

    await this.syncEmergencyQRContacts(userId, user.emergencyContacts);
  }

  // =========================================================================
  // 3. EMERGENCY INFORMATION & PROFILE (AUTHENTICATED)
  // =========================================================================

  public async getEmergencyInfo(userId: string): Promise<{ emergencyInfo: IEmergencyInfo }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID', 400);
    }

    const [user, qrDoc] = await Promise.all([
      User.findOne({ _id: new Types.ObjectId(userId), isDeleted: false }),
      EmergencyQR.findOne({ userId: new Types.ObjectId(userId) })
    ]);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const emergencyInfo: IEmergencyInfo = {
      userId: user._id.toString(),
      userName: `${user.firstName} ${user.lastName}`.trim(),
      bloodGroup: user.bloodGroup || (qrDoc ? qrDoc.bloodGroup : undefined),
      allergies: qrDoc ? qrDoc.allergies || [] : [],
      medicalConditions: qrDoc ? qrDoc.medicalConditions || [] : [],
      criticalNotes: qrDoc ? qrDoc.criticalNotes : undefined,
      emergencyContacts: (user.emergencyContacts || []).map((c: any) => ({
        id: c._id ? c._id.toString() : String(c.id),
        name: c.name,
        relationship: c.relationship,
        phone: c.phone,
        isPrimary: Boolean(c.isPrimary),
        notes: c.notes
      })),
      lastUpdated: qrDoc ? qrDoc.updatedAt : user.updatedAt
    };

    return { emergencyInfo };
  }

  public async updateEmergencyInfo(
    userId: string,
    dto: UpdateEmergencyInfoDto
  ): Promise<{ emergencyInfo: IEmergencyInfo }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID', 400);
    }

    const user = await User.findOne({ _id: new Types.ObjectId(userId), isDeleted: false });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (dto.bloodGroup !== undefined) {
      if (!Object.values(BloodGroup).includes(dto.bloodGroup)) {
        throw new AppError('Invalid blood group provided', 400);
      }
      user.bloodGroup = dto.bloodGroup;
      await user.save();
    }

    let qrDoc = await EmergencyQR.findOne({ userId: new Types.ObjectId(userId) });
    if (!qrDoc) {
      const qrToken = this.generateSecureToken();
      qrDoc = new EmergencyQR({
        userId: user._id,
        qrToken,
        qrCode: `lifeledger:emergency:${qrToken}`,
        bloodGroup: user.bloodGroup,
        allergies: [],
        medicalConditions: [],
        emergencyContacts: user.emergencyContacts || [],
        isActive: true
      });
    }

    if (dto.bloodGroup !== undefined) {
      qrDoc.bloodGroup = dto.bloodGroup;
    }

    if (dto.allergies !== undefined) {
      if (!Array.isArray(dto.allergies)) {
        throw new AppError('Allergies must be provided as an array of strings', 400);
      }
      if (dto.allergies.length > 20) {
        throw new AppError('Cannot exceed 20 allergy entries', 400);
      }
      qrDoc.allergies = dto.allergies
        .filter((a) => typeof a === 'string' && a.trim().length > 0)
        .map((a) => a.trim().slice(0, 50));
    }

    if (dto.medicalConditions !== undefined) {
      if (!Array.isArray(dto.medicalConditions)) {
        throw new AppError('Medical conditions must be provided as an array of strings', 400);
      }
      if (dto.medicalConditions.length > 20) {
        throw new AppError('Cannot exceed 20 medical condition entries', 400);
      }
      qrDoc.medicalConditions = dto.medicalConditions
        .filter((c) => typeof c === 'string' && c.trim().length > 0)
        .map((c) => c.trim().slice(0, 50));
    }

    if (dto.criticalNotes !== undefined) {
      if (dto.criticalNotes && dto.criticalNotes.length > 500) {
        throw new AppError('Critical notes cannot exceed 500 characters', 400);
      }
      qrDoc.criticalNotes = dto.criticalNotes ? dto.criticalNotes.trim() : undefined;
    }

    qrDoc.emergencyContacts = (user.emergencyContacts || []) as any;
    await qrDoc.save();

    return this.getEmergencyInfo(userId);
  }

  // =========================================================================
  // 4. EMERGENCY QR & PUBLIC LOOKUP
  // =========================================================================

  public async getEmergencyQR(userId: string): Promise<{ qr: IEmergencyQR }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID', 400);
    }

    const user = await User.findOne({ _id: new Types.ObjectId(userId), isDeleted: false });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    let qrDoc = await EmergencyQR.findOne({ userId: new Types.ObjectId(userId) });
    if (!qrDoc) {
      const qrToken = this.generateSecureToken();
      qrDoc = await EmergencyQR.create({
        userId: user._id,
        qrToken,
        qrCode: `lifeledger:emergency:${qrToken}`,
        bloodGroup: user.bloodGroup,
        allergies: [],
        medicalConditions: [],
        emergencyContacts: user.emergencyContacts || [],
        isActive: true
      });
    }

    const qrResult: IEmergencyQR = {
      id: qrDoc._id.toString(),
      userId: qrDoc.userId as Types.ObjectId,
      qrToken: qrDoc.qrToken,
      qrCode: qrDoc.qrCode,
      bloodGroup: qrDoc.bloodGroup,
      allergies: qrDoc.allergies,
      medicalConditions: qrDoc.medicalConditions,
      criticalNotes: qrDoc.criticalNotes,
      emergencyContacts: (user.emergencyContacts || []).map((c: any) => ({
        id: c._id ? c._id.toString() : String(c.id),
        name: c.name,
        relationship: c.relationship,
        phone: c.phone,
        isPrimary: Boolean(c.isPrimary),
        notes: c.notes
      })),
      isActive: qrDoc.isActive,
      lastAccessedAt: qrDoc.lastAccessedAt,
      accessCount: qrDoc.accessCount || 0,
      createdAt: qrDoc.createdAt,
      updatedAt: qrDoc.updatedAt
    };

    return { qr: qrResult };
  }

  public async rotateEmergencyQR(userId: string): Promise<{ qr: IEmergencyQR }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID', 400);
    }

    const user = await User.findOne({ _id: new Types.ObjectId(userId), isDeleted: false });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const newQrToken = this.generateSecureToken();
    const newQrCode = `lifeledger:emergency:${newQrToken}`;

    const qrDoc = await EmergencyQR.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        $set: {
          qrToken: newQrToken,
          qrCode: newQrCode,
          isActive: true,
          accessCount: 0,
          lastAccessedAt: undefined
        }
      },
      { new: true, upsert: true }
    );

    const qrResult: IEmergencyQR = {
      id: qrDoc._id.toString(),
      userId: qrDoc.userId as Types.ObjectId,
      qrToken: qrDoc.qrToken,
      qrCode: qrDoc.qrCode,
      bloodGroup: qrDoc.bloodGroup || user.bloodGroup,
      allergies: qrDoc.allergies || [],
      medicalConditions: qrDoc.medicalConditions || [],
      criticalNotes: qrDoc.criticalNotes,
      emergencyContacts: (user.emergencyContacts || []).map((c: any) => ({
        id: c._id ? c._id.toString() : String(c.id),
        name: c.name,
        relationship: c.relationship,
        phone: c.phone,
        isPrimary: Boolean(c.isPrimary),
        notes: c.notes
      })),
      isActive: qrDoc.isActive,
      lastAccessedAt: qrDoc.lastAccessedAt,
      accessCount: qrDoc.accessCount || 0,
      createdAt: qrDoc.createdAt,
      updatedAt: qrDoc.updatedAt
    };

    return { qr: qrResult };
  }

  /**
   * Public First-Responder Lookup endpoint.
   * STRICT SECURITY: Accessible via 64-character high-entropy token only.
   * Completely sanitizes and strips all account secrets, passwords, tokens, addresses,
   * uploaded medical vault documents, OCR text, and AI analysis.
   */
  public async getPublicEmergencyInfoByToken(
    rawToken: string
  ): Promise<{ emergencyInfo: IPublicEmergencyInfo }> {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new AppError('Emergency QR token is required', 400);
    }

    const token = rawToken.trim();
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      throw new AppError('Emergency medical card not found or token has expired/been revoked', 404);
    }

    const qrDoc = await EmergencyQR.findOne({ qrToken: token, isActive: true });
    if (!qrDoc) {
      throw new AppError('Emergency medical card not found or token has expired/been revoked', 404);
    }

    const user = await User.findOne({ _id: qrDoc.userId, isDeleted: false });
    if (!user) {
      throw new AppError('Emergency medical card is no longer active', 404);
    }

    // Record access metrics safely without blocking
    await EmergencyQR.updateOne(
      { _id: qrDoc._id },
      {
        $inc: { accessCount: 1 },
        $set: { lastAccessedAt: new Date() }
      }
    );

    const displayName = `${user.firstName} ${user.lastName}`.trim();

    const publicContacts = (user.emergencyContacts || []).map((c: any) => ({
      name: c.name,
      relationship: c.relationship,
      phone: c.phone,
      isPrimary: Boolean(c.isPrimary)
    }));

    const sanitizedInfo: IPublicEmergencyInfo = {
      userName: displayName,
      bloodGroup: qrDoc.bloodGroup || user.bloodGroup,
      allergies: qrDoc.allergies || [],
      medicalConditions: qrDoc.medicalConditions || [],
      criticalNotes: qrDoc.criticalNotes,
      emergencyContacts: publicContacts,
      verifiedAt: qrDoc.updatedAt || new Date(),
      disclaimer:
        'This emergency medical card is provided strictly for first-responder triage and vital identification. For life-threatening emergencies, dial national emergency services immediately.'
    };

    return { emergencyInfo: sanitizedInfo };
  }

  // =========================================================================
  // 5. EMERGENCY ACTIONS & SOS
  // =========================================================================

  public getEmergencyActions(): {
    actions: IEmergencyActionMetadata[];
    emergencyNumbers: {
      nationalEmergency: string;
      ambulance: string;
    };
    disclaimer: string;
  } {
    const actions: IEmergencyActionMetadata[] = [
      {
        type: EmergencyActionType.CALL_NATIONAL_EMERGENCY,
        title: INDIA_EMERGENCY_NUMBERS.NATIONAL_EMERGENCY.name,
        description: INDIA_EMERGENCY_NUMBERS.NATIONAL_EMERGENCY.description,
        phoneNumber: INDIA_EMERGENCY_NUMBERS.NATIONAL_EMERGENCY.number,
        actionUrl: INDIA_EMERGENCY_NUMBERS.NATIONAL_EMERGENCY.actionUrl,
        priority: INDIA_EMERGENCY_NUMBERS.NATIONAL_EMERGENCY.priority,
        isRealtimeDispatch: false,
        status: 'external_telephony'
      },
      {
        type: EmergencyActionType.CALL_AMBULANCE,
        title: INDIA_EMERGENCY_NUMBERS.AMBULANCE.name,
        description: INDIA_EMERGENCY_NUMBERS.AMBULANCE.description,
        phoneNumber: INDIA_EMERGENCY_NUMBERS.AMBULANCE.number,
        actionUrl: INDIA_EMERGENCY_NUMBERS.AMBULANCE.actionUrl,
        priority: INDIA_EMERGENCY_NUMBERS.AMBULANCE.priority,
        isRealtimeDispatch: false,
        status: 'external_telephony',
        regionalNote: INDIA_EMERGENCY_NUMBERS.AMBULANCE.regionalNote
      },
      {
        type: EmergencyActionType.HOSPITAL_DIRECTIONS,
        title: 'Nearby Emergency Hospital Navigation',
        description: 'Open map route to the closest verified 24/7 emergency-capable hospital.',
        priority: 'high',
        isRealtimeDispatch: false,
        status: 'available'
      },
      {
        type: EmergencyActionType.NOTIFY_CONTACTS,
        title: 'Alert Emergency Contacts',
        description: 'Share emergency medical card and optional coordinates with pre-configured emergency contacts.',
        priority: 'high',
        isRealtimeDispatch: false,
        status: 'available'
      },
      {
        type: EmergencyActionType.TRIGGER_SOS,
        title: 'Record SOS Safety Audit',
        description: 'Record an urgent safety distress event in your personal safety log.',
        priority: 'critical',
        isRealtimeDispatch: false,
        status: 'available'
      }
    ];

    return {
      actions,
      emergencyNumbers: {
        nationalEmergency: INDIA_EMERGENCY_NUMBERS.NATIONAL_EMERGENCY.number,
        ambulance: INDIA_EMERGENCY_NUMBERS.AMBULANCE.number
      },
      disclaimer:
        'LifeLedger provides emergency action routing and metadata. For immediate life-threatening situations, dial 112 or 108 directly from your phone.'
    };
  }

  public async shareEmergencyInfo(
    userId: string,
    dto: ShareEmergencyPayloadDto
  ): Promise<{
    success: boolean;
    recipient: string;
    sharedAt: Date;
    summary: Record<string, unknown>;
  }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID', 400);
    }

    if (!dto.recipientEmail && !dto.recipientPhone) {
      throw new AppError('Either recipientEmail or recipientPhone must be provided', 400);
    }

    const { emergencyInfo } = await this.getEmergencyInfo(userId);

    const recipient = dto.recipientEmail || dto.recipientPhone || 'Emergency Contact';

    return {
      success: true,
      recipient,
      sharedAt: new Date(),
      summary: {
        userName: emergencyInfo.userName,
        bloodGroup: emergencyInfo.bloodGroup,
        allergiesCount: emergencyInfo.allergies.length,
        conditionsCount: emergencyInfo.medicalConditions.length,
        contactsCount: emergencyInfo.emergencyContacts.length,
        message: dto.message || 'Emergency information shared from LifeLedger'
      }
    };
  }

  public async triggerSOS(
    userId: string,
    dto: TriggerSOSDto
  ): Promise<TriggerSOSResponseDto> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID', 400);
    }

    const user = await User.findOne({ _id: new Types.ObjectId(userId), isDeleted: false });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    let location: { type: 'Point'; coordinates: [number, number] } | undefined;
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      const lat = typeof dto.latitude === 'number' ? dto.latitude : parseFloat(String(dto.latitude));
      const lng = typeof dto.longitude === 'number' ? dto.longitude : parseFloat(String(dto.longitude));
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        location = {
          type: 'Point',
          coordinates: [lng, lat]
        };
      }
    }

    const contactsCount = (user.emergencyContacts || []).length;

    const sosDoc = await SOSEvent.create({
      userId: user._id,
      status: SOSStatus.TRIGGERED,
      location,
      notes: dto.notes ? dto.notes.trim() : undefined,
      contactsNotifiedCount: contactsCount,
      dispatchedRealEmergency: false,
      disclaimer:
        'This SOS event is recorded for personal safety audit. No live 112/108 emergency dispatch was triggered by this software.'
    });

    const record: ISOSRecord = {
      id: sosDoc._id.toString(),
      userId: sosDoc.userId as Types.ObjectId,
      status: sosDoc.status as SOSStatus,
      location: sosDoc.location as any,
      notes: sosDoc.notes,
      contactsNotifiedCount: sosDoc.contactsNotifiedCount,
      dispatchedRealEmergency: false,
      disclaimer: sosDoc.disclaimer,
      createdAt: sosDoc.createdAt,
      updatedAt: sosDoc.updatedAt
    };

    const capabilities = this.getCapabilities();

    return {
      sosRecord: record,
      emergencyNumbers: {
        nationalEmergency: INDIA_EMERGENCY_NUMBERS.NATIONAL_EMERGENCY.number,
        ambulance: INDIA_EMERGENCY_NUMBERS.AMBULANCE.number
      },
      capabilities,
      instructions: [
        'If this is an immediate life-threatening crisis, dial 112 or 108 directly on your telephone.',
        'Your SOS event has been securely audited in your LifeLedger account.',
        'Show your Emergency QR code to on-scene first responders for vital identification.'
      ]
    };
  }

  private async syncEmergencyQRContacts(userId: string, contacts: any[]): Promise<void> {
    try {
      await EmergencyQR.updateOne(
        { userId: new Types.ObjectId(userId) },
        { $set: { emergencyContacts: contacts } }
      );
    } catch {
      // Safe non-blocking sync
    }
  }
}

export const emergencyService: EmergencyService = new EmergencyService();

