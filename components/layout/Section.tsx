import React from 'react';

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  id?: string; 
}

const Section: React.FC<SectionProps> = ({ children, className = '', id }) => {
  return (
    <section id={id} className={`mx-auto px-4 md:px-6 lg:px-12 xl:px-23 ${className}`}>
      {children}
    </section>
  );
};

export default Section;
