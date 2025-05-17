export const handleGenericError = (error: any): string => {
  if (!error) {
    return "An unknown error occurred.";
  }

  if (error.response) {
    const responseData = error.response.data;

    // Try to extract a meaningful error message
    return (
      responseData?.message ||
      (Array.isArray(responseData?.email) && responseData.email.join(", ")) ||
      responseData?.detail ||
      responseData?.error ||
      error.message ||
      "An error occurred on the server."
    );
  }

  if (error.request) {
    return "No response received from the server. Please check your connection or try again later.";
  }

  if (error.message) {
    return error.message;
  }

  return "An unexpected error occurred.";
};
