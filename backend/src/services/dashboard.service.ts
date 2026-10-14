import { User, Doctor, MedicalReport, HealthTimeline } from '../models';
import { UserRole, IAuthenticatedUser, IUserDashboardData, IDoctorDashboardData } from '../types';
import { AppError } from '../utils';

export class DashboardService {
  private calculateProfileCompletion(user: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    avatar?: string;
    gender?: string;
    dateOfBirth?: Date;
    bloodGroup?: string;
    height?: number;
    weight?: number;
    emergencyContact?: { name?: string; phone?: string };
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    pincode?: string;
  }): number {
    const fields = [
      user.firstName,
      user.lastName,
      user.email,
      user.phone,
      user.avatar,
      user.gender,
      user.dateOfBirth,
      user.bloodGroup,
      user.height,
      user.weight,
      user.emergencyContact?.name || user.emergencyContact?.phone,
      user.address,
      user.city,
      user.state,
      user.country,
      user.pincode
    ];

    const filledCount = fields.filter((f) => f !== undefined && f !== null && f !== '').length;
    return Math.round((filledCount / fields.length) * 100);
  }

  public async getUserDashboard(userId: string): Promise<IUserDashboardData> {
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      throw new AppError('User account not found', 404);
    }

    const completionPercentage = this.calculateProfileCompletion(user);

    let bmi: number | null = null;
    if (user.height && user.weight && user.height > 0) {
      const heightInMeters = user.height / 100;
      bmi = Number((user.weight / (heightInMeters * heightInMeters)).toFixed(1));
    }

    const personalReportFilter = {
      $or: [
        { ownerUserId: user._id, subjectType: 'user' },
        { userId: user._id, subjectType: { $in: [null, undefined, 'user'] } }
      ],
      isDeleted: false
    };

    const personalTimelineFilter = {
      $or: [
        { ownerUserId: user._id, subjectType: 'user' },
        { userId: user._id, subjectType: { $in: [null, undefined, 'user'] } }
      ],
      isDeleted: false
    };

    const [totalReports, recentReports, totalTimelineEvents, recentTimelineEvents] = await Promise.all([
      MedicalReport.countDocuments(personalReportFilter),
      MedicalReport.find(personalReportFilter)
        .sort({ reportDate: -1, createdAt: -1 })
        .limit(5),
      HealthTimeline.countDocuments(personalTimelineFilter),
      HealthTimeline.find(personalTimelineFilter)
        .sort({ date: -1, createdAt: -1 })
        .limit(5)
    ]);

    return {
      profileSummary: {
        id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        isVerified: user.isVerified,
        healthScore: user.healthScore,
        bloodGroup: user.bloodGroup,
        emergencyContact: user.emergencyContact
      },
      accountStatus: {
        isVerified: user.isVerified,
        isProfileComplete: completionPercentage >= 80,
        memberSince: user.createdAt,
        lastUpdated: user.updatedAt
      },
      vitals: {
        height: user.height,
        weight: user.weight,
        bmi
      },
      metrics: {
        healthScore: user.healthScore,
        profileCompletionPercentage: completionPercentage
      },
      healthVault: {
        totalReports,
        recentReports: recentReports.map((r) => ({
          id: r._id.toString(),
          title: r.title,
          category: r.category,
          reportDate: r.reportDate,
          fileUrl: r.fileUrl
        }))
      },
      timelinePreview: {
        totalEvents: totalTimelineEvents,
        recentEvents: recentTimelineEvents.map((e) => ({
          id: e._id.toString(),
          eventType: e.eventType,
          title: e.title,
          description: e.description,
          date: e.date,
          sourceType: e.sourceType
        }))
      }
    };
  }

  public async getDoctorDashboard(userId: string): Promise<IDoctorDashboardData> {
    const user = await User.findOne({ _id: userId, isDeleted: false, role: UserRole.DOCTOR });
    if (!user) {
      throw new AppError('Doctor account not found', 404);
    }

    const doctor = await Doctor.findOne({ userId: user._id });
    if (!doctor) {
      throw new AppError('Doctor professional profile record not found', 404);
    }

    const totalSlotsCount = doctor.availability
      ? doctor.availability.reduce((acc, curr) => acc + (curr.slots ? curr.slots.length : 0), 0)
      : 0;

    return {
      profileSummary: {
        id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        isVerified: user.isVerified
      },
      professionalSummary: {
        doctorId: doctor._id.toString(),
        licenseNumber: doctor.licenseNumber,
        specialization: doctor.specialization,
        experience: doctor.experience,
        qualification: doctor.qualification,
        hospital: doctor.hospital,
        consultationFee: doctor.consultationFee,
        languages: doctor.languages,
        availabilitySlotCount: totalSlotsCount,
        verified: doctor.verified
      },
      accountStatus: {
        isVerified: user.isVerified,
        licenseVerified: doctor.verified,
        memberSince: user.createdAt,
        lastUpdated: doctor.updatedAt
      },
      metrics: {
        rating: doctor.rating,
        reviewCount: doctor.reviewCount,
        experienceYears: doctor.experience
      }
    };
  }

  public async getDashboard(authenticatedUser: IAuthenticatedUser) {
    if (authenticatedUser.role === UserRole.DOCTOR) {
      const doctorDashboard = await this.getDoctorDashboard(authenticatedUser.id);
      return { dashboard: doctorDashboard };
    }

    const userDashboard = await this.getUserDashboard(authenticatedUser.id);
    return { dashboard: userDashboard };
  }
}

export const dashboardService: DashboardService = new DashboardService();
