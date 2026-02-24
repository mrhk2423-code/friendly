import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface VerifiedBadgeProps {
  username?: string;
  isVerified?: boolean | number;
  className?: string;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ username, isVerified, className = "w-4 h-4" }) => {
  if (isVerified || username === 'hkahad') {
    return (
      <span className={`inline-flex items-center justify-center bg-accent text-white rounded-full font-bold text-[10px] ${className}`}>
        v
      </span>
    );
  }
  return null;
};
