import { Types } from 'mongoose';
import { User, Doctor, UserDocument } from '../models';
import {
  UserRole,
  UpdateDoctorProfileDto,
  GetDoctorsQueryDto,
  PublicDoctorProfileDto,
  SearchDoctorsQueryDto,
  GetDoctorAvailabilityQueryDto,
  IDoctorAvailability
} from '../types';
import { AppError } from '../utils';
import { userService } from './user.service';

export class DoctorService {
  private formatPublicDoctorProfile(doctor: any, userDoc?: any): PublicDoctorProfileDto {
    const doctorJson = doctor && typeof doctor.toJSON === 'function' ? doctor.toJSON() : (doctor || {});
    const rawUser = userDoc || (doctorJson.userId && typeof doctorJson.userId === 'object' ? doctorJson.userId : null);
    const user = rawUser && typeof rawUser.toJSON === 'function' ? rawUser.toJSON() : (rawUser || {});

    const firstName: string = (user?.firstName as string) || 'Doctor';
    const lastName: string = (user?.lastName as string) || '';
    const fullName = `Dr. ${firstName} ${lastName}`.trim();

    return {
      id: doctorJson._id ? doctorJson._id.toString() : String(doctor?._id || ''),
      userId: user?._id ? user._id.toString() : (doctorJson.userId ? doctorJson.userId.toString() : ''),
      name: fullName,
      firstName,
      lastName,
      avatar: user?.avatar as string | undefined,
      gender: user?.gender as string | undefined,
      city: user?.city as string | undefined,
      state: user?.state as string | undefined,
      specialization: (doctorJson.specialization as string) || 'General Medicine',
      experience: Number(doctorJson.experience) || 0,
      qualification: (doctorJson.qualification as string) || 'MBBS',
      hospital: (doctorJson.hospital as string) || 'Clinic',
      consultationFee: Number(doctorJson.consultationFee) || 0,
      languages: Array.isArray(doctorJson.languages) ? doctorJson.languages : ['English'],
      availability: Array.isArray(doctorJson.availability) ? doctorJson.availability : [],
      rating: Number(doctorJson.rating) || 0,
      reviewCount: Number(doctorJson.reviewCount) || 0,
      verified: Boolean(doctorJson.verified),
      createdAt: doctorJson.createdAt ? new Date(doctorJson.createdAt) : new Date()
    };
  }

  public async getDoctorProfile(userId: string) {
    const user = await User.findOne({ _id: userId, isDeleted: false, role: UserRole.DOCTOR });
    if (!user) {
      throw new AppError('Doctor account not found', 404);
    }

    const doctor = await Doctor.findOne({ userId: user._id });
    if (!doctor) {
      throw new AppError('Doctor professional profile record not found', 404);
    }

    const userJson = user.toJSON();
    const doctorJson = doctor.toJSON();

    return {
      user: {
        id: userJson._id.toString(),
        firstName: userJson.firstName,
        lastName: userJson.lastName,
        email: userJson.email,
        phone: userJson.phone,
        avatar: userJson.avatar,
        gender: userJson.gender,
        dateOfBirth: userJson.dateOfBirth,
        bloodGroup: userJson.bloodGroup,
        address: userJson.address,
        city: userJson.city,
        state: userJson.state,
        country: userJson.country,
        pincode: userJson.pincode,
        role: userJson.role,
        isVerified: userJson.isVerified,
        createdAt: userJson.createdAt,
        updatedAt: userJson.updatedAt
      },
      doctor: {
        id: doctorJson._id.toString(),
        licenseNumber: doctorJson.licenseNumber,
        specialization: doctorJson.specialization,
        experience: doctorJson.experience,
        qualification: doctorJson.qualification,
        hospital: doctorJson.hospital,
        consultationFee: doctorJson.consultationFee,
        languages: doctorJson.languages,
        availability: doctorJson.availability,
        rating: doctorJson.rating,
        reviewCount: doctorJson.reviewCount,
        verified: doctorJson.verified,
        createdAt: doctorJson.createdAt,
        updatedAt: doctorJson.updatedAt
      }
    };
  }

