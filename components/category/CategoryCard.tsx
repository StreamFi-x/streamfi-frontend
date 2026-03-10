import Image from "next/image";
import Link from "next/link";
import React from "react";

interface CategoryCardProps {
  category: {
    id: string;
    title: string;
    imageUrl?: string;
    viewers?: number;
    tags: string[];
  };
}

function CategoryCard({ category }: CategoryCardProps) {
  const { title, imageUrl, viewers, tags } = category;
  return (
    <Link href={`/browse/category/${encodeURIComponent(title)}`}>
      <div className="flex flex-col gap-2 cursor-pointer group">
        <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden">
          <Image
            src={imageUrl || "/Images/placeholder.jpg"}
            alt={title}
            fill
            className="object-cover group-hover:brightness-75 transition-all duration-200"
          />
        </div>
        <div className="flex flex-col gap-1 px-0.5">
          <h3 className="font-semibold text-sm text-foreground truncate">{title}</h3>
          {viewers !== null && viewers !== undefined && viewers > 0 && (
            <p className="text-muted-foreground text-xs">
              {viewers.toLocaleString()} watching
            </p>
          )}
          <div className="flex flex-wrap gap-1">
            {(tags ?? []).slice(0, 2).map(tag => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-muted text-muted-foreground text-xs font-medium rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default CategoryCard;
