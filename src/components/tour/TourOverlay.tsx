import { useEffect, useState, useRef } from 'react';
import { useTour, VoiceType } from '@/contexts/TourContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Play, 
  Pause, 
  SkipForward, 
  ChevronLeft, 
  ChevronRight, 
  X,
  Volume2,
  VolumeX,
  Sparkles,
  User,
  UserCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// First-time user prompt component
function FirstTimePrompt() {
  const { showFirstTimePrompt, startTour, dismissFirstTimePrompt } = useTour();

  return (
    <Dialog open={showFirstTimePrompt} onOpenChange={(open) => !open && dismissFirstTimePrompt()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">Welcome to CardioRegistry!</DialogTitle>
          <DialogDescription className="text-center">
            It looks like this is your first time here. Would you like a quick guided tour of the system?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
          <Button variant="outline" onClick={dismissFirstTimePrompt} className="flex-1">
            Maybe Later
          </Button>
          <Button onClick={startTour} className="flex-1">
            <Sparkles className="w-4 h-4 mr-2" />
            Start Tour
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Voice selector component
function VoiceSelector() {
  const { voiceType, setVoiceType } = useTour();

  return (
    <div className="flex items-center gap-1 bg-muted rounded-full p-1">
      <button
        onClick={() => setVoiceType('female')}
        className={cn(
          "flex items-center gap-1 px-3 py-1 rounded-full text-xs transition-all",
          voiceType === 'female' 
            ? "bg-primary text-primary-foreground" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <UserCircle className="w-3 h-3" />
        Female
      </button>
      <button
        onClick={() => setVoiceType('male')}
        className={cn(
          "flex items-center gap-1 px-3 py-1 rounded-full text-xs transition-all",
          voiceType === 'male' 
            ? "bg-primary text-primary-foreground" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <User className="w-3 h-3" />
        Male
      </button>
    </div>
  );
}

export function TourOverlay() {
  const {
    isActive,
    isSpeaking,
    currentStepIndex,
    tourConfig,
    currentStep,
    endTour,
    nextStep,
    prevStep,
    playOverview,
    stopSpeaking,
  } = useTour();

  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Find and highlight the current element
  useEffect(() => {
    if (!isActive || !currentStep?.selector) {
      setHighlightRect(null);
      return;
    }

    const element = document.querySelector(currentStep.selector);
    if (element) {
      const rect = element.getBoundingClientRect();
      setHighlightRect(rect);
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      setHighlightRect(null);
    }
  }, [isActive, currentStep]);

  // Always render the first-time prompt
  if (!isActive && !tourConfig) {
    return <FirstTimePrompt />;
  }

  if (!isActive) {
    return <FirstTimePrompt />;
  }

  const isOverview = currentStepIndex === -1;
  const totalSteps = tourConfig?.steps.length || 0;
  const progress = isOverview ? 0 : ((currentStepIndex + 1) / totalSteps) * 100;

  return (
    <>
      <FirstTimePrompt />
      <div 
        ref={overlayRef}
        className="fixed inset-0 z-[100] pointer-events-none"
      >
        {/* Backdrop overlay */}
        <div 
          className="absolute inset-0 bg-black/60 pointer-events-auto transition-opacity duration-300"
          onClick={endTour}
        />
        
        {/* Spotlight cutout for highlighted element */}
        {highlightRect && (
          <div
            className="absolute bg-transparent border-4 border-primary rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] pointer-events-none transition-all duration-300"
            style={{
              top: highlightRect.top - 8,
              left: highlightRect.left - 8,
              width: highlightRect.width + 16,
              height: highlightRect.height + 16,
            }}
          />
        )}

        {/* Tour card */}
        <Card className={cn(
          "fixed pointer-events-auto shadow-2xl border-2 border-primary/20 max-w-md w-[90vw]",
          isOverview 
            ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            : highlightRect
              ? "bottom-8 left-1/2 -translate-x-1/2"
              : "bottom-8 left-1/2 -translate-x-1/2"
        )}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              {isSpeaking ? (
                <Volume2 className="w-5 h-5 text-primary animate-pulse" />
              ) : (
                <VolumeX className="w-5 h-5 text-muted-foreground" />
              )}
              <span className="font-semibold text-sm">
                {isOverview ? 'System Overview' : `Step ${currentStepIndex + 1} of ${totalSteps}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <VoiceSelector />
              <Button variant="ghost" size="icon" onClick={endTour} className="h-8 w-8">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            <h3 className="font-bold text-lg mb-2">
              {isOverview ? 'Welcome to CardioRegistry' : currentStep?.title}
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {isOverview ? tourConfig?.overview : currentStep?.description}
            </p>
          </div>

          {/* Progress bar */}
          <div className="px-4 pb-2">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between p-4 pt-2 border-t border-border">
            <div className="flex gap-2">
              {isSpeaking ? (
                <Button variant="outline" size="sm" onClick={stopSpeaking}>
                  <Pause className="w-4 h-4 mr-1" />
                  Pause
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={isOverview ? playOverview : () => {}}>
                  <Play className="w-4 h-4 mr-1" />
                  {isOverview ? 'Play Audio' : 'Replay'}
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              {!isOverview && (
                <Button variant="ghost" size="sm" onClick={prevStep}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              )}
              <Button size="sm" onClick={nextStep}>
                {isOverview ? (
                  <>
                    Start Tour
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                ) : currentStepIndex === totalSteps - 1 ? (
                  'Finish'
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
              {isOverview && (
                <Button variant="ghost" size="sm" onClick={endTour}>
                  <SkipForward className="w-4 h-4 mr-1" />
                  Skip
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