  public async updateDoctorProfile(userId: string, dto: UpdateDoctorProfileDto) {
    const user = await User.findOne({ _id: userId, isDeleted: false, role: UserRole.DOCTOR });
    if (!user) {
      throw new AppError('Doctor account not found', 404);
    }

    let doctor = await Doctor.findOne({ userId: user._id });
    if (!doctor) {
      // Auto-create doctor record if onboarding
      doctor = new Doctor({
        userId: user._id,
        licenseNumber: `MED-${Date.now().toString().slice(-6)}`,
        specialization: dto.specialization || 'General Medicine',
        experience: dto.experience || 1,
        qualification: dto.qualification || 'MBBS',
        hospital: dto.hospital || 'General Clinic',
        consultationFee: dto.consultationFee || 500,
        languages: dto.languages || ['English'],
        availability: dto.availability || [],
        verified: false
      });
    }

    // 1. Update personal profile fields if provided
    await userService.updateProfile(userId, dto);

    // 2. Validate & Update Professional Fields
    if (dto.specialization !== undefined) {
      if (typeof dto.specialization !== 'string' || !dto.specialization.trim() || dto.specialization.trim().length > 100) {
        throw new AppError('Specialization must be between 1 and 100 characters', 400);
      }
      doctor.specialization = dto.specialization.trim();
    }

    if (dto.experience !== undefined) {
      if (typeof dto.experience !== 'number' || isNaN(dto.experience) || dto.experience < 0 || dto.experience > 70) {
        throw new AppError('Experience must be a valid number of years between 0 and 70', 400);
      }
      doctor.experience = dto.experience;
    }

    if (dto.qualification !== undefined) {
      if (typeof dto.qualification !== 'string' || !dto.qualification.trim() || dto.qualification.trim().length > 200) {
        throw new AppError('Qualification must be between 1 and 200 characters', 400);
      }
      doctor.qualification = dto.qualification.trim();
    }

    if (dto.hospital !== undefined) {
      if (typeof dto.hospital !== 'string' || !dto.hospital.trim() || dto.hospital.trim().length > 200) {
        throw new AppError('Hospital/Clinic name must be between 1 and 200 characters', 400);
      }
      doctor.hospital = dto.hospital.trim();
    }

    if (dto.consultationFee !== undefined) {
      if (typeof dto.consultationFee !== 'number' || isNaN(dto.consultationFee) || dto.consultationFee < 0) {
        throw new AppError('Consultation fee must be a non-negative number', 400);
      }
      doctor.consultationFee = dto.consultationFee;
    }

    if (dto.languages !== undefined) {
      if (!Array.isArray(dto.languages) || dto.languages.some((l) => typeof l !== 'string' || !l.trim())) {
        throw new AppError('Languages must be an array of non-empty strings', 400);
      }
      doctor.languages = dto.languages.map((l) => l.trim());
    }

    if (dto.availability !== undefined) {
      if (!Array.isArray(dto.availability)) {
        throw new AppError('Availability must be an array of day/slot schedules', 400);
      }
      doctor.availability = dto.availability;
    }

    await doctor.save();
    return this.getDoctorProfile(userId);
  }

  // --- Doctor Discovery APIs ---

