import { useEffect, useState, useRef } from "react";

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

export const SplashScreen = ({ onComplete, duration = 2000 }: SplashScreenProps) => {
  const [isExiting, setIsExiting] = useState(false);
  const hasCompleted = useRef(false);

  useEffect(() => {
    // Prevent double execution
    if (hasCompleted.current) return;

    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, duration - 500);

    const completeTimer = setTimeout(() => {
      if (!hasCompleted.current) {
        hasCompleted.current = true;
        onComplete();
      }
    }, duration);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [duration, onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        isExiting ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Logo with pulse animation */}
      <div className="relative mb-8">
        <div className="absolute inset-0 rounded-2xl bg-primary/20 animate-ping" />
        <img
          src="/logo.jpg"
          alt="Aitel"
          className="relative h-24 w-24 rounded-2xl shadow-lg animate-scale-in"
        />
      </div>

      {/* App name */}
      <h1 className="text-3xl font-bold mb-2 animate-fade-in">Aitel</h1>
      <p className="text-muted-foreground text-sm animate-fade-in" style={{ animationDelay: "0.2s" }}>
        Telecalling Console
      </p>

      {/* Loading indicator */}
      <div className="mt-12 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-2 w-2 rounded-full bg-primary animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
};
