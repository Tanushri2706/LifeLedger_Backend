# Database Design - LifeLedger

Technology: MongoDB Atlas (ODM: Mongoose)

---

# Naming Conventions
- Collections: camelCase (e.g., `users`, `medicalReports`, `appointments`)
- Models: PascalCase singular (e.g., `User`, `Doctor`, `MedicalReport`, `Appointment`)

---

# Collections & Fields

## Users
- `_id`, `firstName`, `lastName`, `email`, `phone`, `password`, `googleId`, `appleId`, `avatar`, `dateOfBirth`, `gender`, `bloodGroup`, `height`, `weight`, `emergencyContact`, `address`, `city`, `state`, `country`, `pincode`, `role`, `healthScore`, `isVerified`, `isDeleted`, `createdAt`, `updatedAt`
- Indexes: `email` (unique), `phone` (unique), `googleId` (unique)

## Doctors
- `_id`, `userId`, `licenseNumber`, `specialization`, `experience`, `qualification`, `hospital`, `consultationFee`, `languages`, `availability`, `rating`, `reviewCount`, `verified`, `createdAt`, `updatedAt`
- Indexes: `licenseNumber` (unique), `specialization`, `hospital`

## Medical Reports
- `_id`, `userId`, `title`, `category`, `reportType`, `hospital`, `doctor`, `reportDate`, `cloudinaryUrl`, `thumbnail`, `fileType`, `fileSize`, `ocrText`, `aiSummary`, `healthScore`, `riskLevel`, `healthStory`, `timelineGenerated`, `createdAt`, `updatedAt`
- Indexes: `userId`, `reportDate`, `category`

## Appointments
- `_id`, `patientId`, `doctorId`, `hospital`, `appointmentDate`, `timeSlot`, `status`, `consultationType`, `notes`, `prescriptionId`, `createdAt`, `updatedAt`
- Indexes: `patientId`, `doctorId`, `appointmentDate`

## Prescriptions
- `_id`, `appointmentId`, `doctorId`, `patientId`, `medicines`, `instructions`, `nextVisit`, `createdAt`, `updatedAt`

## Hospitals
- `_id`, `name`, `address`, `location`, `rating`, `phone`, `website`, `specialities`, `emergencyAvailable`, `ambulanceAvailable`, `createdAt`, `updatedAt`
- Indexes: `location` (2dsphere)

## Ambulances
- `_id`, `hospitalId`, `type`, `driverName`, `driverPhone`, `status`, `currentLocation`, `createdAt`, `updatedAt`
- Indexes: `currentLocation` (2dsphere)

## Health Timeline
- `_id`, `userId`, `eventType`, `title`, `description`, `date`, `relatedReport`, `createdAt`
- Indexes: `userId`, `date`

## Family Members
- `_id`, `ownerId`, `memberName`, `relationship`, `dateOfBirth`, `gender`, `bloodGroup`, `linkedUser`, `permissions`, `createdAt`

## Notifications
- `_id`, `userId`, `title`, `message`, `type`, `isRead`, `createdAt`
- Indexes: `userId`, `isRead`

## Emergency QR
- `_id`, `userId`, `qrCode`, `bloodGroup`, `allergies`, `emergencyContacts`, `medicalConditions`, `createdAt`, `updatedAt`
