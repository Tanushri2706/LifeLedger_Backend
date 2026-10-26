# Design System - LifeLedger

Tagline: Connecting You to Better Healthcare.

---

# Design Philosophy
LifeLedger is a premium AI-powered healthcare platform.
The user interface should feel trustworthy, elegant, modern, and minimal.
The visual experience should resemble products like:
- Apple
- Stripe
- Linear
- Notion
- CRED
- Google Health

The design should never feel like a traditional hospital website or a college project.
Users should immediately feel:
- Trust
- Simplicity
- Professionalism
- Intelligence
- Cleanliness

---

# Design Principles
Always prefer:
- White space
- Large typography
- Clean layouts
- Rounded components
- Glassmorphism
- Soft shadows
- Smooth animations
- Consistent spacing
- Minimal colors
- Beautiful micro-interactions

Avoid:
- Cluttered UI
- Too many colors
- Heavy borders
- Bootstrap appearance
- Generic admin dashboards
- Excessive animations

---

# Color Palette

## Primary
Royal Blue: `#2563EB`
Purpose: Brand identity, Buttons, Links, Highlights

## Secondary
Sky Blue: `#3B82F6`
Purpose: Cards, Accents, Illustrations

## Accent
Cyan: `#06B6D4`
Purpose: Highlights, Icons, Interactive Elements

## Feedback Colors
- Success: `#22C55E`
- Warning: `#F59E0B`
- Danger: `#EF4444`

## Backgrounds
- Background: `#F8FAFC`
- Surface: White (`#FFFFFF`)
- Dark Theme Background: `#0F172A`

---

# Typography
- Headings: Sora (Fallback: Inter)
- Body: Inter
- Code: JetBrains Mono

---

# Border Radius
- Cards: 20px
- Buttons: 12px
- Inputs: 14px
- Badges: 999px
- Modals: 24px

---

# Shadows
- Use soft shadows only.
- Avoid dark shadows.
- Cards should appear elevated but lightweight.

---

# Icons
- Use Lucide React.
- Do not mix icon libraries.

---

# UI Components & Behaviors
- **Buttons**: Primary (Filled Blue), Secondary (Outlined), Ghost, Text Only, Danger (Red). Include loading and disabled states.
- **Cards**: Large radius, soft shadow, glass effect where appropriate, consistent padding, and hover lift animations.
- **Forms**: React Hook Form, Zod Validation, animated labels, validation messages, rounded inputs.
- **Tables**: Rounded, searchable, sortable, pagination ready, responsive.
- **Modals**: Glassmorphism, blur background, rounded corners, smooth animation.
- **Animations**: Only Framer Motion (Fade, Slide, Scale, Hover Lift, Page Transition, Stagger, Floating, Counter). Avoid bounce, spin, flash, aggressive movement.
- **Theme**: Light, Dark, System. Persist user preference.

---

# Layout structures
- **Landing Page**: Hero, Statistics, Features, AI Preview, Health Timeline Preview, How It Works, Testimonials, FAQs, Call To Action, Footer.
- **Dashboard Layout**: Sidebar, Top Navbar, Quick Actions, Health Score, Timeline, Recent Reports, Upcoming Appointments, AI Insights, Emergency Button, Nearby Hospitals, Notifications.
- **Empty States**: Meaningful empty states on every page.
- **Loading States**: Skeleton loaders, progress indicators, loading spinners.
- **Error States**: Professional illustrations, helpful messages, retry button.

---

# UI Libraries
- Primary: HeroUI
- Additional: Magic UI, Aceternity UI
- Animations: Framer Motion
- Icons: Lucide React
- Charts: Recharts
