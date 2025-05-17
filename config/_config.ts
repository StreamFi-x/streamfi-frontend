
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

// Define base URL with fallback
const baseURL = process.env.NEXT_PUBLIC_API_URL || "/api";

const createAxiosInstance = (config?: AxiosRequestConfig): AxiosInstance => {
  const axiosInstance = axios.create({
    baseURL,
    timeout: 10000,
    headers: {
      "Content-Type": "application/json",
    },
    ...config,
  });

  // Request interceptor
  axiosInstance.interceptors.request.use(
    (config) => {
      // You can add auth tokens here
      const token = localStorage.getItem("token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor
  axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
      // Handle errors (401, 403, etc)
      if (error.response?.status === 401) {
        // Handle unauthorized
        console.error("Unauthorized request");
        // Optionally redirect to login
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }
  );

  return axiosInstance;
};

// Default instance
const api = createAxiosInstance();

export { api, createAxiosInstance };