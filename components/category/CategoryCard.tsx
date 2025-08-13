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
    <Link href={`/browse/category/${encodeURIComponent(title)}`} passHref>
      <main className="w-[179px] h-[321px] flex flex-col gap-2 cursor-pointer group">
        <div className="relative w-full h-[250px] rounded group-hover:brightness-75 transition-all duration-200">
          <Image
            src={imageUrl || "/Images/placeholder.jpg"}
            alt={title}
            layout="fill"
            objectFit="cover"
            className="rounded"
          />
        </div>
        <article className="flex flex-col gap-1">
          <h3 className="font-semibold text-sm text-white">{title}</h3>
          {viewers && (
            <p className="text-white/50 font-medium text-xs">
              {viewers?.toLocaleString()} watching
            </p>
          )}
          <main className="flex gap-2 ">
            {(tags ?? []).slice(0, 2).map(tag => (
              <div key={tag} className="px-2 py-0.5 bg-white/10 rounded">
                {tag}
              </div>
            ))}
          </main>
        </article>
      </main>
    </Link>
  );
}

export default CategoryCard;