  public async getDoctors(query: GetDoctorsQueryDto): Promise<{
    doctors: PublicDoctorProfileDto[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const page = Math.max(1, parseInt(String(query.page), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(query.limit), 10) || 10));
    const skip = (page - 1) * limit;

    const doctorMatch: Record<string, unknown> = {};

    const rawSpecialization = query.specialization || query.specialty;
    if (rawSpecialization && rawSpecialization.trim()) {
      doctorMatch.specialization = { $regex: new RegExp(rawSpecialization.trim(), 'i') };
    }

    if (query.hospital && query.hospital.trim()) {
      doctorMatch.hospital = { $regex: new RegExp(query.hospital.trim(), 'i') };
    }

    if (query.minRating !== undefined) {
      const minRating = parseFloat(String(query.minRating));
      if (!isNaN(minRating)) {
        doctorMatch.rating = { $gte: minRating };
      }
    }

    if (query.maxFee !== undefined) {
      const maxFee = parseFloat(String(query.maxFee));
      if (!isNaN(maxFee)) {
        doctorMatch.consultationFee = { $lte: maxFee };
      }
    }

    if (query.verified !== undefined) {
      doctorMatch.verified = String(query.verified).toLowerCase() === 'true';
    }

    const searchTerm = (query.search || query.query || query.q || '').trim();

    // If search keyword or city filter is present, we filter user IDs
    if (searchTerm || (query.city && query.city.trim())) {
      const userMatch: Record<string, unknown> = {
        role: UserRole.DOCTOR,
        isDeleted: false
      };

      if (query.city && query.city.trim()) {
        userMatch.city = { $regex: new RegExp(query.city.trim(), 'i') };
      }

      if (searchTerm) {
        const searchRegex = { $regex: new RegExp(searchTerm, 'i') };
        userMatch.$or = [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { city: searchRegex }
        ];
      }

      const matchingUsers = await User.find(userMatch).select('_id');
      const matchingUserIds = matchingUsers.map((u) => u._id);

      if (searchTerm) {
        // Also allow matching directly on doctor's specialization, hospital, or qualification
        const searchRegex = { $regex: new RegExp(searchTerm, 'i') };
        doctorMatch.$or = [
          { userId: { $in: matchingUserIds } },
          { specialization: searchRegex },
          { hospital: searchRegex },
          { qualification: searchRegex }
        ];
      } else {
        doctorMatch.userId = { $in: matchingUserIds };
      }
    }

    const [total, doctorDocs] = await Promise.all([
      Doctor.countDocuments(doctorMatch),
      Doctor.find(doctorMatch)
        .populate<{ userId: UserDocument }>({
          path: 'userId',
          match: { isDeleted: false },
          select: 'firstName lastName avatar city state gender'
        })
        .sort({ rating: -1, reviewCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
    ]);

    const doctors = doctorDocs
      .filter((doc) => doc.userId !== null && doc.userId !== undefined)
      .map((doc) => this.formatPublicDoctorProfile(doc, doc.userId as unknown as UserDocument));

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      doctors,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    };
  }

  public async getDoctorById(id: string): Promise<{ doctor: PublicDoctorProfileDto }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Doctor not found', 404);
    }

    const objectId = new Types.ObjectId(id);
    const doctor = await Doctor.findOne({
      $or: [{ _id: objectId }, { userId: objectId }]
    }).populate<{ userId: UserDocument }>({
      path: 'userId',
      match: { isDeleted: false },
      select: 'firstName lastName avatar city state gender'
    });

    if (!doctor || !doctor.userId) {
      throw new AppError('Doctor not found', 404);
    }

    return {
      doctor: this.formatPublicDoctorProfile(doctor, doctor.userId as unknown as UserDocument)
    };
  }

  public async searchDoctors(query: SearchDoctorsQueryDto) {
    const searchTerm = query.search || query.query || query.q || '';
    return this.getDoctors({
      search: searchTerm,
      specialization: query.specialization,
      hospital: query.hospital,
      city: query.city,
      page: query.page,
      limit: query.limit
    });
  }

  public async getSpecializations(): Promise<{ specializations: string[]; count: number }> {
    const distinctList = await Doctor.distinct('specialization');
    const sorted = (distinctList as string[]).filter(Boolean).sort();
    return {
      specializations: sorted,
      count: sorted.length
    };
  }

  public async getDoctorAvailability(query: GetDoctorAvailabilityQueryDto): Promise<{
    availability: Array<{
      doctorId: string;
      doctorName: string;
      specialization: string;
      hospital: string;
      schedule: IDoctorAvailability[];
    }>;
  }> {
    const doctorMatch: Record<string, unknown> = {};

    const targetId = query.doctorId || query.id;
    if (targetId) {
      if (!Types.ObjectId.isValid(targetId)) {
        throw new AppError('Invalid doctor identifier', 400);
      }
      const objectId = new Types.ObjectId(targetId);
      doctorMatch.$or = [{ _id: objectId }, { userId: objectId }];
    }

    const doctors = await Doctor.find(doctorMatch).populate<{ userId: UserDocument }>({
      path: 'userId',
      match: { isDeleted: false },
      select: 'firstName lastName'
    });

    const dayFilter = query.day?.toLowerCase().trim();

    const availability = doctors
      .filter((d) => d.userId)
      .map((d) => {
        let schedule = d.availability || [];
        if (dayFilter) {
          schedule = schedule.filter((s) => s.day.toLowerCase() === dayFilter);
        }
        const user = d.userId as unknown as UserDocument;
        return {
          doctorId: d._id.toString(),
          doctorName: `Dr. ${user.firstName || ''} ${user.lastName || ''}`.trim(),
          specialization: d.specialization,
          hospital: d.hospital,
          schedule
        };
      });

    return { availability };
  }
}

export const doctorService: DoctorService = new DoctorService();
