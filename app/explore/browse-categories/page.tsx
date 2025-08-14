"use client";

import { useState, useEffect } from "react";
import { BrowseCategoriesSkeleton } from "@/components/skeletons/browseCategoriesSkeleton";

export default function BrowseCategoriesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        // Simulate API call - replace with actual API endpoint
        await new Promise(resolve => setTimeout(resolve, 1800));

        // Replace this with actual API call
        // const response = await fetch('/api/categories')
        // const data = await response.json()
        // setCategories(data)

        setCategories([]); // Set actual data here when API is ready
      } catch (error) {
        console.error("Error fetching categories:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-full mx-auto px-4 py-8 bg-[#111111]">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">Browse</h1>
        </div>
        <BrowseCategoriesSkeleton count={10} />
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto px-4 py-8 bg-[#111111]">
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-white mb-2">Browse</h1>
      </div>

      {/*Actual categories content will go here */}
      <div className="text-center py-12">
        <p className="text-gray-500">
          Categories will be displayed here once API is connected
        </p>
      </div>
    </div>
  );
}
