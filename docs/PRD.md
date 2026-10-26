# Product Requirements Document (PRD) — LifeLedger

## 1. Introduction & Product Vision
LifeLedger is an **AI-powered Personal Health Intelligence Platform**. It is designed to act as a digital health companion, translating raw, confusing medical reports into clear timelines and stories. LifeLedger is NOT a Hospital Management System, billing portal, or telemedicine ERP. It focuses purely on helping users understand and organize their personal healthcare through artificial intelligence.

---

## 2. Core Customer Value Proposition
* **Trust & Privacy**: Secure document vault keeping personal medical reports encrypted and private.
* **Understanding**: Translating complex jargon into simple, supportive, and educational narratives.
* **Proactivity**: Spotting potential drug interactions and predicting general health risk trends.
* **Access**: Seamless lookup of nearby clinics and quick access to emergency medical facts via a QR Code.

---

## 3. Product Modules & Functional Specifications

### Module 1: Personal Dashboard
* **Aggregated Summary**: Visual summary displaying Health Score, Notification counts, upcoming appointments, and AI-driven insights.
* **Quick Actions**: Hotlinks to upload a report, book a slot, check medicine compatibility, and view the Emergency QR.

### Module 2: Digital Health Vault
* **Document Upload**: Supports PDF, JPG, and PNG uploads to Cloudinary storage.
* **Record Classification**: Automatic or manual categorization (e.g., Blood Report, ECG, Prescription).
* **Search & Filters**: Quick filters by medical entity, facility, doctor, or dates.

### Module 3: AI Intelligence
* **Multimodal Deciphering**: Gemini AI parses medical document images/PDFs.
* **Health Story**: A narrative health journey generated using clear, supportive, and non-alarmist language.
* **Drug Interaction Checker**: Searches compatibility constraints between active prescriptions.
* **Medical Disclaimer**: Standard disclaimer displayed on all AI views: *"This AI analysis is for informational purposes only and is not a medical diagnosis."*

### Module 4: Health Timeline
* **Chronological Milestones**: Combines diagnostic records, lab tests, and doctor visits into a visual timeline.

### Module 5: Nearby Healthcare
* **clinic Locator**: Queries nearby clinics, hospitals, and pharmacies based on user geolocations using Google Maps API.

### Module 6: Appointments & Prescriptions
* **Scheduling**: Calendar tool allowing patients to search and book appointments with doctors.
* **Prescriptions**: Links a structured prescription (medicines, dosages, instructions) to each appointment.

### Module 7: Family Health Vault
* **Shared Access**: Add family member profiles and grant Read-Only or Full Access rights.

### Module 8: Emergency QR Card
* **Emergency Profile**: Displays a secure page containing blood group, allergies, conditions, and emergency contacts.
* **Unique Token Lookup**: Looked up via a secure, high-entropy token, preventing ID scanning attacks.

---

## 4. Non-Functional Requirements
* **Data Security**: Encrypted database items, HTTPS-only API streams, and split JWT credentials.
* **Theme Syncing**: Comprehensive Light, Dark, and System color matching.
* **Responsive Layouts**: No horizontal scrolling; fully optimized for mobile, tablet, and desktop viewports.
* **Performance**: Fast page loads utilizing Next.js Server Components, image optimizations, and cached database queries.
