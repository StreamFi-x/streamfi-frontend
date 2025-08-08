"use client";
import CategoryCard from "@/components/category/CategoryCard";
import React, { useEffect, useState } from "react";

type Category = {
  id: string;
  title: string;
  imageUrl?: string;
  viewer?: number;
  tags: string[];
};

export default function BrowseCategoryPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch("/api/category");
        if (!response.ok) {
          throw new Error("Failed to fetch categories");
        }
        const data = await response.json();
        console.log(data.categories);
        setCategories(data.categories);
      } catch (error) {
        console.error(error);
      }
    };
    fetchCategories();
  }, []);
  return (
    <div className="">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {categories.map((category) => (
          <CategoryCard key={category.id} category={category} />
        ))}
      </div>
    </div>
  );
}
