import { Router } from 'express';
import { healthRouter } from './health.routes';
import { authRouter } from './auth.routes';
import { userRouter } from './user.routes';
import { doctorRouter } from './doctor.routes';
import { dashboardRouter } from './dashboard.routes';
import { medicalReportRouter } from './medicalReport.routes';
import { aiRouter } from './ai.routes';
import { timelineRouter } from './timeline.routes';
import { hospitalRouter } from './hospital.routes';
import { doctorsRouter } from './doctors.routes';
import { emergencyRouter } from './emergency.routes';
import { ambulanceRouter } from './ambulance.routes';
import { appointmentRouter } from './appointment.routes';
import { healthIntelligenceRouter } from './healthIntelligence.routes';
import { familyRouter } from './family.routes';
import { medicalShareRouter } from './medicalShare.routes';
import { publicMedicalShareRouter } from './publicMedicalShare.routes';

const rootRouter = Router();

// Base health endpoint
rootRouter.use('/health', healthRouter);

// Version 1 API Router
const v1Router = Router();
v1Router.use('/health', healthRouter);
v1Router.use('/auth', authRouter);
v1Router.use('/users', userRouter);
v1Router.use('/doctors', doctorsRouter);
v1Router.use('/doctor', doctorRouter);
v1Router.use('/dashboard', dashboardRouter);
v1Router.use('/reports', medicalReportRouter);
v1Router.use('/ai', aiRouter);
v1Router.use('/timeline', timelineRouter);
v1Router.use('/health-intelligence', healthIntelligenceRouter);
v1Router.use('/hospitals', hospitalRouter);
v1Router.use('/emergency', emergencyRouter);
v1Router.use('/ambulances', ambulanceRouter);
v1Router.use('/appointments', appointmentRouter);
v1Router.use('/family', familyRouter);
v1Router.use('/medical-shares/public', publicMedicalShareRouter);
v1Router.use('/medical-shares', medicalShareRouter);
v1Router.use('/public/medical-shares', publicMedicalShareRouter);

rootRouter.use('/api/v1', v1Router);

export const appRouter = rootRouter;

