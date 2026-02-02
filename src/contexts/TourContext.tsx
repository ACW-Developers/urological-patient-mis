import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getTourConfig, TourStep, RoleTourConfig } from '@/lib/tourSteps';
import { useAuth } from '@/contexts/AuthContext';

export type VoiceType = 'male' | 'female';

interface TourContextType {
  isActive: boolean;
  isSpeaking: boolean;
  currentStepIndex: number;
  tourConfig: RoleTourConfig | null;
  currentStep: TourStep | null;
  voiceType: VoiceType;
  availableVoices: SpeechSynthesisVoice[];
  showFirstTimePrompt: boolean;
  setVoiceType: (type: VoiceType) => void;
  startTour: () => void;
  endTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipToStep: (index: number) => void;
  playOverview: () => void;
  stopSpeaking: () => void;
  dismissFirstTimePrompt: () => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { role, user } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [tourConfig, setTourConfig] = useState<RoleTourConfig | null>(null);
  const [voiceType, setVoiceType] = useState<VoiceType>('female');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [showFirstTimePrompt, setShowFirstTimePrompt] = useState(false);

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis?.getVoices() || [];
      setAvailableVoices(voices);
    };

    if ('speechSynthesis' in window) {
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Check for first-time user
  useEffect(() => {
    if (user && role) {
      const tourKey = `tourCompleted_${user.id}`;
      const hasCompletedTour = localStorage.getItem(tourKey);
      if (!hasCompletedTour) {
        // Small delay to let the UI settle after login
        const timer = setTimeout(() => {
          setShowFirstTimePrompt(true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [user, role]);

  useEffect(() => {
    if (role) {
      setTourConfig(getTourConfig(role));
    }
  }, [role]);

  const currentStep = tourConfig && currentStepIndex >= 0 
    ? tourConfig.steps[currentStepIndex] 
    : null;

  const getVoice = useCallback(() => {
    if (availableVoices.length === 0) return null;
    
    // Try to find a voice matching the preference
    const preferredGender = voiceType === 'female' ? ['female', 'woman'] : ['male', 'man'];
    
    // First try English voices
    const englishVoices = availableVoices.filter(v => v.lang.startsWith('en'));
    
    for (const voice of englishVoices) {
      const nameLower = voice.name.toLowerCase();
      if (preferredGender.some(g => nameLower.includes(g))) {
        return voice;
      }
    }
    
    // Common female voice names
    if (voiceType === 'female') {
      const femaleNames = ['samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona', 'kate', 'susan', 'zira'];
      for (const voice of englishVoices) {
        if (femaleNames.some(name => voice.name.toLowerCase().includes(name))) {
          return voice;
        }
      }
    }
    
    // Common male voice names
    if (voiceType === 'male') {
      const maleNames = ['daniel', 'david', 'james', 'alex', 'tom', 'george', 'mark'];
      for (const voice of englishVoices) {
        if (maleNames.some(name => voice.name.toLowerCase().includes(name))) {
          return voice;
        }
      }
    }
    
    // Fallback to first English voice or any voice
    return englishVoices[0] || availableVoices[0];
  }, [availableVoices, voiceType]);

  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = voiceType === 'female' ? 1.1 : 0.9;
      utterance.volume = 1;
      
      const voice = getVoice();
      if (voice) {
        utterance.voice = voice;
      }
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    }
  }, [voiceType, getVoice]);

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const dismissFirstTimePrompt = useCallback(() => {
    setShowFirstTimePrompt(false);
  }, []);

  const startTour = useCallback(() => {
    if (!tourConfig) return;
    setShowFirstTimePrompt(false);
    setIsActive(true);
    setCurrentStepIndex(-1);
  }, [tourConfig]);

  const endTour = useCallback(() => {
    stopSpeaking();
    setIsActive(false);
    setCurrentStepIndex(-1);
    if (user) {
      localStorage.setItem(`tourCompleted_${user.id}`, 'true');
    }
  }, [stopSpeaking, user]);

  const playOverview = useCallback(() => {
    if (tourConfig) {
      speak(tourConfig.overview);
    }
  }, [tourConfig, speak]);

  const nextStep = useCallback(() => {
    if (!tourConfig) return;
    
    if (currentStepIndex < tourConfig.steps.length - 1) {
      const newIndex = currentStepIndex + 1;
      setCurrentStepIndex(newIndex);
      speak(tourConfig.steps[newIndex].audioText);
    } else {
      endTour();
    }
  }, [currentStepIndex, tourConfig, speak, endTour]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      const newIndex = currentStepIndex - 1;
      setCurrentStepIndex(newIndex);
      if (tourConfig) {
        speak(tourConfig.steps[newIndex].audioText);
      }
    } else if (currentStepIndex === 0) {
      setCurrentStepIndex(-1);
    }
  }, [currentStepIndex, tourConfig, speak]);

  const skipToStep = useCallback((index: number) => {
    if (!tourConfig || index < 0 || index >= tourConfig.steps.length) return;
    setCurrentStepIndex(index);
    speak(tourConfig.steps[index].audioText);
  }, [tourConfig, speak]);

  return (
    <TourContext.Provider
      value={{
        isActive,
        isSpeaking,
        currentStepIndex,
        tourConfig,
        currentStep,
        voiceType,
        availableVoices,
        showFirstTimePrompt,
        setVoiceType,
        startTour,
        endTour,
        nextStep,
        prevStep,
        skipToStep,
        playOverview,
        stopSpeaking,
        dismissFirstTimePrompt,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (context === undefined) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}
