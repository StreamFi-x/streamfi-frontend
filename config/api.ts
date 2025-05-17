// lib/api/index.ts
import { api } from "./_config";


const fetchData = async <T = any>(endpoint: string): Promise<T> => {
  const response = await api.get<T>(endpoint);
  return response.data;
};

const postData = async <T = any, D = any>(endpoint: string, data: D): Promise<T> => {
  const response = await api.post<T>(endpoint, data);
  return response.data;
};

const updateData = async <T = any, D = any>(endpoint: string, data: D): Promise<T> => {
  const response = await api.put<T>(endpoint, data);
  return response.data;
};

const deleteData = async <T = any>(endpoint: string): Promise<T> => {
  const response = await api.delete<T>(endpoint);
  return response.data;
};

export { api, fetchData, postData, updateData, deleteData };