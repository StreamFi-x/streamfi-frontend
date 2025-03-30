import React from 'react';

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

const Section: React.FC<SectionProps> = ({ children, className = '', id }) => {
  return (
    <section id={id} className="w-full py-12 md:py-16 lg:py-20">
      <div className={`container px-4 md:px-6 mx-auto max-w-7xl ${className}`}>
        {children}
      </div>
    </section>
  );
};

export default Section;
