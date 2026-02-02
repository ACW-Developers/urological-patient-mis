

# AI-Powered System Walkthrough Implementation Plan

## Overview

This plan implements an interactive AI walkthrough feature that provides users with:
1. **Audio narration** - A 1-minute AI-generated voice overview of the system
2. **Guided tour** - Step-by-step highlighting of key modules based on user role
3. **Icon in navbar** - Easy access to start the walkthrough at any time

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                        Navbar                                │
│  [Theme] [Notifications] [🎯 Tour] [User Menu]              │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  AI Walkthrough System                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Tour Context │  │ Tour Dialog  │  │ ElevenLabs TTS   │  │
│  │  (State)     │  │  (UI Modal)  │  │ (Audio Engine)   │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│               Role-Based Tour Steps                          │
│  Admin: All modules                                          │
│  Nurse: Patients, Vitals, Appointments                       │
│  Doctor: Patients, Appointments, Lab, Prescriptions          │
│  Lab Tech: Lab Orders, Lab Results                           │
│  Pharmacist: Prescriptions, Pharmacy, History                │
└─────────────────────────────────────────────────────────────┘
```

## Features

### 1. AI Audio Overview (ElevenLabs Text-to-Speech)
- Creates an edge function to generate AI audio narration
- Produces a ~60 second overview of CardioRegistry
- Uses a professional, friendly voice
- Content is role-aware (different overview for different users)

### 2. Interactive Guided Tour
- Highlights each module section with spotlight effect
- Shows tooltip with description of each feature
- Navigation controls: Next, Previous, Skip
- Progress indicator
- Auto-advances after audio segment completes

### 3. Visual Effects
- Spotlight overlay that dims everything except current element
- Smooth CSS animations
- Pulsing indicator on navbar tour icon when available
- Sound effects integration with existing soundManager

## Implementation Steps

### Step 1: Create ElevenLabs TTS Edge Function
Create `supabase/functions/elevenlabs-tts/index.ts`:
- Accepts text and voice parameters
- Calls ElevenLabs API to generate speech
- Returns audio buffer for client playback
- Requires `ELEVENLABS_API_KEY` secret

### Step 2: Create Tour Context & Provider
Create `src/contexts/TourContext.tsx`:
- Manages tour state (active, currentStep, isPlaying)
- Stores role-specific tour steps
- Provides methods: startTour, nextStep, prevStep, endTour
- Handles audio playback coordination

### Step 3: Create Tour Spotlight Component
Create `src/components/tour/TourSpotlight.tsx`:
- Renders overlay with cutout for highlighted element
- Uses CSS clip-path or mask for spotlight effect
- Positions tooltip near highlighted element
- Includes navigation controls

### Step 4: Create Tour Dialog for Audio Overview
Create `src/components/tour/TourDialog.tsx`:
- Modal that plays the system overview audio
- Shows animated waveform or speaker icon
- Displays transcript text in sync
- Play/Pause/Stop controls
- Option to skip to interactive tour

### Step 5: Add Tour Icon to Navbar
Update `src/components/layout/Navbar.tsx`:
- Add "Sparkles" or "HelpCircle" icon button
- Triggers tour start on click
- Shows tooltip "Start System Tour"
- Subtle pulse animation to attract attention for first-time users

### Step 6: Define Role-Based Tour Steps
Create `src/lib/tourSteps.ts`:
- Define tour content for each module
- Map steps to DOM selectors
- Include audio script for each step
- Filter steps based on user role

### Step 7: Add Tour Styles
Update `src/index.css`:
- Spotlight overlay styles
- Tooltip positioning and animations
- Pulse animations for tour icon

## Role-Specific Tour Content

| Role | Modules Covered |
|------|-----------------|
| **Admin** | Dashboard, Patients, Appointments, Lab, Pharmacy, Surgery Suite, ICU, Reports, User Management, Settings |
| **Nurse** | Dashboard, Patients, Vitals, Appointments, Pre/Post-Operative, ICU |
| **Doctor** | Dashboard, My Patients, Consultation, Schedule, Lab Results, Prescriptions, Surgery Suite |
| **Lab Tech** | Dashboard, Lab Orders, Lab Results, Reports |
| **Pharmacist** | Dashboard, Prescriptions, Pharmacy, Dispensing History |

## Audio Script Example (Admin Overview)

> "Welcome to CardioRegistry, your comprehensive cardiovascular patient management system. From this dashboard, you can monitor patient statistics, today's appointments, and pending tasks at a glance. 
> 
> The left sidebar provides quick access to all modules: manage patients and their records, schedule and track appointments, order lab tests and review results, handle prescriptions and pharmacy dispensing, and coordinate surgical procedures from pre-op through ICU care.
> 
> As an administrator, you also have access to user management, system settings, and detailed activity logs. Let me walk you through each section."

## Technical Details

### Dependencies
- ElevenLabs API (for TTS)
- Existing `soundManager` for UI sounds

### New Files
- `supabase/functions/elevenlabs-tts/index.ts` - TTS edge function
- `src/contexts/TourContext.tsx` - Tour state management
- `src/components/tour/TourSpotlight.tsx` - Spotlight overlay
- `src/components/tour/TourDialog.tsx` - Audio overview modal
- `src/lib/tourSteps.ts` - Tour step definitions

### Modified Files
- `src/components/layout/Navbar.tsx` - Add tour trigger button
- `src/components/layout/MainLayout.tsx` - Wrap with TourProvider
- `src/index.css` - Tour-related styles

## User Experience Flow

1. User clicks tour icon (✨) in navbar
2. Dialog opens with "Start Tour" and audio play button
3. AI voice provides 60-second system overview
4. User can then choose "Take Interactive Tour" or "Close"
5. Interactive tour highlights each module with descriptions
6. Tour remembers completion state in localStorage

## Estimated Effort

- Edge function setup: ~15 mins
- Tour context & logic: ~30 mins
- Spotlight component: ~30 mins
- Audio dialog: ~20 mins
- Navbar integration: ~10 mins
- CSS animations: ~15 mins
- Testing & refinement: ~30 mins

**Total: ~2.5 hours**

