import Image from "next/image";

interface BrowseIconProps {
  size?: number;
  className?: string;
}

const BrowseIcon = ({ size = 20, className = "" }: BrowseIconProps) => {
  return (
    <Image
      src="/Images/browse-icon.png"
      alt="Browse"
      width={size}
      height={size}
      className={className}
    />
  );
};

export default BrowseIcon; 