/**
 * Theme Classes - Centralized theme styling for StreamFi
 *
 * This file contains all theme-related classes used throughout the application.
 * When you need to update theme colors, you only need to change them here.
 */

// Base transition for all theme changes
const themeTransition = "transition-colors duration-700"

// Background colors
export const bgClasses = {
  // Primary backgrounds
  primary: `bg-white dark:bg-background ${themeTransition}`,
  secondary: `bg-gray-100 dark:bg-black ${themeTransition}`,
  sidebar: `bg-white dark:bg-[#17191A] ${themeTransition}`,
  tertiary: `bg-gray-100 dark:bg-[#151515] ${themeTransition}`,
  wallet: `bg-[#161616] dark:bg-[#1A1B1D] ${themeTransition}`,

  // Component backgrounds
  card: `bg-white dark:bg-[#17191A] ${themeTransition}`,
  modal: `bg-white dark:bg-background ${themeTransition}`,
  dropdown: `bg-white dark:bg-[#161616] shadow-lg rounded-md ${themeTransition}`,
  input: `bg-gray-100 dark:bg-[#2a2a2a] ${themeTransition}`,

  // Interactive backgrounds
  hover: `hover:bg-gray-100 dark:hover:bg-[#282828] ${themeTransition}`,
  active: `active:bg-gray-200 dark:active:bg-[#3D3F41] ${themeTransition}`,
  selected: `bg-purple-50 dark:bg-purple-900/20 ${themeTransition}`,

  // Special backgrounds
  highlight: `bg-white dark:bg-[#17191A] ${themeTransition}`,
  warning: `bg-amber-50 dark:bg-amber-900/20 ${themeTransition}`,
  error: `bg-red-50 dark:bg-red-900/20 ${themeTransition}`,
  success: `bg-green-50 dark:bg-green-900/20 ${themeTransition}`,

  // Overlay backgrounds
  overlay: `bg-black/50 dark:bg-black/80 ${themeTransition}`,
}

// Text colors
export const textClasses = {
  // Primary text
  primary: `text-gray-900 dark:text-white ${themeTransition}`,
  secondary: `text-gray-600 dark:text-gray-300 ${themeTransition}`,
  tertiary: `text-gray-500 dark:text-gray-400 ${themeTransition}`,
  inverse: `text-white dark:text-gray-900 ${themeTransition}`,

  // Interactive text
  link: `text-purple-600 dark:text-purple-400 ${themeTransition}`,
  linkHover: `hover:text-purple-800 dark:hover:text-purple-300 ${themeTransition}`,
  inverseHover: `hover:text-purple-100 dark:hover:text-purple-100 ${themeTransition}`,

  // Special text
  highlight: `text-purple-600 dark:text-purple-400 ${themeTransition}`,
  warning: `text-amber-600 dark:text-amber-400 ${themeTransition}`,
  error: `text-red-600 dark:text-red-400 ${themeTransition}`,
  success: `text-green-600 dark:text-green-400 ${themeTransition}`,

  // Inverted text (for colored backgrounds)
  onColor: `text-white ${themeTransition}`,
}

// Border colors
export const borderClasses = {
  // Primary borders
  primary: `border-gray-200 dark:border-white/10 ${themeTransition}`,
  secondary: `border-gray-100 dark:border-white/5 ${themeTransition}`,
  divider: `border-gray-200 dark:border-gray-700 ${themeTransition}`,

  // Interactive borders
  focus: `focus:border-purple-600 dark:focus:border-purple-400 ${themeTransition}`,
  hover: `hover:border-gray-300 dark:hover:border-white/20 ${themeTransition}`,

  // Special borders
  highlight: `border-purple-600 dark:border-purple-400 ${themeTransition}`,
  warning: `border-amber-600 dark:border-amber-400 ${themeTransition}`,
  error: `border-red-600 dark:border-red-400 ${themeTransition}`,
  success: `border-green-600 dark:border-green-400 ${themeTransition}`,
}

// Ring/focus colors
export const ringClasses = {
  primary: `focus:ring-1 focus:ring-purple-600 dark:focus:ring-purple-400 focus:outline-none ${themeTransition}`,
  warning: `focus:ring-1 focus:ring-amber-600 dark:focus:ring-amber-400 focus:outline-none ${themeTransition}`,
  error: `focus:ring-1 focus:ring-red-600 dark:focus:ring-red-400 focus:outline-none ${themeTransition}`,
  success: `focus:ring-1 focus:ring-green-600 dark:focus:ring-green-400 focus:outline-none ${themeTransition}`,
}

// Button styles
export const buttonClasses = {
  primary: `bg-primary hover:bg-purple-700 text-white dark:text-gray-900  ${themeTransition}`,
  secondary: `bg-purple-600 hover:bg-purple-800 text-white dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white ${themeTransition}`,
  outline: `bg-transparent border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-white ${themeTransition}`,
  ghost: `bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-white ${themeTransition}`,
  reset: `bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-[#383838] dark:hover:bg-[#383838]/70 dark:text-white px-6 py-2 rounded-md ${themeTransition}`,
  connect: `bg-purple-700 hover:bg-purple-500 text-white  ${themeTransition}`,
}

// Common component classes
export const componentClasses = {
  // Cards
  card: `${bgClasses.card} ${borderClasses.primary} shadow-sm rounded-lg`,

  // Inputs
  input: `${bgClasses.input} ${borderClasses.primary} ${ringClasses.primary} ${textClasses.primary} rounded-md`,
  secretInput: `w-full ${bgClasses.input} ${textClasses.primary} rounded-lg p-3 pr-12 focus:outline-none focus:ring-2 focus:ring-purple-500`,

  // Dropdowns
  dropdown: `${bgClasses.dropdown} ${borderClasses.primary} shadow-lg rounded-md`,

  // Modals
  modal: `${bgClasses.modal} ${borderClasses.primary} shadow-xl rounded-lg`,

  // Headers
  header: `${bgClasses.primary} ${borderClasses.primary} border-b`,

  // Navigation
  nav: `${bgClasses.primary} ${borderClasses.primary}`,
  navItem: `${textClasses.primary} ${bgClasses.hover} rounded-md`,

  // Lists
  listItem: `${bgClasses.hover} ${textClasses.primary} rounded-md`,
}

// Combine multiple classes
export function combineClasses(...classArrays: string[]): string {
  return classArrays.join(" ")
}
