import React from 'react';

interface TypographyProps {
  children: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div';
}

export function Display({ children, className = '', as: Component = 'h1' }: TypographyProps) {
  return <Component className={`text-display text-primary-text ${className}`}>{children}</Component>;
}

export function Heading1({ children, className = '', as: Component = 'h1' }: TypographyProps) {
  return <Component className={`text-h1 text-primary-text ${className}`}>{children}</Component>;
}

export function Heading2({ children, className = '', as: Component = 'h2' }: TypographyProps) {
  return <Component className={`text-h2 text-primary-text ${className}`}>{children}</Component>;
}

export function Body({ children, className = '', as: Component = 'p' }: TypographyProps) {
  return <Component className={`text-body text-primary-text ${className}`}>{children}</Component>;
}

export function Caption({ children, className = '', as: Component = 'span' }: TypographyProps) {
  return <Component className={`text-caption text-secondary-text ${className}`}>{children}</Component>;
}

export function Small({ children, className = '', as: Component = 'span' }: TypographyProps) {
  return <Component className={`text-small text-secondary-text ${className}`}>{children}</Component>;
}
