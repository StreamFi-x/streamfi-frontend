export const generateId = () => "id_" + Math.random().toString(36).substring(2);
export const generateFollowId = generateId;
export const generateVerificationRequestId = generateId;
